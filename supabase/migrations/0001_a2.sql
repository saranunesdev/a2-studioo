-- A2 Tattoo Studio · Eventos
-- Tabelas em formato documento (jsonb), no mesmo formato do protótipo e do modo local.
-- Regras de acesso:
--   • Gestão (e-mails em a2_owners, login por link mágico): lê e grava todas as tabelas.
--   • Atendimento (PIN definido em Ajustes): só usa a2_desk, a2_queue e a2_submit_ticket,
--     e só para o evento aberto hoje. Não vê agenda, orçamento, contratos nem equipe.
--   • Cliente e telão (sem login): só a2_public_live, a2_submit_ticket e a2_get_ticket
--     (o próprio pedido, pelo id secreto guardado no celular).
-- As regras da fila espelham src/lib/queue.ts.

create extension if not exists pgcrypto;

create table if not exists a2_owners (email text primary key);
create table if not exists a2_settings (id text primary key, data jsonb not null default '{}');
create table if not exists a2_events (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists a2_artists (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists a2_tickets (id text primary key, data jsonb not null, updated_at timestamptz default now());
create index if not exists a2_tickets_event on a2_tickets ((data->>'eventId'));
create index if not exists a2_tickets_status on a2_tickets ((data->>'eventId'), (data->>'status'));

create or replace function a2_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from a2_owners where lower(email) = lower(coalesce(auth.jwt()->>'email', '')));
$$;

alter table a2_owners enable row level security;
alter table a2_settings enable row level security;
alter table a2_events enable row level security;
alter table a2_artists enable row level security;
alter table a2_tickets enable row level security;

drop policy if exists owners_self on a2_owners;
create policy owners_self on a2_owners for select using (a2_is_owner());
drop policy if exists owner_all on a2_settings;
create policy owner_all on a2_settings for all using (a2_is_owner()) with check (a2_is_owner());
drop policy if exists owner_all on a2_events;
create policy owner_all on a2_events for all using (a2_is_owner()) with check (a2_is_owner());
drop policy if exists owner_all on a2_artists;
create policy owner_all on a2_artists for all using (a2_is_owner()) with check (a2_is_owner());
drop policy if exists owner_all on a2_tickets;
create policy owner_all on a2_tickets for all using (a2_is_owner()) with check (a2_is_owner());

-- Tempo real para o painel da gestão.
do $$ begin
  alter publication supabase_realtime add table a2_events, a2_artists, a2_tickets, a2_settings;
exception when others then null; end $$;

create or replace function a2_now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

create or replace function a2_settings_doc() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from a2_settings where id = 'main'), '{}'::jsonb);
$$;

