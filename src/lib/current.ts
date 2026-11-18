// Convenience wrappers bound to the live store (getState() + its cached log helpers) and the real clock.
// Views call these; the pure functions in the sibling files are what the tests exercise.

import { dayCounts, firstTs, getState, lowerBound, sortedLog } from '../state/index.ts';
import { limFor, lim as limPure, planSched as planSchedPure, setLimit as setLimitPure } from './limits.ts';
import type { LogIndex } from './logindex.ts';
import * as st from './streaks.ts';
import { startOfDay } from './dates.ts';

/** LogIndex over the live store's cached helpers (valid until the next save()). */
export const liveIndex: LogIndex = {
  sorted: sortedLog,
  counts: dayCounts,
  lowerBound,
  first: firstTs,
  last: () => { const a = sortedLog(); return a.length ? a[a.length - 1] : 0; },
};

export const lastTs = (): number => liveIndex.last();
export const lim = (): number => limPure(getState(), Date.now());
export const limitForDay = (day: number): number => limFor(getState(), day);
export const setLimit = (v: number): void => setLimitPure(getState(), v, Date.now());
export const planSched = () => planSchedPure(getState());
export const streak = (): number => st.streak(getState(), liveIndex, Date.now());
export const bestStreak = (): number => st.bestStreak(getState(), liveIndex, Date.now());
export const countSince = (days: number): number => st.countSince(liveIndex, days, Date.now());
export const monthCount = (): number => st.monthCount(liveIndex, Date.now());
export const calcSaved = (): number => st.calcSaved(getState(), liveIndex, Date.now());
export const gapBase = (): number => st.gapBase(getState(), liveIndex);
export const gapLeft = (): number => st.gapLeft(getState(), liveIndex, Date.now());
export const today = (): number => startOfDay(Date.now());
