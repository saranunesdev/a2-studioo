import { CARE_DAYS, MODULES } from '../data/constants';
import { sheetName } from '../data/catalog';
import type { Artist, ChecklistItem, EventDoc, Flash, Prices, Settings, Size, Ticket, Tier } from './types';
import { addDays, first, pad, tsKey, uid, wdOf } from './util';

export const priceOf = (prices: Prices, tier: Tier, size: Size): number | null => prices[tier]?.[size] ?? null;
export const minPrice = (prices: Prices, tier: Tier, size?: Size | ''): number | null => {
  if (size) return priceOf(prices, tier, size);
  const v = (['P', 'M', 'G'] as Size[]).map((z) => priceOf(prices, tier, z)).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};

export const flashName = (f?: Partial<Flash> | null) =>
  f && f.sheet != null ? `${sheetName(f.sheet)} nº ${pad(f.n ?? 1)} · ${f.size}` : 'Flash';

export function artistBusy(a: Artist, date: string, events: EventDoc[], exceptEv?: string) {
  return events.some((e) => e.id !== exceptEv && e.date === date && (e.team || []).some((m) => m.artistId === a.id));
}
/** '' quando a pessoa está livre; senão, o motivo. */
export function artistAvail(a: Artist, e: Pick<EventDoc, 'id' | 'date'>, events: EventDoc[]): string {
  if ((a.blocked || []).includes(e.date)) return 'bloqueado';
  if (artistBusy(a, e.date, events, e.id)) return 'outro evento';
  if (!(a.days || []).includes(wdOf(e.date))) return 'fora da disponibilidade';
  return '';
}

export function makeChecklist(T: number, E: number): ChecklistItem[] {
  T = Math.max(1, T || 1);
  E = Math.max(1, E || 1);
  const it: [string, string, number][] = [
    ['Equipamentos', 'Máquina rotativa + cabo', T + 1], ['Equipamentos', 'Fonte ou bateria extra', T],
    ['Equipamentos', 'Maca ou cadeira', T], ['Equipamentos', 'Mesa auxiliar', T], ['Equipamentos', 'Luminária', T],
    ['Equipamentos', 'Extensão e régua de tomadas', T + 1],
    ['Insumos', 'Cartuchos (caixas de 20)', Math.max(1, Math.ceil((E * 1.2) / 20))], ['Insumos', 'Tinta preta (frasco)', T],
    ['Insumos', 'Batoques', E * 2], ['Insumos', 'Luvas nitrílicas (pares)', E * 3], ['Insumos', 'Papel stencil', E],
    ['Insumos', 'Lâminas descartáveis', E], ['Insumos', 'Filme PVC (rolo)', T], ['Insumos', 'Papel toalha (rolo)', T * 2],
    ['Insumos', 'Vaselina ou manteiga (pote)', T], ['Insumos', 'Sabão neutro / espuma (frasco)', T],
    ['Insumos', 'Película protetora', E],
    ['Biossegurança', 'Barreiras plásticas p/ máquina e cabo', E * 2], ['Biossegurança', 'Coletor de perfurocortante', T],
    ['Biossegurança', 'Saco de lixo infectante (branco)', T * 3], ['Biossegurança', 'Álcool 70% (frasco)', T + 1],
    ['Biossegurança', 'Kit de primeiros socorros', 1], ['Biossegurança', 'Máscaras e aventais', T * 4],
    ['Stand', 'Banner com QR code do catálogo', 1], ['Stand', 'Display de QR para as mesas', T],
    ['Stand', 'Maquininha de cartão', 2], ['Stand', 'Celular/tablet do atendimento', 1],
    ['Stand', 'Fichas de anamnese impressas (reserva)', 20],
    ['Pós-atendimento', 'Kit pós (pomada + cartão de cuidados)', E], ['Documentos', 'Contrato do parceiro (cópia)', 1],
    ['Documentos', 'Contratos da equipe (cópias)', 1], ['Documentos', 'Licença sanitária / documentos exigidos', 1],
  ];
  return it.map(([g, n, q], i) => ({ id: 'c' + i + uid().slice(-4), group: g, name: n, qty: q, status: 'faltando' }));
}

export function hoursOf(e: Pick<EventDoc, 'start' | 'end'>): number {
  if (!e.start || !e.end) return 6;
  const [a, b] = [e.start, e.end].map((t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  });
  let d = b - a;
  if (d <= 0) d += 1440;
  return d / 60;
}

