// Pure daily-mission logic (legacy MIS, misPool, misNew, misPick, ensureMission, checkMission rules,
// gapNow, usualGap, nToday, tagCount, mornHabit). No DOM, no store writes.

import type { Mission, State } from '../state/types.ts';
import { dayAdd, startOfDay } from './dates.ts';
import { dur } from './format.ts';
import type { LogIndex } from './logindex.ts';
import { limFor } from './limits.ts';

export type MissionId =
  | 'gap' | 'morn' | 'eve' | 'crav' | 'trig'
  | 'water' | 'breathe' | 'walk' | 'skipmeal';

export interface MissionDef {
  s: number;                 // star reward
  man?: 1;                   // 1 = manual "Mark done"
  t: (m: Mission) => string; // title
  d: string;                 // description
  ok?: (m: Mission, ctx: MissionCtx) => boolean;
  bad?: (m: Mission, ctx: MissionCtx) => boolean;
  pr?: (m: Mission, ctx: MissionCtx) => string; // progress line
}

export interface MissionCtx {
  now: number;
  idx: LogIndex;
  log: readonly number[];
  cravs: readonly number[];
  tags: Record<string, string>;
  crt: Record<string, string>;
  limit: number;
}

/** Minutes as "15 minutes", "1 hour", "1h 30m", "2 hours". */
export function mins(p: number): string {
  if (p < 60) return p + ' minutes';
  if (p % 60) return Math.floor(p / 60) + 'h ' + (p % 60) + 'm';
  return p === 60 ? '1 hour' : p / 60 + ' hours';
}

/** Cigarettes today whose hour passes fn (legacy nToday). */
export function nToday(idx: LogIndex, now: number, fn: (hour: number) => boolean): number {
  const td = startOfDay(now);
  const a = idx.sorted();
  let c = 0;
  for (let i = idx.lowerBound(td); i < a.length; i++) {
    if (fn(new Date(a[i]).getHours())) c++;
  }
  return c;
}

export function bef(h: number): boolean { return h < 12; }
export function bef6(h: number): boolean { return h < 18; }

/** Number of cravings logged in [a, b) (legacy cravIn). */
export function cravIn(cravs: readonly number[], a: number, b: number): number {
  let c = 0;
  for (const t of cravs) if (t >= a && t < b) c++;
  return c;
}

/** Entries/cravings today that already have a trigger tag (legacy tagCount). */
export function tagCount(
  log: readonly number[], cravs: readonly number[],
  tags: Record<string, string>, crt: Record<string, string>,
  now: number,
): number {
  const td = startOfDay(now);
  const e = dayAdd(td, 1);
  let n = 0;
  for (const t of log) if (t >= td && t < e && tags[String(t)]) n++;
  for (const t of cravs) if (t >= td && t < e && crt[String(t)]) n++;
  return n;
}

/**
 * Average same-day gap over the last 14 days (legacy usualGap).
 * Only gaps ≤ 12 h count. Returns 0 when none.
 */
export function usualGap(idx: LogIndex, now: number): number {
  const a = idx.sorted();
  const from = Math.max(1, idx.lowerBound(now - 14 * 864e5));
  let s = 0, c = 0;
  for (let i = from; i < a.length; i++) {
    if (startOfDay(a[i]) !== startOfDay(a[i - 1])) continue;
    const g = a[i] - a[i - 1];
    if (g <= 432e5) { s += g; c++; }
  }
  return c ? s / c : 0;
}

/**
 * Longest gap since mission start `m.t`, including the open gap to `now` (legacy gapNow).
 */
export function gapNow(idx: LogIndex, m: Mission, now: number): number {
  const a = idx.sorted();
  let prev = m.t, best = 0;
  for (let j = idx.lowerBound(m.t); j < a.length; j++) {
    best = Math.max(best, a[j] - prev);
    prev = a[j];
  }
  return Math.max(best, now - prev);
}

/** At least 2 of the last 7 days had a cigarette before noon (legacy mornHabit). */
export function mornHabit(idx: LogIndex, now: number): boolean {
  const td = startOfDay(now);
  const a = idx.sorted();
  let c = 0;
  for (let i = 1; i <= 7; i++) {
    const d = dayAdd(td, -i);
    const end = dayAdd(d, 1);
    for (let j = idx.lowerBound(d); j < a.length && a[j] < end; j++) {
      if (new Date(a[j]).getHours() < 12) { c++; break; }
    }
  }
  return c >= 2;
}

