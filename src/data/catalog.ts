import { CELLS } from './flashes';
import { SHEET_META } from './sheets';
import type { Tier } from '../lib/types';

export { CELLS, SHEET_META };

export interface Design {
  s: number;
  n: number;
  cats: string[];
  tier: Tier;
}

export const DESIGNS: Design[] = [];
CELLS.forEach((cs, s) =>
  cs.forEach((_, i) => DESIGNS.push({ s, n: i + 1, cats: SHEET_META[s][1], tier: SHEET_META[s][2] })),
);

export const sheetUrl = (s: number) => `/flash/prancha-${String(s).padStart(2, '0')}.webp`;
export const sheetName = (s: number) => SHEET_META[s]?.[0] ?? 'Flash';
