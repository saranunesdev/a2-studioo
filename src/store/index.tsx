import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AllData, DeskData, PublicLive, Ticket } from '../lib/types';
import type { Backend } from './backend';
import { createLocalBackend } from './local';
import { createSupabaseBackend } from './supabase';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let backend: Backend | null = null;
export function getBackend(): Backend {
  if (!backend) backend = URL && KEY ? createSupabaseBackend(URL, KEY) : createLocalBackend();
  return backend;
}

const Ctx = createContext<Backend | null>(null);
export function BackendProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={getBackend()}>{children}</Ctx.Provider>;
}
export const useBackend = () => useContext(Ctx)!;

/** undefined = carregando; 'denied' = PIN da gestão errado ou trocado. key força recarregar depois do PIN. */
export function useAll(key: string | null = null) {
  const b = useBackend();
  const [d, set] = useState<AllData | null | undefined | 'denied'>(undefined);
  useEffect(() => {
    if (!key) return;
    set(undefined);
    return b.subscribeAll(set);
  }, [b, key]);
  return d;
}
export function useDesk(pin: string | null) {
  const b = useBackend();
  const [d, set] = useState<DeskData | null | undefined>(undefined);
  useEffect(() => (pin ? b.subscribeDesk(pin, set) : undefined), [b, pin]);
  return d;
}
export function usePublic() {
  const b = useBackend();
  const [d, set] = useState<PublicLive | null | undefined>(undefined);
  useEffect(() => b.subscribePublic(set), [b]);
  return d;
}
export function useTicket(id: string | null) {
  const b = useBackend();
  const [d, set] = useState<Ticket | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    return b.subscribeTicket(id, set);
  }, [b, id]);
  return id ? d : null;
}

const PIN_KEY = 'a2-pin';
export const getPin = () => {
  try {
    return sessionStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
};
export const setPin = (p: string | null) => {
  try {
    if (p) sessionStorage.setItem(PIN_KEY, p);
    else sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
};
