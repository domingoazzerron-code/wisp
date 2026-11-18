// Pure challenge logic (legacy CHT, dayState, chalStates, endChal rules).
// No DOM, no store writes.

import type { Challenge, ChallengeResult, State } from '../state/types.ts';
import { dayAdd, startOfDay } from './dates.ts';
import { limFor } from './limits.ts';
import type { LogIndex } from './logindex.ts';
import { cravIn } from './missions.ts';

export type ChallengeId = 'gap45' | 'gap90' | 'lim' | 'morn' | 'crav';
export type DayState = 'ok' | 'fail' | 'pend' | 'fut';

export interface ChallengeDef {
  n: string;
  d: string;
  /** Gap threshold in minutes (gap45 / gap90 only). */
  t?: number;
}

export const CHT: Record<ChallengeId, ChallengeDef> = {
  gap45: { n: 'Every gap above 45 minutes', d: 'Leave at least 45 minutes between cigarettes, every day.', t: 45 },
  gap90: { n: 'Every gap above 90 minutes', d: 'Leave at least 90 minutes between cigarettes, every day.', t: 90 },
  lim: { n: 'Stay within your limit', d: 'End each day at or under your limit.' },
  morn: { n: 'Skip the morning ones', d: 'No cigarettes before 12 pm, every day.' },
  crav: { n: 'Beat a craving a day', d: 'Wait out or log at least one craving, every day.' },
};

export const CHK: ChallengeId[] = ['gap45', 'gap90', 'lim', 'morn', 'crav'];

export interface ChalCtx {
  now: number;
  idx: LogIndex;
  cravs: readonly number[];
  limitForDay: (day: number) => number;
}

/**
 * State of one challenge day (legacy dayState).
 * d = day start, td = today start.
 */
export function dayState(id: ChallengeId, d: number, td: number, ctx: ChalCtx): DayState {
  if (d > td) return 'fut';
  const a = ctx.idx.sorted().slice(ctx.idx.lowerBound(d), ctx.idx.lowerBound(dayAdd(d, 1)));
  const past = d < td;
  const T = CHT[id];

  if (T.t) {
    for (let i = 1; i < a.length; i++) {
      if (a[i] - a[i - 1] < T.t! * 6e4) return 'fail';
    }
    return past ? 'ok' : 'pend';
  }
  if (id === 'lim') {
    return a.length > ctx.limitForDay(d) ? 'fail' : past ? 'ok' : 'pend';
  }
  if (id === 'morn') {
    for (let i = 0; i < a.length; i++) {
      if (new Date(a[i]).getHours() < 12) return 'fail';
    }
    return past || new Date(ctx.now).getHours() >= 12 ? 'ok' : 'pend';
  }
  if (id === 'crav') {
    return cravIn(ctx.cravs, d, dayAdd(d, 1)) > 0 ? 'ok' : past ? 'fail' : 'pend';
  }
  return 'pend';
}

/** One DayState per challenge day (legacy chalStates). */
export function chalStates(c: Challenge, ctx: ChalCtx): DayState[] {
  const td = startOfDay(ctx.now);
  const o: DayState[] = [];
  for (let i = 0; i < c.days; i++) {
    o.push(dayState(c.id as ChallengeId, dayAdd(c.start, i), td, ctx));
  }
  return o;
}

/** Star reward for finishing a challenge (legacy endChal). */
export function chalStarReward(days: number): number {
  return days >= 7 ? 25 : 10;
}

export interface EndChalPatch {
  chal: Challenge;
  cres: ChallengeResult;
  badges?: Record<string, number>;
  stars?: number;
  earned?: number;
  cel?: { t: number; txt: string };
  ok: boolean;
  toast?: string;
}

/**
 * Build the state patch when a challenge ends (success or fail).
 * Caller applies it and handles buzz / clearPoke / alertBox(SWAP 6d).
 */
export function endChalPatch(
  c: Challenge,
  ok: boolean,
  now: number,
  stars: number,
  earned: number,
  badges: Record<string, number>,
): EndChalPatch {
  const k = c.id + '-' + c.days;
  const T = CHT[c.id as ChallengeId];
  const empty: Challenge = { id: '', days: 0, start: 0, grace: 0 };
  if (ok && T) {
    const st = chalStarReward(c.days);
    return {
      chal: empty,
      cres: { k, ok: 1, t: now, s: st },
      badges: { ...badges, [k]: now },
      stars: stars + st,
      earned: earned + st,
      cel: { t: now, txt: 'Challenge complete: ' + T.n + '. I’m so proud of you.' },
      ok: true,
      toast: 'Challenge complete. +' + st + ' stars',
    };
  }
  return {
    chal: empty,
    cres: { k, ok: 0, t: now, s: 0 },
    ok: false,
  };
}

/**
 * Whether the active challenge just ended (success or fail).
 * Does not mutate. Returns null if still running or nothing active.
 * Legacy skips fail-end while a cigarette was logged in the last 2 minutes.
 */
export function challengeEnded(
  c: Challenge,
  ctx: ChalCtx,
  lastTs: number,
): { ok: boolean } | null {
  if (!c || !c.id || !CHT[c.id as ChallengeId]) return null;
  const st = chalStates(c, ctx);
  let miss = 0, open = 0;
  for (const x of st) {
    if (x === 'fail') miss++;
    else if (x === 'pend' || x === 'fut') open++;
  }
  if (miss > c.grace) {
    if (lastTs && ctx.now - lastTs < 12e4) return null; // wait 2 min after a log
    return { ok: false };
  }
  if (open === 0) return { ok: true };
  return null;
}

/** Whether today already fails this challenge id (used to start tomorrow). */
export function todayFails(id: ChallengeId, ctx: ChalCtx): boolean {
  const td = startOfDay(ctx.now);
  return dayState(id, td, td, ctx) === 'fail';
}

export function chalCtx(
  s: Pick<State, 'cravs' | 'limit' | 'limH' | 'plan'>,
  idx: LogIndex,
  now: number,
): ChalCtx {
  return {
    now,
    idx,
    cravs: s.cravs || [],
    limitForDay: (day) => limFor(s, day),
  };
}

export interface ActiveChalView {
  name: string;
  desc: string;
  dayLabel: string; // "Day 2 of 7" or "Starts tomorrow"
  dots: DayState[];
  okCount: number;
  miss: number;
  graceNote: string;
}

export function activeChalView(c: Challenge, ctx: ChalCtx): ActiveChalView | null {
  const T = CHT[c.id as ChallengeId];
  if (!T) return null;
  const st = chalStates(c, ctx);
  const td = startOfDay(ctx.now);
  const di = Math.max(1, Math.min(c.days, Math.round((td - c.start) / 864e5) + 1));
  let miss = 0, okn = 0;
  for (const x of st) {
    if (x === 'fail') miss++;
    if (x === 'ok') okn++;
  }
  let graceNote = '';
  if (c.grace) {
    graceNote = miss < c.grace ? ' You have 1 grace day.' : ' Your grace day is used.';
  }
  return {
    name: T.n,
    desc: T.d,
    dayLabel: td < c.start ? 'Starts tomorrow' : 'Day ' + di + ' of ' + c.days,
    dots: st,
    okCount: okn,
    miss,
    graceNote,
  };
}
