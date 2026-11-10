import SEED from '../data/seed.json';
import { DEFAULT_PRICES } from '../data/constants';
import type { AllData, Settings } from '../lib/types';
import { addDays, clone, diffDays, today } from '../lib/util';

export const SEED_PIN = '2468';
/** PIN da gestão no modo demonstração (no Supabase o PIN fica embaralhado no banco). */
export const DEMO_OWNER_PIN = '135790';

export function defaultSettings(): Settings {
  return {
    studioName: 'A2 Tattoo Studio',
    owner: 'Ariana',
    whatsapp: '',
    publicUrl: '',
    avgMin: 25,
    commission: 50,
    prices: clone(DEFAULT_PRICES),
    liveEventId: null,
    templates: clone((SEED as unknown as { settings: Settings }).settings.templates),
    attendantPin: SEED_PIN,
  };
}

/** Dados de exemplo com o evento "de hoje" na data atual. */
export function seedData(now = Date.now()): AllData {
  const sd = clone(SEED) as unknown as AllData & { settings: Settings };
  const off = diffDays('2026-11-07', today());
  const sh = (d: string) => (d ? addDays(d, off) : d);
  const ms = now - Date.UTC(2026, 10, 7, 21, 50);
  for (const e of sd.events) {
    e.date = sh(e.date);
    e.createdAt += ms;
    if (e.closing?.closedAt) e.closing.closedAt += ms;
  }
  for (const a of sd.artists) a.blocked = (a.blocked || []).map(sh);
  for (const t of sd.tickets) {
    for (const k of ['createdAt', 'queueAt', 'calledAt', 'startedAt', 'doneAt'] as const) if (t[k]) t[k] = t[k]! + ms;
    if (t.pay) t.pay.at += ms;
    for (const d in t.care || {}) if (typeof t.care[d] === 'number') t.care[d] = (t.care[d] as number) + ms;
  }
  const settings: Settings = { ...defaultSettings(), ...sd.settings, attendantPin: SEED_PIN };
  delete (settings as unknown as Record<string, unknown>).id;
  return { events: sd.events, artists: sd.artists, tickets: sd.tickets, settings };
}
