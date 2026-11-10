// Modo conectado: Supabase. As regras de acesso ficam no banco
// (supabase/migrations): nenhuma tela lê as tabelas direto. A gestão usa funções
// que conferem o PIN da gestão; o atendimento e o cliente usam funções que
// devolvem só o recorte permitido.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AllData, DeskData, PublicLive, QueueOp, Ticket, TicketInput } from '../lib/types';
import type { Backend, Unsub } from './backend';
import { getOwnerPin, setOwnerPin } from './ownerPin';
import { defaultSettings } from './seed';

function poll<R>(fn: () => Promise<R>, cb: (r: R) => void, ms: number): Unsub & { now: () => void } {
  let stop = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    clearTimeout(timer);
    try {
      const r = await fn();
      if (!stop) cb(r);
    } catch {
      /* tenta de novo no próximo ciclo */
    }
    if (!stop) timer = setTimeout(tick, document.hidden ? ms * 3 : ms);
  };
  tick();
  const unsub = () => {
    stop = true;
    clearTimeout(timer);
  };
  return Object.assign(unsub, { now: () => !stop && tick() });
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
  const ownerPolls = new Set<{ now: () => void }>();
  const refresh = () => ownerPolls.forEach((p) => p.now());

  const rpc = async <R>(name: string, args: Record<string, unknown>): Promise<R> => {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(error.message);
    return data as R;
  };
  const owner = async (name: string, args: Record<string, unknown>) => {
    await rpc(name, { p_pin: getOwnerPin(), ...args });
    refresh();
  };

  return {
    mode: 'supabase',
    ownerLogin: (pin) => rpc<{ ok: boolean; wait?: number }>('a2_owner_login', { p_pin: pin }),
    async changeOwnerPin(newPin) {
      await rpc('a2_owner_set_pin', { p_pin: getOwnerPin(), p_new: newPin });
      setOwnerPin(newPin);
    },
    subscribeAll(cb) {
      const p = poll(
        async () => {
          const d = await rpc<AllData | null>('a2_owner_all', { p_pin: getOwnerPin() });
          return d ? { ...d, settings: { ...defaultSettings(), ...d.settings } } : ('denied' as const);
        },
        cb,
        3000,
      );
      ownerPolls.add(p);
      return () => {
        ownerPolls.delete(p);
        p();
      };
    },
    put: (col, id, data) => owner('a2_owner_put', { p_col: col, p_id: id, p_data: data }),
    patch: (col, id, partial) => owner('a2_owner_patch', { p_col: col, p_id: id, p_partial: partial }),
    remove: (col, id) => owner('a2_owner_remove', { p_col: col, p_id: id }),
    checkPin: (pin) => rpc<boolean>('a2_check_pin', { p_pin: pin }),
    subscribeDesk(pin, cb) {
      return poll(() => rpc<DeskData | null>('a2_desk', { p_pin: pin }), cb, 3000);
    },
    async queue(op: QueueOp, pin?: string) {
      // Sem PIN do balcão, é a gestão: usa o PIN da gestão guardado no aparelho.
      await rpc('a2_queue', { p_op: op, p_pin: pin ?? getOwnerPin() });
      refresh();
    },
    subscribePublic(cb) {
      return poll(() => rpc<PublicLive | null>('a2_public_live', {}), cb, 4000);
    },
    async submitTicket(input: TicketInput, pin?: string) {
      // Cliente pelo QR não manda PIN nenhum; balcão e gestão mandam o seu.
      const staffPin = pin ?? (input.payMethod || input.source !== 'qr' ? getOwnerPin() : null);
      const r = await rpc<{ id: string; code: string }>('a2_submit_ticket', { p_input: input, p_pin: staffPin });
      refresh();
      return r;
    },
    subscribeTicket(id, cb) {
      return poll(() => rpc<Ticket | null>('a2_get_ticket', { p_id: id }), cb, 4000);
    },
  };
}
