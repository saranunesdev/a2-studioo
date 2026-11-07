# CLAUDE.md

App da A2 Tattoo Studio para flash tattoo em eventos. Vite + React + TypeScript; Supabase opcional (sem variáveis de ambiente roda em modo local/demonstração).

## Comandos
- `npm run dev` — servidor em http://localhost:5173
- `npm run build` — `tsc -b` + build
- `npm test` — Vitest (`src/**/*.test.ts`)
- `npm run lint` — ESLint
- `npm run extract` — extrai pranchas e dados do protótipo
- `node scripts/make-seed-sql.mjs email` — gera `supabase/seed.sql` (fora do Git)

## Regras importantes
- Não abra o bloco de dados de `prototipo/a2-eventos.html` (linha 162, 4 MB de base64).
- Três acessos: gestão (`/painel`, dona), atendimento (`/atendimento`, PIN, só o evento aberto hoje), cliente (`/cliente`, sem login) e telão (`/fila`).
- Nunca expor ao atendimento agenda, orçamento, contratos, equipe ou fechamento; nunca expor ao cliente/telão nomes, telefones ou saúde. Os recortes estão em `src/lib/queue.ts` (`deskData`, `publicDoc`) e em `supabase/migrations/0001_a2.sql`; mantenha os dois iguais e os testes em `queue.test.ts`.
- Regras da fila: `src/lib/queue.ts` (TS) e `a2_queue`/`a2_fill_tables` (SQL) espelham uma à outra.
- Identidade: só a paleta `#0A0A0A #1C1C1C #333333 #BFBFBF #FFFFFF`; `#333333` nunca em texto. Playfair Display + Montserrat.
- Acessibilidade: texto ≥ 16 px, toque ≥ 44 px, rótulo visível, erro em texto, situação escrita (não só cor), alt nos flashs.
- Textos do cliente em pt e en (`src/lib/i18n.ts`). Frases curtas, sem termos técnicos.
- Datas no fuso America/Sao_Paulo (`src/lib/util.ts`).
- Campos da gestão salvam ao sair do campo (`SaveInput`), não a cada tecla.
