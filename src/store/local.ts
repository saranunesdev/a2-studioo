// Modo demonstração: os dados ficam no navegador (localStorage).
// Abas e janelas do mesmo aparelho ficam sincronizadas (BroadcastChannel),
// e as operações da fila usam Web Locks para nunca chamar o mesmo cliente duas vezes.
import { applyQueueOp, deskData, fillTables, makeTicket, publicDoc } from '../lib/queue';
import type { AllData, QueueOp, Ticket, TicketInput } from '../lib/types';
import { clone, deepMerge, secretId } from '../lib/util';
import type { Backend, Col, Unsub } from './backend';
import { getOwnerPin, setOwnerPin } from './ownerPin';
import { DEMO_OWNER_PIN, defaultSettings, seedData } from './seed';

const KEY = 'a2-studio-v1';

interface Raw {
  events: Record<string, AllData['events'][number]>;
  artists: Record<string, AllData['artists'][number]>;
  tickets: Record<string, Ticket>;
  settings: AllData['settings'];
}

const toRaw = (d: AllData): Raw => ({
  events: Object.fromEntries(d.events.map((e) => [e.id, e])),
  artists: Object.fromEntries(d.artists.map((a) => [a.id, a])),
  tickets: Object.fromEntries(d.tickets.map((t) => [t.id, t])),
  settings: d.settings,
});
const toAll = (r: Raw): AllData => ({
  events: Object.entries(r.events).map(([id, e]) => ({ ...e, id })),
  artists: Object.entries(r.artists).map(([id, a]) => ({ ...a, id })),
  tickets: Object.entries(r.tickets).map(([id, t]) => ({ ...t, id })),
  settings: { ...defaultSettings(), ...r.settings },
});

export function createLocalBackend(): Backend {
  let raw: Raw;
  const subs = new Set<() => void>();
  let bc: BroadcastChannel | null = null;

  const read = () => {
    try {
      const s = localStorage.getItem(KEY);
      raw = s ? JSON.parse(s) : toRaw(seedData());
      if (!s) localStorage.setItem(KEY, JSON.stringify(raw));
    } catch {
      raw = raw || toRaw(seedData());
    }
  };
  const emit = () => subs.forEach((f) => f());
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch {
      /* sem espaço */
    }
    try {
      bc?.postMessage(1);
    } catch {
      /* ignore */
    }
    emit();
  };
  read();
  try {
    bc = new BroadcastChannel('a2-studio');
    bc.onmessage = () => {
      read();
      emit();
    };
  } catch {
    /* navegador antigo */
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      read();
      emit();
    }
  });

  const watch = (f: () => void): Unsub => {
    subs.add(f);
    setTimeout(f, 0);
    return () => subs.delete(f);
  };
  const withLock = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) return locks.request('a2-queue', async () => {
      read();
      return fn();
    });
    read();
    return fn();
  };
  const pinOk = (pin?: string) => !!pin && pin === raw.settings.attendantPin;
  const ownerPinOf = () => raw.settings.ownerPin || DEMO_OWNER_PIN;

  return {
    mode: 'local',
    async ownerLogin(pin) {
      read();
      return { ok: pin === ownerPinOf() };
    },
    async changeOwnerPin(newPin) {
      read();
      if (getOwnerPin() !== ownerPinOf()) throw new Error('Sem acesso.');
      raw.settings.ownerPin = newPin;
      setOwnerPin(newPin);
      write();
    },
    subscribeAll(cb) {
      return watch(() => cb(getOwnerPin() === ownerPinOf() ? toAll(clone(raw)) : 'denied'));
    },
    async put(col: Col, id, data) {
      read();
      const d = clone(data) as Record<string, unknown>;
      delete d.id;
      (raw[col] as Record<string, unknown>)[id] = d;
      write();
    },
    async patch(col, id, partial) {
      read();
      if (col === 'settings') deepMerge(raw.settings, partial);
      else {
        const cur = (raw[col] as Record<string, object>)[id];
        if (!cur) throw new Error('não encontrado');
        deepMerge(cur, partial);
      }
      write();
    },
    async remove(col, id) {
      read();
      delete (raw[col] as Record<string, unknown>)[id];
      write();
    },
    async resetDemo() {
      raw = toRaw(seedData());
      write();
    },
    async wipe() {
      raw = { events: {}, artists: {}, tickets: {}, settings: defaultSettings() };
      write();
    },
    async checkPin(pin) {
      read();
      return pinOk(pin);
    },
    subscribeDesk(pin, cb) {
      return watch(() => cb(pinOk(pin) ? deskData(toAll(clone(raw))) : null));
    },
    async queue(op: QueueOp, pin?: string) {
      await withLock(() => {
        if (pin !== undefined && !pinOk(pin)) throw new Error('PIN inválido.');
        const evId =
          'eventId' in op ? op.eventId : raw.tickets[(op as { ticketId: string }).ticketId]?.eventId;
        const ev = evId && raw.events[evId];
        if (!ev) throw new Error('Evento não encontrado.');
        const all = toAll(raw);
        const next = applyQueueOp(
          { event: { ...ev, id: evId }, tickets: all.tickets.filter((t) => t.eventId === evId) },
          op,
          Date.now(),
        );
        raw.events[evId] = next.event;
        for (const t of next.tickets) raw.tickets[t.id] = t;
        write();
      });
    },
    subscribePublic(cb) {
      return watch(() => cb(publicDoc(toAll(clone(raw)))));
    },
    async submitTicket(input: TicketInput, pin?: string) {
      return withLock(() => {
        if (pin !== undefined && !pinOk(pin)) throw new Error('PIN inválido.');
        if (raw.settings.liveEventId !== input.eventId) throw new Error('Este evento não está aberto.');
        const all = toAll(raw);
        const taken = new Set(all.tickets.filter((t) => t.eventId === input.eventId).map((t) => t.code));
        const id = secretId();
        const t = makeTicket(input, id, taken, Date.now());
        raw.tickets[id] = t;
        if (t.status === 'na_fila') {
          const ev = raw.events[input.eventId];
          const next = fillTables(
            { event: { ...ev, id: input.eventId }, tickets: toAll(raw).tickets.filter((x) => x.eventId === input.eventId) },
            Date.now(),
          );
          raw.events[input.eventId] = next.event;
          for (const x of next.tickets) raw.tickets[x.id] = x;
        }
        write();
        return { id, code: t.code };
      });
    },
    subscribeTicket(id, cb) {
      return watch(() => {
        const t = raw.tickets[id];
        cb(t ? { ...clone(t), id } : null);
      });
    },
  };
}
