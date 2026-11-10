-- PIN da gestão (substitui 0002_gestao_sem_login.sql).
-- Sem e-mail e sem login do Supabase: a gestão entra com um PIN de números.
-- O banco confere o PIN em cada leitura e gravação. Quem tiver só o link não vê nada.
-- O PIN fica embaralhado (bcrypt) em a2_secrets, que não tem regra de leitura pública.
-- 5 PINs errados seguidos travam as tentativas por 5 minutos.
--
-- Depois de rodar este arquivo, crie o primeiro PIN (só funciona enquanto não houver PIN):
--   select a2_setup_owner_pin('SEU-PIN');

create extension if not exists pgcrypto with schema extensions;

create table if not exists a2_secrets (id text primary key, value text not null);
alter table a2_secrets enable row level security; -- sem policies: só funções do banco leem

create table if not exists a2_attempts (kind text primary key, fails int not null default 0, locked_until timestamptz);
alter table a2_attempts enable row level security;

-- Volta a fechar as tabelas: dono é quem tem e-mail em a2_owners OU passou o PIN nesta chamada.
create or replace function a2_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('a2.owner', true), '') = '1'
      or exists (select 1 from a2_owners where lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
$$;

-- Confere o PIN da gestão e marca esta chamada como “dona”. Conta erros e trava.
create or replace function a2_owner_auth(p_pin text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
declare h text; a a2_attempts;
begin
  if coalesce(p_pin, '') = '' then return false; end if;
  if p_pin = a2_settings_doc()->>'attendantPin' then return false; end if; -- PIN do balcão não conta como erro
  select * into a from a2_attempts where kind = 'owner';
  if a.locked_until is not null and a.locked_until > now() then return false; end if;
  select value into h from a2_secrets where id = 'owner_pin';
  if h is not null and crypt(p_pin, h) = h then
    insert into a2_attempts (kind, fails, locked_until) values ('owner', 0, null)
      on conflict (kind) do update set fails = 0, locked_until = null;
    perform set_config('a2.owner', '1', true);
    return true;
  end if;
  insert into a2_attempts (kind, fails) values ('owner', 1)
    on conflict (kind) do update set
      fails = case when a2_attempts.fails + 1 >= 5 then 0 else a2_attempts.fails + 1 end,
      locked_until = case when a2_attempts.fails + 1 >= 5 then now() + interval '5 minutes' else null end;
  return false;
end $$;

-- Gestão (PIN ou e-mail) ou atendimento (PIN do balcão).
create or replace function a2_staff(p_pin text) returns boolean
language sql volatile security definer set search_path = public as $$
  select a2_owner_auth(p_pin) or a2_is_owner() or a2_check_pin(p_pin);
$$;

-- a2_desk precisa ser volatile porque a2_staff grava as tentativas.
alter function a2_desk(text) volatile;

create or replace function a2_owner_login(p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare ok boolean := a2_owner_auth(p_pin); wait int;
begin
  if ok then return jsonb_build_object('ok', true); end if;
  select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int into wait from a2_attempts where kind = 'owner';
  return jsonb_build_object('ok', false, 'wait', coalesce(wait, 0));
end $$;

create or replace function a2_setup_owner_pin(p_new text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from a2_secrets where id = 'owner_pin') then raise exception 'O PIN da gestão já existe. Troque em Ajustes.'; end if;
  if p_new !~ '^\d{6,8}$' then raise exception 'O PIN precisa ter de 6 a 8 números.'; end if;
  insert into a2_secrets (id, value) values ('owner_pin', crypt(p_new, gen_salt('bf')));
  return true;
end $$;

create or replace function a2_owner_set_pin(p_pin text, p_new text) returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not a2_owner_auth(p_pin) then raise exception 'Sem acesso.'; end if;
  if p_new !~ '^\d{6,8}$' then raise exception 'O PIN precisa ter de 6 a 8 números.'; end if;
  if p_new = a2_settings_doc()->>'attendantPin' then raise exception 'Use um PIN diferente do PIN do atendimento.'; end if;
  insert into a2_secrets (id, value) values ('owner_pin', crypt(p_new, gen_salt('bf')))
    on conflict (id) do update set value = excluded.value;
  return true;
end $$;

-- Tudo o que a gestão vê. null = PIN errado.
create or replace function a2_owner_all(p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not a2_owner_auth(p_pin) then return null; end if;
  return jsonb_build_object(
    'events', coalesce((select jsonb_agg(data || jsonb_build_object('id', id)) from a2_events), '[]'::jsonb),
    'artists', coalesce((select jsonb_agg(data || jsonb_build_object('id', id)) from a2_artists), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(data || jsonb_build_object('id', id)) from a2_tickets), '[]'::jsonb),
    'settings', a2_settings_doc());
end $$;

-- Mesma regra do deepMerge de src/lib/util.ts: objetos se juntam, o resto é trocado.
create or replace function a2_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; out jsonb;
begin
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(b) is distinct from 'object' then return b; end if;
  out := a;
  for k in select jsonb_object_keys(b) loop
    if jsonb_typeof(out->k) = 'object' and jsonb_typeof(b->k) = 'object' then
      out := jsonb_set(out, array[k], a2_merge(out->k, b->k));
    else
      out := jsonb_set(out, array[k], b->k, true);
    end if;
  end loop;
  return out;
end $$;

create or replace function a2_table_of(p_col text) returns text
language sql immutable as $$
  select case p_col when 'events' then 'a2_events' when 'artists' then 'a2_artists' when 'tickets' then 'a2_tickets'
    when 'settings' then 'a2_settings' end;
$$;

create or replace function a2_owner_put(p_pin text, p_col text, p_id text, p_data jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare t text := a2_table_of(p_col);
begin
  if not a2_owner_auth(p_pin) then raise exception 'Sem acesso.'; end if;
  if t is null then raise exception 'Coleção inválida.'; end if;
  execute format('insert into %I (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data', t)
    using p_id, p_data - 'id';
end $$;

create or replace function a2_owner_patch(p_pin text, p_col text, p_id text, p_partial jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare t text := a2_table_of(p_col); cur jsonb; v_id text := case when p_col = 'settings' then 'main' else p_id end;
begin
  if not a2_owner_auth(p_pin) then raise exception 'Sem acesso.'; end if;
  if t is null then raise exception 'Coleção inválida.'; end if;
  execute format('select data from %I where id = $1 for update', t) into cur using v_id;
  if cur is null and p_col <> 'settings' then raise exception 'Não encontrado.'; end if;
  execute format('insert into %I (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data', t)
    using v_id, a2_merge(coalesce(cur, '{}'::jsonb), p_partial);
end $$;

create or replace function a2_owner_remove(p_pin text, p_col text, p_id text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare t text := a2_table_of(p_col);
begin
  if not a2_owner_auth(p_pin) then raise exception 'Sem acesso.'; end if;
  if t is null or p_col = 'settings' then raise exception 'Coleção inválida.'; end if;
  execute format('delete from %I where id = $1', t) using p_id;
end $$;

revoke all on function a2_owner_auth(text), a2_merge(jsonb, jsonb), a2_table_of(text) from public, anon, authenticated;
grant execute on function a2_owner_login(text), a2_setup_owner_pin(text), a2_owner_set_pin(text, text), a2_owner_all(text),
  a2_owner_put(text, text, text, jsonb), a2_owner_patch(text, text, text, jsonb), a2_owner_remove(text, text, text)
  to anon, authenticated;
