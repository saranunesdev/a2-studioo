-- Gestão sem login (pedido da dona do estúdio em 07/11/2026).
-- A partir daqui, qualquer pessoa com o link do app pode ler e gravar todas as
-- tabelas pela chave pública: eventos, equipe, caixa e fichas de saúde dos clientes.
-- O PIN do atendimento continua separando as telas, mas não protege os dados.
-- Para voltar a proteger, troque a função abaixo pela versão de 0001_a2.sql.

create or replace function a2_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select true;
$$;
