// Gera supabase/seed.sql a partir de src/data/seed.json (dados de exemplo do protótipo).
// Uso: node scripts/make-seed-sql.mjs voce@email.com
import fs from 'node:fs';

const email = process.argv[2] || 'troque@exemplo.com';
const seed = JSON.parse(fs.readFileSync('src/data/seed.json', 'utf8'));
const q = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const rows = (table, list) =>
  list.length
    ? `insert into ${table} (id, data) values\n` +
      list.map(({ id, ...d }) => `  ('${id}', ${q(d)})`).join(',\n') +
      `\non conflict (id) do update set data = excluded.data;\n`
    : '';
const { id: _id, ...settings } = seed.settings;
settings.attendantPin = String(Math.floor(100000 + Math.random() * 900000));
const out = [
  '-- Gerado por scripts/make-seed-sql.mjs. Dados de exemplo do protótipo.',
  `insert into a2_owners (email) values ('${email.replace(/'/g, "''")}') on conflict do nothing;`,
  `insert into a2_settings (id, data) values ('main', ${q(settings)}) on conflict (id) do update set data = excluded.data;`,
  rows('a2_events', seed.events),
  rows('a2_artists', seed.artists),
  rows('a2_tickets', seed.tickets),
].join('\n');
fs.writeFileSync('supabase/seed.sql', out);
console.log(`supabase/seed.sql gerado. Dona: ${email}. PIN do atendimento: ${settings.attendantPin}`);
