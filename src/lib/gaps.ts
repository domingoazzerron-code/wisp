// Gap records and the Wisp celebration texts (legacy gapData, the celebration in doLog, the
// "passed yesterday's best gap" check in renderSpacing). Pure: the log index and `now` are parameters.

import { dayAdd, startOfDay } from './dates.ts';
import { dur } from './format.ts';
import type { LogIndex } from './logindex.ts';

/** A celebration is only worth showing for a gap of at least 30 minutes (legacy 18e5). */
export const CEL_MIN_GAP_MS = 18e5;

export interface GapData {
  /** Longest gap finished today (between two entries of the same day), 0 if none. */
  done: number;
  /** Longest gap finished yesterday. */
  yest: number;
  /** Longest finished gap on any day. */
  ever: number;
  /** Running gap: time since the last entry, only when that entry is from today (else 0). */
  cur: number;
  /** Longest finished gap per day, keyed by that day's start timestamp. */
  m: Record<number, number>;
}

/** Legacy gapData(). Gaps only count between two entries of the SAME day. */
export function gapData(idx: LogIndex, now: number): GapData {
  const a = idx.sorted();
  const td = startOfDay(now);
  const yd = dayAdd(td, -1);
  const m: Record<number, number> = {};
  let ever = 0;
  const l = a.length ? a[a.length - 1] : 0;
  for (let i = 1; i < a.length; i++) {
    const k = startOfDay(a[i]);
    if (k !== startOfDay(a[i - 1])) continue;
    const g = a[i] - a[i - 1];
    if (g > (m[k] || 0)) m[k] = g;
  }
  for (const k in m) if (m[k] > ever) ever = m[k];
  return { done: m[td] || 0, yest: m[yd] || 0, ever, cur: l && startOfDay(l) === td ? now - l : 0, m };
}

/**
 * Legacy doLog: the celebration for a cigarette logged at `now`, or null.
 * Call it BEFORE the new entry is added (`gd` and `prev` describe the log as it was).
 * `prev` is the newest earlier entry (0 when the log is empty).
 */
export function logCelebration(gd: GapData, prev: number, now: number): { t: number; txt: string } | null {
  if (!prev || startOfDay(prev) !== startOfDay(now)) return null;
  const gg = now - prev;
  if (!(gg >= CEL_MIN_GAP_MS && gg > gd.done)) return null;
  const head = gd.ever > 0 && gg > gd.ever ? 'New record gap: ' : gd.yest > 0 && gg > gd.yest ? 'You beat yesterday’s best gap: ' : 'Longest gap today: ';
  return { t: now, txt: head + dur(gg) + '. I felt that.' };
}

/**
 * Legacy renderSpacing check: while the running gap passes yesterday's best, celebrate once per day.
 * Returns the celebration to store (and the day to stamp into `celDay`), or null.
 */
export function checkGapRecord(gd: GapData, celDay: number, now: number): { cel: { t: number; txt: string }; celDay: number } | null {
  const td = startOfDay(now);
  if (gd.cur >= CEL_MIN_GAP_MS && gd.yest > 0 && gd.cur > gd.yest && celDay !== td) {
    return { cel: { t: now, txt: 'You passed yesterday’s best gap (' + dur(gd.yest) + '). Still going.' }, celDay: td };
  }
  return null;
}

export interface SpacingView {
  /** Big line under "Spacing challenge". */
  big: string;
  /** Subline with yesterday / ever / hold-on hint. */
  sub: string;
}

/**
 * Text for the spacing block inside "More about today" (legacy renderSpacing display).
 * Celebration side-effect is handled by useGapRecord / checkGapRecord.
 */
export function spacingView(gd: GapData, logLen: number, hasTodayLog: boolean): SpacingView {
  const today = Math.max(gd.done, gd.cur);
  const ever = Math.max(gd.ever, gd.cur);
  if (!logLen) {
    return {
      big: 'Starts with your first log',
      sub: 'Wisp times the gap between cigarettes. The longer you wait, the stronger he gets.',
    };
  }
  const big = today >= 6e4 ? dur(today) : hasTodayLog ? 'No gap yet' : 'Nothing logged today';
  let sub =
    'Longest gap today. Yesterday: ' +
    (gd.yest ? dur(gd.yest) : 'none') +
    '. Best ever: ' +
    (ever ? dur(ever) : 'none') +
    '.';
  if (gd.cur > 0 && gd.yest > gd.cur) {
    sub += ' Hold on ' + dur(gd.yest - gd.cur) + ' more to beat yesterday.';
  }
  return { big, sub };
}
