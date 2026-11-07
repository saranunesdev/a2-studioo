// Regras da fila. Funções puras: recebem o estado e devolvem o novo estado.
// O backend local e o Supabase (supabase/migrations) seguem exatamente estas regras.
import type {
  AllData, Artist, DeskData, EventDoc, PublicLive, QueueOp, Settings, Ticket, TicketInput,
} from './types';
import { clone, first, newCode } from './util';

export interface QueueState {
  event: EventDoc;
  tickets: Ticket[];
}

export const queueOf = (tickets: Ticket[], eventId: string) =>
  tickets
    .filter((t) => t.eventId === eventId && t.status === 'na_fila')
    .sort((a, b) => (a.queueAt || 0) - (b.queueAt || 0));

/** Coloca o próximo da fila em cada mesa livre, com tatuador e não pausada. */
export function fillTables(s: QueueState, now: number): QueueState {
  const event = clone(s.event);
  const tickets = s.tickets.map((t) => ({ ...t }));
  const q = queueOf(tickets, event.id);
  for (const tb of event.tableState || []) {
    const cur = tb.ticketId ? tickets.find((t) => t.id === tb.ticketId) : undefined;
    if (cur && (cur.status === 'chamado' || cur.status === 'em_atendimento')) continue;
    tb.ticketId = null;
    if (tb.paused || !tb.artistId) continue;
    const next = q.shift();
    if (!next) continue;
    tb.ticketId = next.id;
    Object.assign(next, { status: 'chamado', table: tb.n, artistId: tb.artistId, calledAt: now });
  }
  return { event, tickets };
}

export function applyQueueOp(s: QueueState, op: QueueOp, now: number): QueueState {
  const event = clone(s.event);
  const tickets = s.tickets.map((t) => ({ ...t }));
  const tk = 'ticketId' in op ? tickets.find((t) => t.id === op.ticketId) : undefined;
  if ('ticketId' in op && !tk) throw new Error('Pedido não encontrado.');
  switch (op.type) {
    case 'pay':
      if (tk!.status !== 'aguardando_pagamento') break; // já pago: não paga duas vezes
      Object.assign(tk!, {
        status: 'na_fila',
        pay: { method: op.method, amount: tk!.flash?.price || 0, at: now },
        queueAt: now,
      });
      break;
    case 'start':
      if (tk!.status === 'chamado') Object.assign(tk!, { status: 'em_atendimento', startedAt: now });
      break;
    case 'finish':
      if (tk!.status === 'em_atendimento' || tk!.status === 'chamado')
        Object.assign(tk!, { status: 'concluido', doneAt: now });
      break;
    case 'noshow':
      if (tk!.status === 'chamado')
        Object.assign(tk!, { status: 'na_fila', queueAt: now, table: null, calledAt: null });
      break;
    case 'cancel':
      if (['aguardando_pagamento', 'na_fila', 'chamado'].includes(tk!.status)) tk!.status = 'cancelado';
      break;
    case 'requeue':
      if (tk!.status === 'cancelado')
        Object.assign(tk!, tk!.pay ? { status: 'na_fila', queueAt: now, table: null } : { status: 'aguardando_pagamento' });
      break;
    case 'pause': {
      const tb = event.tableState.find((x) => x.n === op.n);
      if (tb) tb.paused = !tb.paused;
      break;
    }
    case 'tableArtist': {
      const tb = event.tableState.find((x) => x.n === op.n);
      if (tb) tb.artistId = op.artistId || null;
      break;
    }
    case 'fill':
      break;
  }
  return fillTables({ event, tickets }, now);
}

export function makeTicket(input: TicketInput, id: string, taken: Set<string>, now: number): Ticket {
  const paid = !!input.payMethod;
  return {
    id,
    eventId: input.eventId,
    code: newCode(taken),
    createdAt: now,
    status: paid ? 'na_fila' : 'aguardando_pagamento',
    name: input.name.trim(),
    phone: input.phone,
    flash: input.flash,
    bodyPart: input.bodyPart,
    anamnese: input.anamnese,
    alerts: input.alerts,
    pay: paid ? { method: input.payMethod!, amount: input.flash.price || 0, at: now } : null,
    queueAt: paid ? now : null,
    table: null,
    artistId: null,
    calledAt: null,
    startedAt: null,
    doneAt: null,
    care: {},
    source: input.source,
    lang: input.lang,
  };
}

export function publicDoc(d: Pick<AllData, 'events' | 'tickets' | 'artists' | 'settings'>): PublicLive | null {
  const st = d.settings;
  const e = st.liveEventId ? d.events.find((x) => x.id === st.liveEventId) : undefined;
  if (!e) return null;
  const tix = d.tickets.filter((t) => t.eventId === e.id);
  const tables = (e.tableState || []).map((tb) => {
    const t = tb.ticketId ? tix.find((x) => x.id === tb.ticketId) : undefined;
    const a = tb.artistId ? d.artists.find((x) => x.id === tb.artistId) : undefined;
    return {
      n: tb.n,
      artist: a ? first(a.name) : '',
      code: t ? t.code : '',
      status: t ? t.status : tb.paused ? 'pausada' : 'livre',
      paused: !!tb.paused,
    };
  });
  const called = tix
    .filter((t) => (t.status === 'chamado' || t.status === 'em_atendimento') && t.calledAt)
    .sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0))
    .slice(0, 8)
    .map((t) => ({ code: t.code, table: t.table || 0, at: t.calledAt || 0 }));
  return {
    open: true,
    eventId: e.id,
    name: e.name,
    type: e.type,
    date: e.date,
    venue: e.venue || '',
    start: e.start || '',
    end: e.end || '',
    cats: e.cats || [],
    prices: st.prices,
    avgMin: st.avgMin || 25,
    studio: st.studioName || 'A2 Tattoo Studio',
    whatsapp: st.whatsapp || '',
    tables,
    waiting: queueOf(tix, e.id).map((t) => t.code),
    called,
  };
}

/** Recorte para o atendimento: só o evento aberto hoje. */
export function deskData(d: AllData): DeskData | null {
  const e = d.settings.liveEventId ? d.events.find((x) => x.id === d.settings.liveEventId) : undefined;
  if (!e) return null;
  const ids = new Set((e.team || []).map((m) => m.artistId));
  return {
    event: {
      id: e.id, name: e.name, type: e.type, date: e.date, start: e.start, end: e.end, venue: e.venue,
      tables: e.tables, tableState: e.tableState, cats: e.cats,
      team: (e.team || []).map((m) => ({ artistId: m.artistId, role: m.role })),
    },
    tickets: d.tickets.filter((t) => t.eventId === e.id),
    artists: d.artists.filter((a: Artist) => ids.has(a.id)).map((a) => ({ id: a.id, name: a.name, role: a.role })),
    settings: pickDeskSettings(d.settings),
  };
}

export const pickDeskSettings = (s: Settings): DeskData['settings'] => ({
  prices: s.prices, avgMin: s.avgMin, studioName: s.studioName, whatsapp: s.whatsapp, templates: s.templates,
});

/** Posição na fila (1 = próximo) e espera estimada em minutos. */
export function waitInfo(p: PublicLive | null, code: string) {
  const pos = p && p.waiting ? p.waiting.indexOf(code) + 1 : 0;
  const active = p && p.tables ? Math.max(1, p.tables.filter((x) => !x.paused && x.artist).length) : 1;
  const wait = pos ? Math.ceil(pos / active) * ((p && p.avgMin) || 25) : 0;
  return { pos, wait };
}
