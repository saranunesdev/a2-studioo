// Modo conectado: Supabase. As regras de acesso ficam no banco
// (supabase/migrations/0001_a2.sql): a gestão lê e grava as tabelas; o
// atendimento e o cliente só usam funções que devolvem o recorte permitido.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AllData, DeskData, PublicLive, QueueOp, Ticket, TicketInput } from '../lib/types';
import { deepMerge } from '../lib/util';
import type { Backend, Col, Unsub } from './backend';
import { defaultSettings } from './seed';

const T: Record<Col, string> = { events: 'a2_events', artists: 'a2_artists', tickets: 'a2_tickets' };

function poll<R>(fn: () => Promise<R>, cb: (r: R) => void, ms: number): Unsub {
  let stop = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try {
      const r = await fn();
      if (!stop) cb(r);
    } catch {
      /* tenta de novo no próximo ciclo */
    }
    if (!stop) timer = setTimeout(tick, document.hidden ? ms * 3 : ms);
  };
  tick();
  return () => {
    stop = true;
    clearTimeout(timer);
  };
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key);

  const rpc = async <R>(name: string, args: Record<string, unknown>): Promise<R> => {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(error.message);
    return data as R;
  };
  const fetchAll = async (): Promise<AllData> => {
    const [ev, ar, tk, st] = await Promise.all([
      sb.from(T.events).select('id,data'),
      sb.from(T.artists).select('id,data'),
      sb.from(T.tickets).select('id,data'),
      sb.from('a2_settings').select('data').eq('id', 'main').maybeSingle(),
    ]);
    const err = ev.error || ar.error || tk.error || st.error;
    if (err) throw new Error(err.message);
    const rows = <X>(r: { data: { id: string; data: X }[] | null }) => (r.data || []).map((x) => ({ ...x.data, id: x.id }));
    return {
      events: rows(ev as never),
      artists: rows(ar as never),
      tickets: rows(tk as never),
      settings: { ...defaultSettings(), ...((st.data?.data as object) || {}) },
    };
  };

  return {
    mode: 'supabase',
    async ownerSignedIn() {
      const { data } = await sb.auth.getSession();
      return !!data.session;
    },
    async ownerSignIn(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/painel' } });
      if (error) throw new Error(error.message);
      return 'sent';
    },
    async signOut() {
      await sb.auth.signOut();
    },
    subscribeAll(cb) {
      let alive = true;
      let t: ReturnType<typeof setTimeout>;
      const load = () => fetchAll().then((d) => alive && cb(d)).catch(() => alive && cb(null));
      const later = () => {
        clearTimeout(t);
        t = setTimeout(load, 250);
      };
      load();
      const ch = sb.channel('a2-all');
      for (const table of [...Object.values(T), 'a2_settings'])
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, later);
      ch.subscribe();
      return () => {
        alive = false;
        sb.removeChannel(ch);
      };
    },
    async put(col, id, data) {
      const d = { ...(data as Record<string, unknown>) };
      delete d.id;
      const { error } = await sb.from(T[col]).upsert({ id, data: d });
      if (error) throw new Error(error.message);
    },
    async patch(col, id, partial) {
      const table = col === 'settings' ? 'a2_settings' : T[col];
      const key = col === 'settings' ? 'main' : id;
      const { data, error } = await sb.from(table).select('data').eq('id', key).maybeSingle();
      if (error) throw new Error(error.message);
      const cur = (data?.data as object) || (col === 'settings' ? defaultSettings() : null);
      if (!cur) throw new Error('não encontrado');
      const { error: e2 } = await sb.from(table).upsert({ id: key, data: deepMerge(cur, partial) });
      if (e2) throw new Error(e2.message);
    },
    async remove(col, id) {
      const { error } = await sb.from(T[col]).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    checkPin: (pin) => rpc<boolean>('a2_check_pin', { p_pin: pin }),
    subscribeDesk(pin, cb) {
      return poll(() => rpc<DeskData | null>('a2_desk', { p_pin: pin }), cb, 3000);
    },
    async queue(op: QueueOp, pin?: string) {
      await rpc('a2_queue', { p_op: op, p_pin: pin ?? null });
    },
    subscribePublic(cb) {
      return poll(() => rpc<PublicLive | null>('a2_public_live', {}), cb, 4000);
    },
    submitTicket: (input: TicketInput, pin?: string) =>
      rpc<{ id: string; code: string }>('a2_submit_ticket', { p_input: input, p_pin: pin ?? null }),
    subscribeTicket(id, cb) {
      return poll(() => rpc<Ticket | null>('a2_get_ticket', { p_id: id }), cb, 4000);
    },
  };
}
