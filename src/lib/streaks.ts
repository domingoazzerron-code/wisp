// Counts, streaks, savings and gap timing (legacy streak, bestStreak, countSince, monthCount,
// calcSaved, per, cntBetween, gapBase, gapLeft). Pure: state, a LogIndex and "now" are parameters.

import type { State } from '../state/types.ts';
import { dayAdd, startOfDay, DAY_MS } from './dates.ts';
import { limFor } from './limits.ts';
import type { LogIndex } from './logindex.ts';

/** Price of one cigarette (0 when pack size or price is not set). */
export function per(s: Pick<State, 'pack' | 'per'>): number {
  return s.pack > 0 && s.per > 0 ? s.pack / s.per : 0;
}

/** Cigarettes logged in the last `days` calendar days, today included (days=1 means today). */
export function countSince(idx: LogIndex, days: number, now: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1)).getTime();
  return idx.sorted().length - idx.lowerBound(start);
}

/** Cigarettes logged since the 1st of the current month. */
export function monthCount(idx: LogIndex, now: number): number {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return idx.sorted().length - idx.lowerBound(start);
}

/** Entries in [a, b). */
export function cntBetween(idx: LogIndex, a: number, b: number): number {
  return idx.lowerBound(b) - idx.lowerBound(a);
}

/** Consecutive days (ending today, max 365) at or under the limit. */
export function streak(s: Pick<State, 'log' | 'limH' | 'limit' | 'plan'>, idx: LogIndex, now: number): number {
  if (!s.log.length) return 0;
  const first = startOfDay(idx.first());
  const cnt = idx.counts();
  let n = 0;
  let day = startOfDay(now);
  while (day >= first && n < 365) {
    if ((cnt[day] || 0) > limFor(s, day)) break;
    n++;
    day = dayAdd(day, -1);
  }
  return n;
}

/** Longest run of days at or under the limit since the first log entry. */
export function bestStreak(s: Pick<State, 'log' | 'limH' | 'limit' | 'plan'>, idx: LogIndex, now: number): number {
  if (!s.log.length) return 0;
  const cnt = idx.counts();
  const end = startOfDay(now);
  let day = startOfDay(idx.first());
  let run = 0;
  let best = 0;
  let g = 0;
  while (day <= end && g++ < 1500) {
    if ((cnt[day] || 0) > limFor(s, day)) run = 0;
    else {
      run++;
      if (run > best) best = run;
    }
    day = dayAdd(day, 1);
  }
  return best;
}

/** Whole days from the first logged day to today, inclusive (0 when nothing is logged). */
export function trackedDays(s: Pick<State, 'log'>, idx: LogIndex, now: number): number {
  if (!s.log.length) return 0;
  return Math.round((startOfDay(now) - startOfDay(idx.first())) / DAY_MS) + 1;
}

/** Money saved versus the baseline (legacy calcSaved, which stored this in a global). Never negative. */
export function calcSaved(s: Pick<State, 'log' | 'base' | 'pack' | 'per'>, idx: LogIndex, now: number): number {
  if (!s.log.length) return 0;
  const days = trackedDays(s, idx, now);
  return Math.max(0, (s.base * days - s.log.length) * per(s));
}

/** Timestamp the gap timer counts from: the last log entry or the manual gap start, whichever is later. */
export function gapBase(s: Pick<State, 'gapFrom'>, idx: LogIndex): number {
  return Math.max(idx.last(), s.gapFrom || 0);
}

/** Milliseconds left of the minimum gap (<= 0 or 0 when the gap is over or not in use). */
export function gapLeft(s: Pick<State, 'gap' | 'gapFrom'>, idx: LogIndex, now: number): number {
  const l = gapBase(s, idx);
  return s.gap > 0 && l ? l + s.gap * 6e4 - now : 0;
}
