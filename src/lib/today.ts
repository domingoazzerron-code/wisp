// Pure text and level logic for the Today view (legacy render(), renderMascot(), renderPace(), updateLast()).
// No DOM, no store: everything is passed in.

import { cntBetween } from './streaks.ts';
import type { LogIndex } from './logindex.ts';
import { dayAdd, startOfDay } from './dates.ts';
import { durS, tm } from './format.ts';

/** Wisp's caption for each level 0..6 (legacy CAP). */
export const WISP_CAPTIONS = [
  'Floating along nicely today.',
  'Doing okay. One at a time.',
  'A little wobbly, but I’m with you.',
  'A harder day. Let’s pace ourselves.',
  'Rough patch. A glass of water might help.',
  'Close to your limit. The next gap is still yours to choose.',
  'Over today, and that’s okay. Tomorrow is a fresh start.',
] as const;

/** Wisp lights a cigarette once this many have been logged today. */
export const CIG_LIT_AT = 3;

export function greetingPrefix(hour: number): string {
  return hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** How far through the day's allowance you are, 0..100 (0 when there is no limit). */
export function progressPct(t: number, limit: number): number {
  return limit > 0 ? Math.min(t / limit, 1) * 100 : 0;
}

export interface HeroStatus { cls: '' | 'warn'; msg: string }

/** Headline under the count: how many are left, or that the limit is reached/passed. */
export function heroStatus(t: number, limit: number, quitActive: boolean): HeroStatus {
  if (limit > 0 && t > limit) return { cls: 'warn', msg: (t - limit) + ' past today’s limit' };
  if (limit > 0 && t === limit) return { cls: 'warn', msg: 'You’ve reached today’s limit' };
  if (limit > 0 && t === limit - 1) return { cls: 'warn', msg: '1 left today' };
  if (limit > 0) return { cls: '', msg: (limit - t) + ' left today' };
  if (quitActive) return { cls: '', msg: t ? 'Quit day: ' + t + ' logged. Tomorrow is a fresh start' : 'Smoke-free today. Keep going' };
  return { cls: '', msg: 'Set a daily limit in Settings' };
}

/** Wisp's mood level 0 (calm) .. 6 (rough), from today's count against the limit, softened by heals (max 2). */
export function wispLevel(t: number, limit: number, heals: number): number {
  const base = !t ? 0 : limit > 0 ? (t > limit ? 6 : Math.min(5, Math.ceil((5 * t) / limit))) : Math.min(6, t);
  return Math.max(0, base - Math.min(2, heals));
}

/** Cigarettes logged yesterday (legacy yest()). */
export function yesterdayCount(idx: LogIndex, now: number): number {
  const td = startOfDay(now);
  return cntBetween(idx, dayAdd(td, -1), td);
}

/** Number of heals (waited-out cravings) today, plus one bonus for beating yesterday's count (legacy `hl`). */
export function healsToday(heals: readonly number[], t: number, yesterday: number, now: number): number {
  const td = startOfDay(now);
  let n = 0;
  for (const h of heals) if (h >= td) n++;
  return n + (t > 0 && yesterday > 0 && t < yesterday ? 1 : 0);
}

/** Small line under Wisp's caption (legacy #msub). */
export function wispSubline(t: number, limit: number, heals: number, limitYesterday: number): string {
  return (t ? (limit > 0 ? t + ' of ' + limit + ' today' : t + ' today') : 'No cigarettes yet today')
    + (heals ? ' · ' + heals + ' heal' + (heals > 1 ? 's' : '') : '')
    + (limit > 0 && limit < limitYesterday ? ' · limit lowered to ' + limit : '');
}

/** 'Last one 1h 2m 3s ago, at 3:05 PM' or the empty-state line. */
export function lastLine(last: number, now: number): string {
  return last ? 'Last one ' + durS(now - last) + ' ago, at ' + tm(last) : 'Nothing logged yet';
}

/** Gap countdown line; empty when no minimum gap is set or nothing is logged. `base` is gapBase(). */
export function gapLine(gapMin: number, base: number, now: number): string {
  if (!(gapMin > 0) || !base) return '';
  const r = base + gapMin * 6e4 - now;
  return r > 0 ? 'Next one in ' + durS(r) : 'Minimum gap reached. Every extra minute counts';
}

export interface Pace { projected: number; over: boolean }

/** Projects today's total from the pace so far (assumes a 7:00 to 23:00 day). null when there is too little data. */
export function paceProjection(t: number, limit: number, hour: number, minute: number): Pace | null {
  const fr = (hour + minute / 60 - 7) / 16;
  if (limit > 0 && t > 0 && fr > 0.2 && fr < 1) {
    const projected = Math.round(t / fr);
    return { projected, over: projected > limit };
  }
  return null;
}
