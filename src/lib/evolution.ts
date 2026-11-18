// Pure Wisp evolution (legacy evoInfo, FORM, EVT) and outfit unlock rules (hasOutfit).

import type { Outfit, State } from '../state/types.ts';
import {
  OUTFIT_MIN_STAGE, OUTFIT_PRICE, OUTFITS, OUTFIT_TEXT, STAGES,
} from '../state/defaults.ts';
import { dayAdd, startOfDay } from './dates.ts';
import type { LogIndex } from './logindex.ts';
import { cntBetween } from './streaks.ts';

/** Form names by evolution stage 0..5 (legacy FORM / STG). */
export const FORM = STAGES;

/** Ratio thresholds for stages 1..4; stage 5 = avg === 0 (legacy EVT). */
export const EVT = [0, 1, 0.75, 0.5, 0.25] as const;

/** Short growth phrase used in the evolve alert (legacy checkEvo). */
export const GREW = ['', 'a sprout', 'a glow', 'wings', 'a halo', 'a radiant sparkle'] as const;

export interface EvoInfo {
  /** 7-day average cigs/day, or null when not yet eligible. */
  avg: number | null;
  /** Highest stage the averages currently unlock (0..5). */
  st: number;
}

/**
 * Current evolution readiness from the last 7 full days (legacy evoInfo).
 * Needs at least 7 days of history (first log day ≤ today−7) and base > 0.
 * avg is over [today−7, today) — the last 7 complete days, not including today.
 */
export function evoInfo(
  idx: LogIndex,
  base: number,
  now: number,
): EvoInfo {
  const td = startOfDay(now);
  const first = idx.sorted().length ? startOfDay(idx.first()) : 0;
  if (!first || first > dayAdd(td, -7) || !(base > 0)) return { avg: null, st: 0 };
  const avg = cntBetween(idx, dayAdd(td, -7), td) / 7;
  const r = avg / base;
  const st = avg === 0 ? 5 : r <= 0.25 ? 4 : r <= 0.5 ? 3 : r <= 0.75 ? 2 : r < 1 ? 1 : 0;
  return { avg, st };
}

/** True when the outfit is free, already owned, or unlocked by evolution stage. */
export function hasOutfit(
  id: Outfit,
  owned: readonly Outfit[],
  evo: number,
): boolean {
  if (!OUTFIT_PRICE[id]) return true; // free (none + free hats)
  if (owned.indexOf(id) > -1) return true;
  const min = OUTFIT_MIN_STAGE[id];
  if (min !== undefined && min <= evo) return true;
  return false;
}

/** Display name for wardrobe buttons (legacy ONAME). */
export const OUTFIT_NAME: Record<Outfit, string> = {
  none: 'Classic',
  beanie: 'Beanie',
  party: 'Party hat',
  wizard: 'Wizard hat',
  shades: 'Shades',
  scarf: 'Scarf',
  bow: 'Bow tie',
  flower: 'Flower crown',
  headphones: 'Headphones',
  crown: 'Crown',
  cape: 'Cape',
  tophat: 'Top hat',
  catears: 'Cat ears',
  sparkles: 'Sparkles',
};

export { OUTFITS, OUTFIT_PRICE, OUTFIT_MIN_STAGE, OUTFIT_TEXT, STAGES };

/** Banner title: "Wisp" or "Wisp · Sprout" (legacy renderMascot bn). */
export function formLabel(evo: number): string {
  const es = evo || 0;
  return es ? 'Wisp · ' + FORM[es] : 'Wisp';
}

/** Clamp a saved outfit to one the user can wear; falls back to none. */
export function sanitizeOutfit(outfit: Outfit, owned: readonly Outfit[], evo: number): Outfit {
  return hasOutfit(outfit, owned, evo) ? outfit : 'none';
}
