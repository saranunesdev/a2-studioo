// Lê prototipo/a2-eventos.html, salva as 60 pranchas em public/flash/ e gera
// src/data/flashes.ts (CELLS) e src/data/seed.json (dados de exemplo).
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('prototipo/a2-eventos.html', 'utf8');
const line = html.split('\n').find((l) => l.startsWith('<script>const IMGS='));
if (!line) throw new Error('Bloco de dados não encontrado no protótipo.');
const code = line.replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
const ctx = {};
vm.runInNewContext(code + ';this.IMGS=IMGS;this.CELLS=CELLS;this.SEED=SEED;', ctx);

fs.mkdirSync('public/flash', { recursive: true });
ctx.IMGS.forEach((u, i) => {
  const b64 = u.split(',')[1];
  fs.writeFileSync(`public/flash/prancha-${String(i).padStart(2, '0')}.webp`, Buffer.from(b64, 'base64'));
});
const cells = ctx.CELLS.map((s) => '[' + s.map((c) => JSON.stringify(c)).join(',') + ']').join(',\n');
fs.writeFileSync(
  'src/data/flashes.ts',
  `// Gerado por scripts/extract-flash.mjs. Não edite à mão.\n` +
    `// Cada célula: [x0, y0, x1, y1] em fração da prancha (880 × 1320).\n` +
    `export type Cell = [number, number, number, number];\n` +
    `export const CELLS: Cell[][] = [\n${cells}\n];\n`,
);
fs.writeFileSync('src/data/seed.json', JSON.stringify(ctx.SEED, null, 1));
const total = ctx.CELLS.reduce((n, s) => n + s.length, 0);
console.log(`${ctx.IMGS.length} pranchas, ${total} desenhos extraídos.`);
