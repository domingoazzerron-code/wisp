import { getState, save } from '../state/index.ts';
import { alertBox } from '../components/Overlay.tsx';
import { lastTs, liveIndex } from '../lib/current.ts';
import { mileCtx, newlyReached } from '../lib/milestones.ts';

/**
 * Award any newly met milestones (legacy checkMile).
 * Returns true when at least one was stamped. Only the first new one is alerted.
 */
export function checkMile(now: number = Date.now()): boolean {
  const s = getState();
  if (!s.log.length) return false;
  const ctx = mileCtx(s, liveIndex, now, lastTs());
  const fresh = newlyReached(s.mile || {}, ctx);
  if (!fresh.length) return false;
  const mile = { ...(s.mile || {}) };
  for (const m of fresh) mile[m.id] = now;
  s.mile = mile;
  save();
  alertBox(fresh[0].title, fresh[0].body, true);
  return true;
}
