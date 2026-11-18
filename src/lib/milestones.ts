// Pure health / savings milestones (legacy mileDefs, checkMile rules).

import type { State } from '../state/types.ts';
import type { LogIndex } from './logindex.ts';
import { calcSaved, streak } from './streaks.ts';

export type MileId = 'd1' | 'd3' | 'w1' | 'g25' | 'g50' | 'g100' | 'd7' | 'm1';

export interface MileDef {
  id: MileId;
  /** True when the condition is currently met. */
  ok: boolean;
  title: string;
  body: string;
}

export interface MileCtx {
  now: number;
  lastTs: number;
  streak: number;
  savedAmt: number;
  goalAmt: number;
  goalName: string;
  hasLog: boolean;
}

/** Hours since the last cigarette (Infinity when never smoked / empty log treated as 0 for gating). */
function hoursSinceLast(lastTs: number, now: number): number {
  if (!lastTs) return 0;
  return (now - lastTs) / 36e5;
}

/**
 * Current milestone definitions and whether each is met (legacy mileDefs).
 * Order matches legacy so the first newly reached one is the one alerted.
 */
export function mileDefs(ctx: MileCtx): MileDef[] {
  const h = hoursSinceLast(ctx.lastTs, ctx.now);
  const st = ctx.streak;
  const g = ctx.goalAmt;
  const nm = ctx.goalName || 'your goal';
  const saved = ctx.savedAmt;
  return [
    { id: 'd1', ok: h >= 24, title: 'One day smoke-free', body: '24 hours without a cigarette. Your body is already recovering.' },
    { id: 'd3', ok: h >= 72, title: 'Three days smoke-free', body: '72 hours. The hardest stretch is behind you.' },
    { id: 'w1', ok: st >= 7, title: 'A week under your limit', body: 'Seven days in a row within your limit. Real progress.' },
    { id: 'g25', ok: g > 0 && saved >= g * 0.25, title: '25% saved', body: 'A quarter of the way to ' + nm + '.' },
    { id: 'g50', ok: g > 0 && saved >= g * 0.5, title: 'Halfway there', body: '50% saved for ' + nm + '.' },
    { id: 'g100', ok: g > 0 && saved >= g, title: 'Goal reached', body: 'You have saved enough for ' + nm + '.' },
    { id: 'd7', ok: h >= 168, title: 'One week smoke-free', body: 'A full week without a cigarette.' },
    { id: 'm1', ok: h >= 720, title: 'One month smoke-free', body: '30 days. A huge milestone.' },
  ];
}

/**
 * Milestones that are newly met and not yet stored in S.mile.
 * Caller stamps them and shows the first one's title/body (legacy checkMile).
 */
export function newlyReached(
  mile: Record<string, number>,
  ctx: MileCtx,
): MileDef[] {
  if (!ctx.hasLog) return [];
  return mileDefs(ctx).filter((m) => m.ok && !mile[m.id]);
}

/** Build MileCtx from live state + index. */
export function mileCtx(
  s: Pick<State, 'log' | 'limH' | 'limit' | 'plan' | 'base' | 'pack' | 'per' | 'goal'>,
  idx: LogIndex,
  now: number,
  lastTs: number,
): MileCtx {
  return {
    now,
    lastTs,
    streak: streak(s, idx, now),
    savedAmt: calcSaved(s, idx, now),
    goalAmt: s.goal?.amt || 0,
    goalName: s.goal?.name || '',
    hasLog: s.log.length > 0,
  };
}
