import { getState, save } from '../state/index.ts';
import { toast } from '../components/Toasts.tsx';
import { dayAdd, startOfDay } from '../lib/dates.ts';

/** Set quit day to tomorrow and hide the restart card. */
export function setFreshQuitDay(now: number = Date.now()): void {
  const s = getState();
  s.plan = { ...s.plan, quit: dayAdd(startOfDay(now), 1) };
  save();
  toast('Fresh quit day set for tomorrow');
}

/** Dismiss the restart card for the rest of today. */
export function dismissRestart(now: number = Date.now()): void {
  const s = getState();
  s.rsDay = startOfDay(now);
  save();
}

/** Snooze the backup reminder for 3 days. */
export function snoozeBackup(now: number = Date.now()): void {
  const s = getState();
  s.bkSnooze = now + 3 * 864e5;
  save();
}

/** Mark the weekly recap week as seen (when the user opens the nudge link). */
export function markRecapSeen(ws: number): void {
  const s = getState();
  if (s.recapSeen === ws) return;
  s.recapSeen = ws;
  save();
}
