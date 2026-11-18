// Pure visibility/text for Today nudge cards: restart after quit, backup reminder, weekly recap nudge.

import type { State } from '../state/types.ts';
import { dayAdd, startOfDay } from './dates.ts';
import { dur } from './format.ts';
import type { LogIndex } from './logindex.ts';
import { cntBetween } from './streaks.ts';
import { gapData } from './gaps.ts';
import { cravIn } from './missions.ts';

export interface RestartView {
  text: string;
}

/** Show the restart card when quit day has started, cigs logged today, and not dismissed today. */
export function restartView(
  planQuit: number | undefined,
  countToday: number,
  rsDay: number,
  now: number,
): RestartView | null {
  const td = startOfDay(now);
  const q = planQuit || 0;
  if (!(q && td >= q && countToday > 0 && rsDay !== td)) return null;
  return {
    text:
      'You had ' +
      countToday +
      ' after your quit day. That happens to a lot of people, and it doesn’t undo your progress. Want to set a fresh quit day for tomorrow? Your limit drops to 0 again from then.',
  };
}

export interface BackupView {
  text: string;
}

/**
 * Backup reminder: ≥5 logs, ≥14 days since last backup (or first log), not snoozed, not signed in.
 * Legacy used !window.WISP_SYNC; pass signedIn from isSignedIn().
 */
export function backupView(
  logLen: number,
  lastBackup: number,
  firstTs: number,
  bkSnooze: number,
  signedIn: boolean,
  now: number,
): BackupView | null {
  if (signedIn || logLen < 5) return null;
  const ls = lastBackup || (logLen ? firstTs : 0);
  const d = ls ? Math.floor((now - ls) / 864e5) : 0;
  if (!(d >= 14 && now > (bkSnooze || 0))) return null;
  return {
    text: lastBackup ? 'Your last backup was ' + d + ' days ago.' : 'You have not backed up yet.',
  };
}

export interface WeekNudgeView {
  title: string;
  sub: string;
  /** Week start stamped into recapSeen when the full recap is opened (insights). */
  ws: number;
}

/** Weekday name for a day-start timestamp (local). */
function wd(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
}

/**
 * Weekly nudge on Today (legacy renderWkNudge / recapInfo highlight only).
 * Shown Sat (dow===6) or Sun/Mon (dow<=1) when that week hasn't been marked seen.
 */
export function weekNudgeView(
  s: Pick<State, 'log' | 'limH' | 'limit' | 'plan' | 'mlog' | 'cravs' | 'recapSeen'>,
  idx: LogIndex,
  now: number,
): WeekNudgeView | null {
  const td = startOfDay(now);
  const dow = (new Date(td).getDay() + 6) % 7; // Mon=0 … Sun=6
  const first = s.log.length ? startOfDay(idx.first()) : 0;
  if (!first) return null;

  const cur = dow === 6; // Saturday = current week in progress
  const ws = cur ? dayAdd(td, -6) : dayAdd(td, -dow - 7);
  const we = dayAdd(ws, 7);
  if (first >= we) return null;
  if (!(dow === 6 || dow <= 1)) return null;
  if ((s.recapSeen || 0) === ws) return null;

  const es = Math.max(ws, first);
  const dEnd = cur && new Date(now).getHours() < 21 ? td : we;
  const nd = Math.max(0, Math.round((dEnd - es) / 864e5));
  const dc = idx.counts();
  const gm = gapData(idx, now).m;
  const tot = cntBetween(idx, es, we);
  const cc = cravIn(s.cravs || [], es, we);

  let zero = 0, bd = 0, bc = 1e9, bg = 0, bgd = 0;
  for (let i = 0; i < nd; i++) {
    const d = dayAdd(es, i);
    const n = dc[d] || 0;
    if (n === 0) zero++;
    if (n < bc) { bc = n; bd = d; }
    if ((gm[d] || 0) > bg) { bg = gm[d]; bgd = d; }
  }

  let hl: { v: string; u: string };
  if (zero > 0) hl = { v: String(zero), u: zero === 1 ? 'smoke-free day' : 'smoke-free days' };
  else if (bg >= 54e5) hl = { v: dur(bg), u: 'longest gap, on ' + wd(bgd) };
  else if (cc > 0) hl = { v: String(cc), u: cc === 1 ? 'craving you got through' : 'cravings you got through' };
  else if (nd > 0) hl = { v: String(bc), u: (bc === 1 ? 'cigarette' : 'cigarettes') + ' on ' + wd(bd) + ', your best day' };
  else hl = { v: String(tot), u: tot === 1 ? 'cigarette so far' : 'cigarettes so far' };

  return {
    title: cur ? 'Your week with Wisp' : 'Last week with Wisp',
    sub: hl.v + ' ' + hl.u,
    ws,
  };
}