export function estTattoos(e: Pick<EventDoc, 'start' | 'end' | 'tables' | 'public' | 'budget'>, avgMin = 25): number {
  const b = e.budget || ({} as EventDoc['budget']);
  const hours = Math.max(1, hoursOf(e));
  const cap = Math.round(((e.tables || 1) * hours * 60) / (avgMin || 25));
  const byPublic = Math.round((e.public || 0) * ((b.conv ?? 6) / 100));
  return Math.max(1, Math.min(cap, byPublic || cap));
}

export function budgetCalc(e: EventDoc, settings: Pick<Settings, 'avgMin' | 'commission'>) {
  const b = e.budget || ({} as EventDoc['budget']);
  const est = estTattoos(e, settings.avgMin);
  const sales = (b.avgTicket || 0) * est;
  const fee = Number(b.fee) || 0;
  const comm = (e.team || []).filter((m) => m.role !== 'atendimento').length
    ? sales * ((settings.commission || 50) / 100)
    : 0;
  const costs = (b.costs || []).reduce((s, c) => s + (Number(c.value) || 0), 0);
  const supplies = (e.checklist || []).length ? Math.round(est * 18) : 0;
  return { est, sales, fee, comm, costs, supplies, result: fee + sales - comm - costs - supplies };
}

export function closingCalc(e: EventDoc, tickets: Ticket[], artists: Artist[], settings: Pick<Settings, 'commission'>) {
  const tix = tickets.filter((t) => t.eventId === e.id && t.pay && t.status !== 'cancelado');
  const cl = e.closing || ({} as EventDoc['closing']);
  const byM: Record<string, number> = {};
  for (const t of tix) byM[t.pay!.method] = (byM[t.pay!.method] || 0) + (Number(t.pay!.amount) || 0);
  const sales = tix.reduce((s, t) => s + (Number(t.pay!.amount) || 0), 0);
  const arts: Record<string, { n: number; gross: number; pct: number; pay: number }> = {};
  for (const t of tix) {
    if (!t.artistId) continue;
    const a = (arts[t.artistId] = arts[t.artistId] || { n: 0, gross: 0, pct: 0, pay: 0 });
    a.n++;
    a.gross += Number(t.pay!.amount) || 0;
  }
  let comm = 0;
  for (const id in arts) {
    const a = artists.find((x) => x.id === id);
    const pct = a && a.commission != null ? a.commission : settings.commission || 50;
    arts[id].pct = pct;
    arts[id].pay = Math.round((arts[id].gross * pct) / 100);
    comm += arts[id].pay;
  }
  const fee = Number((e.budget || {}).fee) || 0;
  const costs =
    ((e.budget || {}).costs || []).reduce((s, c) => s + (Number(c.value) || 0), 0) +
    (cl.extra || []).reduce((s, c) => s + (Number(c.value) || 0), 0);
  const supplies = cl.supplies != null ? Number(cl.supplies) : tix.length * 18;
  return { tix, byM, sales, arts, comm, fee, costs, supplies, result: sales + fee - comm - costs - supplies };
}

export function nextCare(t: Pick<Ticket, 'doneAt' | 'care'>): { d: number; date: string } | null {
  if (!t.doneAt || (t.care && t.care.skip)) return null;
  const d0 = tsKey(t.doneAt);
  for (const d of CARE_DAYS) if (!(t.care && t.care[d])) return { d, date: addDays(d0, d) };
  return null;
}

export function careMsg(t: Pick<Ticket, 'name' | 'flash'>, d: number, templates: Record<string, string>, eventName: string) {
  const tpl = (templates || {})[d] || '';
  return tpl
    .replace(/\{nome\}/g, first(t.name))
    .replace(/\{evento\}/g, eventName || 'evento')
    .replace(/\{flash\}/g, flashName(t.flash));
}

export function careDue(tickets: Ticket[], t0: string) {
  let n = 0;
  for (const t of tickets) {
    if (t.status !== 'concluido' || !t.doneAt) continue;
    const nx = nextCare(t);
    if (nx && nx.date <= t0) n++;
  }
  return n;
}

export const evProgress = (e: EventDoc) => {
  const st = e.steps || {};
  return Object.values(st).filter((s) => s && s.done).length;
};
export const teamCount = (e: Pick<EventDoc, 'team'>, role?: string) =>
  (e.team || []).filter((m) => (role ? m.role === role : true)).length;
export const trainedAll = (e: EventDoc, artistId: string) =>
  MODULES.every((md) => e.training?.[artistId]?.[md.id]);