create or replace function a2_check_pin(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(length(p_pin) >= 4 and a2_settings_doc()->>'attendantPin' = p_pin, false);
$$;

-- Gestão ou atendimento com PIN válido.
create or replace function a2_staff(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select a2_is_owner() or a2_check_pin(p_pin);
$$;

-- Coloca o próximo da fila em cada mesa livre. Chamar com a linha do evento já travada.
create or replace function a2_fill_tables(p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare
  ts jsonb; tb jsonb; newts jsonb := '[]'::jsonb; cur_status text; nxt_id text; now_ms bigint := a2_now_ms();
begin
  select coalesce(data->'tableState', '[]'::jsonb) into ts from a2_events where id = p_event;
  if ts is null then return; end if;
  for tb in select x from jsonb_array_elements(ts) as t(x) loop
    if tb->>'ticketId' is not null then
      select data->>'status' into cur_status from a2_tickets where id = tb->>'ticketId';
      if cur_status in ('chamado', 'em_atendimento') then
        newts := newts || jsonb_build_array(tb);
        continue;
      end if;
    end if;
    tb := jsonb_set(tb, '{ticketId}', 'null'::jsonb);
    if coalesce((tb->>'paused')::boolean, false) or tb->>'artistId' is null then
      newts := newts || jsonb_build_array(tb);
      continue;
    end if;
    select id into nxt_id from a2_tickets
      where data->>'eventId' = p_event and data->>'status' = 'na_fila'
      order by coalesce((data->>'queueAt')::bigint, 0), id
      limit 1 for update skip locked;
    if nxt_id is not null then
      update a2_tickets set updated_at = now(), data = data || jsonb_build_object(
        'status', 'chamado', 'table', (tb->>'n')::int, 'artistId', tb->'artistId', 'calledAt', now_ms)
      where id = nxt_id;
      tb := jsonb_set(tb, '{ticketId}', to_jsonb(nxt_id));
    end if;
    newts := newts || jsonb_build_array(tb);
    nxt_id := null;
  end loop;
  update a2_events set data = jsonb_set(data, '{tableState}', newts), updated_at = now() where id = p_event;
end $$;

create or replace function a2_queue(p_op jsonb, p_pin text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_type text := p_op->>'type'; v_event text; tk jsonb; st text; now_ms bigint := a2_now_ms();
begin
  if not a2_staff(p_pin) then raise exception 'Sem acesso.'; end if;
  if p_op ? 'ticketId' then
    select data->>'eventId' into v_event from a2_tickets where id = p_op->>'ticketId';
  else
    v_event := p_op->>'eventId';
  end if;
  if v_event is null then raise exception 'Evento não encontrado.'; end if;
  if not a2_is_owner() and v_event is distinct from a2_settings_doc()->>'liveEventId' then
    raise exception 'O atendimento só mexe no evento aberto hoje.';
  end if;

  perform 1 from a2_events where id = v_event for update; -- uma operação por vez em cada evento

  if p_op ? 'ticketId' then
    select data into tk from a2_tickets where id = p_op->>'ticketId' for update;
    st := tk->>'status';
  end if;

  if v_type = 'pay' and st = 'aguardando_pagamento' then
    update a2_tickets set updated_at = now(), data = data || jsonb_build_object(
      'status', 'na_fila', 'queueAt', now_ms,
      'pay', jsonb_build_object('method', p_op->>'method', 'amount', coalesce((tk->'flash'->>'price')::numeric, 0), 'at', now_ms))
    where id = p_op->>'ticketId';
  elsif v_type = 'start' and st = 'chamado' then
    update a2_tickets set updated_at = now(), data = data || jsonb_build_object('status', 'em_atendimento', 'startedAt', now_ms)
    where id = p_op->>'ticketId';
  elsif v_type = 'finish' and st in ('em_atendimento', 'chamado') then
    update a2_tickets set updated_at = now(), data = data || jsonb_build_object('status', 'concluido', 'doneAt', now_ms)
    where id = p_op->>'ticketId';
  elsif v_type = 'noshow' and st = 'chamado' then
    update a2_tickets set updated_at = now(), data = data || jsonb_build_object(
      'status', 'na_fila', 'queueAt', now_ms, 'table', null, 'calledAt', null)
    where id = p_op->>'ticketId';
  elsif v_type = 'cancel' and st in ('aguardando_pagamento', 'na_fila', 'chamado') then
    update a2_tickets set updated_at = now(), data = data || jsonb_build_object('status', 'cancelado')
    where id = p_op->>'ticketId';
  elsif v_type = 'requeue' and st = 'cancelado' then
    update a2_tickets set updated_at = now(), data = data || case
      when tk->'pay' is null or tk->'pay' = 'null'::jsonb then jsonb_build_object('status', 'aguardando_pagamento')
      else jsonb_build_object('status', 'na_fila', 'queueAt', now_ms, 'table', null) end
    where id = p_op->>'ticketId';
  elsif v_type in ('pause', 'tableArtist') then
    update a2_events set updated_at = now(), data = jsonb_set(data, '{tableState}', (
      select coalesce(jsonb_agg(case when (x->>'n')::int = (p_op->>'n')::int then
        case when v_type = 'pause'
          then jsonb_set(x, '{paused}', to_jsonb(not coalesce((x->>'paused')::boolean, false)))
          else jsonb_set(x, '{artistId}', coalesce(p_op->'artistId', 'null'::jsonb)) end
        else x end order by ord), '[]'::jsonb)
      from jsonb_array_elements(data->'tableState') with ordinality as t(x, ord)))
    where id = v_event;
  end if;

  perform a2_fill_tables(v_event);
end $$;

create or replace function a2_submit_ticket(p_input jsonb, p_pin text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s jsonb := a2_settings_doc(); v_event text := p_input->>'eventId'; v_id text := gen_random_uuid()::text;
  v_code text; chars text := 'ACDEFGHJKLMNPQRTUVWXY34679'; i int; tries int := 0;
  v_tier text := p_input->'flash'->>'tier'; v_size text := p_input->'flash'->>'size'; v_price numeric;
  v_pay text := nullif(p_input->>'payMethod', ''); now_ms bigint := a2_now_ms(); paid boolean;
begin
  if v_event is distinct from s->>'liveEventId' then raise exception 'Este evento não está aberto.'; end if;
  if length(trim(coalesce(p_input->>'name', ''))) < 2 then raise exception 'Nome obrigatório.'; end if;
  if v_pay is not null and not a2_staff(p_pin) then raise exception 'Só a equipe confirma pagamento.'; end if;
  if v_tier not in ('F', 'D') or v_size not in ('P', 'M', 'G') then raise exception 'Flash inválida.'; end if;
  v_price := (s->'prices'->v_tier->>v_size)::numeric; -- o preço vem dos Ajustes, nunca do celular
  if v_price is null then raise exception 'Tamanho não disponível.'; end if;
  paid := v_pay is not null;

  perform 1 from a2_events where id = v_event for update;
  loop
    v_code := '';
    for i in 1..3 loop v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from a2_tickets where data->>'eventId' = v_event and data->>'code' = v_code);
    tries := tries + 1;
    if tries > 60 then v_code := upper(substr(md5(v_id), 1, 4)); exit; end if;
  end loop;

  insert into a2_tickets (id, data) values (v_id, jsonb_build_object(
    'eventId', v_event, 'code', v_code, 'createdAt', now_ms,
    'status', case when paid then 'na_fila' else 'aguardando_pagamento' end,
    'name', trim(p_input->>'name'), 'phone', regexp_replace(coalesce(p_input->>'phone', ''), '\D', '', 'g'),
    'flash', jsonb_build_object('sheet', (p_input->'flash'->>'sheet')::int, 'n', (p_input->'flash'->>'n')::int,
      'size', v_size, 'tier', v_tier, 'price', v_price),
    'bodyPart', coalesce(p_input->>'bodyPart', ''), 'anamnese', coalesce(p_input->'anamnese', '{}'::jsonb),
    'alerts', coalesce(p_input->'alerts', '[]'::jsonb),
    'pay', case when paid then jsonb_build_object('method', v_pay, 'amount', v_price, 'at', now_ms) else null end,
    'queueAt', case when paid then now_ms else null end,
    'table', null, 'artistId', null, 'calledAt', null, 'startedAt', null, 'doneAt', null, 'care', '{}'::jsonb,
    'source', coalesce(p_input->>'source', 'qr'), 'lang', coalesce(p_input->>'lang', 'pt')));

  if paid then perform a2_fill_tables(v_event); end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- O cliente só lê o próprio pedido, pelo id secreto.
create or replace function a2_get_ticket(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data || jsonb_build_object('id', id) from a2_tickets where id = p_id;
$$;

-- Fila pública: sem nomes, telefones ou dados de saúde.
create or replace function a2_public_live() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := a2_settings_doc(); e jsonb; v_event text := s->>'liveEventId';
begin
  if v_event is null then return null; end if;
  select data into e from a2_events where id = v_event;
  if e is null then return null; end if;
  return jsonb_build_object(
    'open', true, 'eventId', v_event, 'name', e->>'name', 'type', e->>'type', 'date', e->>'date',
    'venue', coalesce(e->>'venue', ''), 'start', coalesce(e->>'start', ''), 'end', coalesce(e->>'end', ''),
    'cats', coalesce(e->'cats', '[]'::jsonb), 'prices', s->'prices', 'avgMin', coalesce((s->>'avgMin')::int, 25),
    'studio', coalesce(s->>'studioName', 'A2 Tattoo Studio'), 'whatsapp', coalesce(s->>'whatsapp', ''),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
        'n', (tb->>'n')::int,
        'artist', coalesce(split_part(trim(a.data->>'name'), ' ', 1), ''),
        'code', coalesce(t.data->>'code', ''),
        'status', coalesce(t.data->>'status', case when coalesce((tb->>'paused')::boolean, false) then 'pausada' else 'livre' end),
        'paused', coalesce((tb->>'paused')::boolean, false)) order by ord)
      from jsonb_array_elements(e->'tableState') with ordinality as x(tb, ord)
      left join a2_tickets t on t.id = tb->>'ticketId'
      left join a2_artists a on a.id = tb->>'artistId'), '[]'::jsonb),
    'waiting', coalesce((select jsonb_agg(data->>'code' order by coalesce((data->>'queueAt')::bigint, 0), id)
      from a2_tickets where data->>'eventId' = v_event and data->>'status' = 'na_fila'), '[]'::jsonb),
    'called', coalesce((select jsonb_agg(c) from (
        select jsonb_build_object('code', data->>'code', 'table', (data->>'table')::int, 'at', (data->>'calledAt')::bigint) c
        from a2_tickets where data->>'eventId' = v_event and data->>'status' in ('chamado', 'em_atendimento')
          and data->>'calledAt' is not null
        order by (data->>'calledAt')::bigint desc limit 8) z), '[]'::jsonb));
end $$;

-- Recorte do atendimento: só o evento aberto hoje.
create or replace function a2_desk(p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := a2_settings_doc(); e jsonb; v_event text := s->>'liveEventId';
begin
  if not a2_staff(p_pin) then return null; end if;
  if v_event is null then return null; end if;
  select data into e from a2_events where id = v_event;
  if e is null then return null; end if;
  return jsonb_build_object(
    'event', jsonb_build_object('id', v_event, 'name', e->'name', 'type', e->'type', 'date', e->'date',
      'start', e->'start', 'end', e->'end', 'venue', e->'venue', 'tables', e->'tables',
      'tableState', e->'tableState', 'cats', coalesce(e->'cats', '[]'::jsonb),
      'team', coalesce((select jsonb_agg(jsonb_build_object('artistId', m->'artistId', 'role', m->'role'))
        from jsonb_array_elements(e->'team') m), '[]'::jsonb)),
    'tickets', coalesce((select jsonb_agg(data || jsonb_build_object('id', id)) from a2_tickets
      where data->>'eventId' = v_event), '[]'::jsonb),
    'artists', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.data->>'name', 'role', a.data->>'role'))
      from a2_artists a where a.id in (select m->>'artistId' from jsonb_array_elements(e->'team') m)), '[]'::jsonb),
    'settings', jsonb_build_object('prices', s->'prices', 'avgMin', s->'avgMin', 'studioName', s->'studioName',
      'whatsapp', s->'whatsapp', 'templates', s->'templates'));
end $$;

revoke all on function a2_fill_tables(text) from public, anon, authenticated;
grant execute on function a2_check_pin(text), a2_queue(jsonb, text), a2_submit_ticket(jsonb, text),
  a2_get_ticket(text), a2_public_live(), a2_desk(text) to anon, authenticated;
