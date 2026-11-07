import { WD } from '../data/constants';

export const TZ = 'America/Sao_Paulo';

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const secretId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : uid() + uid() + Math.random().toString(36).slice(2);

const CODE_CH = 'ACDEFGHJKLMNPQRTUVWXY34679';
export const newCode = (taken: Set<string> = new Set()) => {
  for (let i = 0; i < 50; i++) {
    const c = Array.from({ length: 3 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
    if (!taken.has(c)) return c;
  }
  return uid().slice(-4).toUpperCase();
};

export const brl = (n: number | null | undefined) =>
  n == null || isNaN(n)
    ? '—'
    : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const pad = (n: number) => String(n).padStart(2, '0');

/** Data (AAAA-MM-DD) no fuso de São Paulo. */
export function dKey(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((o, x) => ((o[x.type] = x.value), o), {});
  return `${p.year}-${p.month}-${p.day}`;
}
export const today = () => dKey(new Date());
export const parseD = (s: string) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
};
export const addDays = (s: string, n: number) => {
  const d = parseD(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a: string, b: string) => Math.round((+parseD(b) - +parseD(a)) / 864e5);
export const tsKey = (ts: number) => dKey(new Date(ts));
export const fmtD = (s: string, o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }, lang = 'pt-BR') =>
  parseD(s).toLocaleDateString(lang, { ...o, timeZone: 'UTC' }).replace('.', '');
export const fmtDLong = (s: string, lang = 'pt-BR') =>
  parseD(s).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const fmtT = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const wdOf = (s: string) => WD[parseD(s).getUTCDay()];

export const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
export const waNum = (p: string) => {
  let d = digits(p);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
};
export const waLink = (phone: string, text: string) =>
  'https://wa.me/' + waNum(phone) + '?text=' + encodeURIComponent(text);
export const waShare = (text: string) => 'https://wa.me/?text=' + encodeURIComponent(text);
export const first = (n: string) => String(n || '').trim().split(/\s+/)[0] || '';
export const fmtPhone = (p: string) => {
  const d = digits(p);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p || '';
};
export function ageOf(birth: string, ref: string = today()): number {
  const [y, m, d] = birth.split('-').map(Number);
  const [ty, tm, td] = ref.split('-').map(Number);
  let a = ty - y;
  if (tm < m || (tm === m && td < d)) a--;
  return a;
}

export function deepMerge<T extends object>(t: T, s: object): T {
  const tt = t as Record<string, unknown>;
  for (const [k, v] of Object.entries(s)) {
    const cur = tt[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur))
      deepMerge(cur as object, v as object);
    else tt[k] = v === undefined ? null : clone(v);
  }
  return t;
}

export function parseBlocked(txt: string, ref = today()): string[] {
  const y = Number(ref.slice(0, 4));
  return String(txt || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
      if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
      const yy = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : y;
      let k = `${yy}-${pad(+m[2])}-${pad(+m[1])}`;
      if (!m[3] && k < ref) k = `${yy + 1}-${pad(+m[2])}-${pad(+m[1])}`;
      return k;
    })
    .filter((x): x is string => !!x);
}