export const MIS: Record<MissionId, MissionDef> = {
  gap: {
    s: 4,
    t: (m) => 'Wait ' + mins(m.p) + ' before the next one',
    d: 'A bit longer than your usual gap.',
    ok: (m, ctx) => gapNow(ctx.idx, m, ctx.now) >= m.p * 6e4,
    pr: (m, ctx) => 'So far: ' + dur(gapNow(ctx.idx, m, ctx.now)) + '.',
  },
  morn: {
    s: 4,
    t: () => 'Skip the morning one',
    d: 'No cigarettes before 12 pm. Wisp checks at noon.',
    ok: (_m, ctx) => new Date(ctx.now).getHours() >= 12 && nToday(ctx.idx, ctx.now, bef) === 0,
    bad: (_m, ctx) => nToday(ctx.idx, ctx.now, bef) > 0,
  },
  eve: {
    s: 3,
    t: (m) => m.p ? 'Keep it to ' + m.p + ' or fewer before 6 pm' : 'No cigarettes before 6 pm',
    d: 'Wisp checks at 6 pm.',
    ok: (m, ctx) => new Date(ctx.now).getHours() >= 18 && nToday(ctx.idx, ctx.now, bef6) <= m.p,
    bad: (m, ctx) => nToday(ctx.idx, ctx.now, bef6) > m.p,
    pr: (_m, ctx) => 'So far: ' + nToday(ctx.idx, ctx.now, bef6) + '.',
  },
  crav: {
    s: 3,
    t: () => 'Get through one craving today',
    d: 'Start the 10 minute wait on Today, or log one you beat.',
    ok: (m, ctx) => {
      const td = startOfDay(ctx.now);
      return cravIn(ctx.cravs, td, dayAdd(td, 1)) > (m.b || 0);
    },
  },
  trig: {
    s: 2,
    t: () => 'Tell Wisp what set one off',
    d: 'Add a trigger to any entry or craving from today.',
    ok: (m, ctx) => tagCount(ctx.log, ctx.cravs, ctx.tags, ctx.crt, ctx.now) > (m.b || 0),
  },
  water: {
    s: 2, man: 1,
    t: () => 'Drink a glass of water when a craving hits',
    d: 'Sip it slowly. Tap done when you have.',
  },
  breathe: {
    s: 2, man: 1,
    t: () => 'Take 5 slow breaths',
    d: 'In for 4, hold for 4, out for 6.',
  },
  walk: {
    s: 2, man: 1,
    t: () => 'Take a 5 minute walk',
    d: 'Fresh air counts. Tap done when you are back.',
  },
  skipmeal: {
    s: 3, man: 1,
    t: () => 'Skip the one right after a meal',
    d: 'Brush your teeth or leave the table instead.',
  },
};

/** Mission ids that can be offered right now (legacy misPool). */
export function misPool(ctx: Pick<MissionCtx, 'now' | 'idx' | 'log' | 'limit'>): MissionId[] {
  const h = new Date(ctx.now).getHours();
  const has = ctx.log.length >= 3;
  const p: MissionId[] = ['crav', 'water', 'breathe', 'walk'];
  if (has) p.push('trig', 'skipmeal');
  if (has && ctx.limit > 0) p.push('gap');
  if (has && h < 11 && mornHabit(ctx.idx, ctx.now)) p.push('morn');
  if (has && ctx.limit > 0 && h < 14) p.push('eve');
  return p;
}

/** Build a fresh Mission for id (legacy misNew). */
export function misNew(
  id: MissionId,
  sw: number,
  ctx: Pick<MissionCtx, 'now' | 'idx' | 'log' | 'cravs' | 'tags' | 'crt' | 'limit'>,
): Mission {
  const td0 = startOfDay(ctx.now);
  const m: Mission = {
    day: td0, id, p: 0, t: ctx.now, done: 0, sw: sw || 0, man: 0, b: 0,
  };
  if (id === 'crav') m.b = cravIn(ctx.cravs, td0, dayAdd(td0, 1));
  else if (id === 'trig') m.b = tagCount(ctx.log, ctx.cravs, ctx.tags, ctx.crt, ctx.now);
  if (id === 'gap') {
    const u = usualGap(ctx.idx, ctx.now);
    m.p = u ? Math.min(180, Math.max(15, Math.round(u * 1.1 / 9e5) * 15)) : 30;
  } else if (id === 'eve') {
    m.p = Math.floor(Math.max(ctx.limit, 0) / 2);
  }
  return m;
}

