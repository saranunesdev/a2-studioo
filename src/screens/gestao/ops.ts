import { useMemo } from 'react';
import { useToast } from '../../components/ui';
import type { Artist, EventDoc, Settings, Ticket } from '../../lib/types';
import { useBackend } from '../../store';

/** Gravações da gestão, com aviso em texto quando algo falha. */
export function useOps() {
  const b = useBackend();
  const toast = useToast();
  return useMemo(() => {
    const wrap = async (p: Promise<unknown>, msg?: string) => {
      try {
        await p;
        if (msg) toast(msg);
        return true;
      } catch {
        toast('Não foi possível salvar. Confira a conexão e tente de novo.');
        return false;
      }
    };
    return {
      patchEvent: (id: string, partial: Partial<EventDoc> | Record<string, unknown>, msg?: string) => wrap(b.patch('events', id, partial), msg),
      putEvent: (id: string, data: Omit<EventDoc, 'id'> | EventDoc, msg?: string) => wrap(b.put('events', id, data), msg),
      removeEvent: (id: string, msg?: string) => wrap(b.remove('events', id), msg),
      putArtist: (id: string, data: Artist, msg?: string) => wrap(b.put('artists', id, data), msg),
      removeArtist: (id: string) => wrap(b.remove('artists', id)),
      patchTicket: (id: string, partial: Partial<Ticket> | Record<string, unknown>, msg?: string) => wrap(b.patch('tickets', id, partial), msg),
      patchSettings: (partial: Partial<Settings> | Record<string, unknown>, msg?: string) => wrap(b.patch('settings', 'main', partial), msg),
    };
  }, [b, toast]);
}
export type Ops = ReturnType<typeof useOps>;

/** Monta um objeto aninhado a partir de um caminho: nest('a.b', 1) → { a: { b: 1 } }. */
export function nest(path: string, v: unknown): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const ks = path.split('.');
  let c = o;
  ks.slice(0, -1).forEach((k) => {
    c[k] = {};
    c = c[k] as Record<string, unknown>;
  });
  c[ks[ks.length - 1]] = v;
  return o;
}