/** Deterministic pick among the pool, excluding prev (legacy misPick). */
export function misPick(
  prev: string | undefined,
  sw: number,
  misN: number,
  ctx: Pick<MissionCtx, 'now' | 'idx' | 'log' | 'limit'>,
): MissionId {
  let p = misPool(ctx).filter((x) => x !== prev) as MissionId[];
  if (!p.length) p = ['crav'];
  const n = Math.floor(startOfDay(ctx.now) / 864e5);
  return p[((n * 2654435761 + sw * 40503 + (misN || 0) * 97) >>> 0) % p.length];
}

/**
 * Ensure S.mis is for today and still a known id. Returns the (possibly new) mission.
 * Caller must write it back and save if it changed.
 */
export function ensureMission(
  mis: Mission,
  misN: number,
  ctx: MissionCtx,
): { mis: Mission; changed: boolean } {
  const td = startOfDay(ctx.now);
  if (mis && mis.day === td && MIS[mis.id as MissionId]) return { mis, changed: false };
  const prev = mis && mis.id;
  const id = misPick(prev, 0, misN, ctx);
  return { mis: misNew(id, 0, ctx), changed: true };
}

export interface MissionView {
  title: string;
  sub: string;
  done: boolean;
  bad: boolean;
  stars: number;
  canSwap: boolean;
  canMark: boolean;
  reward: number;
}

/** What the mission card should show (legacy renderMission text/buttons). */
export function missionView(m: Mission, ctx: MissionCtx): MissionView | null {
  const D = MIS[m.id as MissionId];
  if (!D) return null;
  const done = !!m.done;
  const bad = !done && !!D.bad && D.bad(m, ctx);
  let sub: string;
  if (done) sub = 'Done. +' + D.s + ' stars. Wisp picks a new one tomorrow.';
  else if (bad) sub = 'That one slipped by, and that’s okay.' + (m.sw < 1 ? ' Want a different one?' : ' A fresh mission tomorrow.');
  else sub = D.d + (D.pr ? ' ' + D.pr(m, ctx) : '') + ' Reward: ' + D.s + ' stars.';
  return {
    title: (done ? '✓ ' : '') + D.t(m),
    sub,
    done,
    bad,
    stars: 0, // filled by caller from state
    canSwap: !done && !bad && m.sw < 1 || (bad && m.sw < 1),
    canMark: !done && !bad && !!D.man,
    reward: D.s,
  };
}

/**
 * Whether the current mission is complete right now (auto or manual).
 * Does not mutate. Caller applies the reward.
 */
export function missionComplete(m: Mission, ctx: MissionCtx): boolean {
  const D = MIS[m.id as MissionId];
  if (!D || m.done) return false;
  return D.man ? !!m.man : !!(D.ok && D.ok(m, ctx));
}

/** Celebration lines when a mission finishes (legacy checkMission pick). */
export const MISSION_DONE_LINES = [
  'Mission done! I felt that one.',
  'You did it. I’m glowing.',
  'That was a good one. Thank you.',
] as const;

/** Build the state patch for completing a mission (stars, cel, mlog, etc.). */
export function completeMissionPatch(
  m: Mission,
  misN: number,
  stars: number,
  earned: number,
  mlog: number[],
  now: number,
): {
  mis: Mission;
  stars: number;
  earned: number;
  misN: number;
  mlog: number[];
  cel: { t: number; txt: string };
  toast: string;
} {
  const D = MIS[m.id as MissionId]!;
  const done = { ...m, done: now };
  const nextN = (misN || 0) + 1;
  const nextLog = mlog.concat(startOfDay(now));
  if (nextLog.length > 400) nextLog.shift();
  const line = MISSION_DONE_LINES[nextN % MISSION_DONE_LINES.length];
  return {
    mis: done,
    stars: stars + D.s,
    earned: earned + D.s,
    misN: nextN,
    mlog: nextLog,
    cel: { t: now, txt: line + ' +' + D.s + ' stars.' },
    toast: 'Mission done. +' + D.s + ' stars',
  };
}

/** Context builder from live state + index + now. */
export function missionCtx(
  s: Pick<State, 'log' | 'cravs' | 'tags' | 'crt' | 'limit' | 'limH' | 'plan'>,
  idx: LogIndex,
  now: number,
): MissionCtx {
  return {
    now,
    idx,
    log: s.log,
    cravs: s.cravs || [],
    tags: s.tags || {},
    crt: s.crt || {},
    limit: limFor(s, startOfDay(now)),
  };
}
