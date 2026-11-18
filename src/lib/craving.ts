// Craving timer: pure helpers (legacy crv / cravTip / creditCrave, see HANDOFF.md slice 6b-1).
// Nothing here reads the clock or the store; the actions in src/actions/craving.ts do.

import type { State } from '../state/types.ts';

/** Length of the wait (10 minutes). */
export const CRAVE_MS = 6e5;
/** If the timer ended more than this long ago (3 minutes) we ask instead of crediting (legacy `18e4`). */
export const CRAVE_LATE_MS = 18e4;

/** [title, text] tips shown while waiting; the index grows every 2.5 minutes. */
export const CTIPS: ReadonlyArray<readonly [string, string]> = [
  ['Delay', 'Most cravings fade in 5 to 10 minutes. You are already doing it.'],
  ['Deep breaths', 'In for 4, hold for 4, out for 6. Repeat five times.'],
  ['Drink water', 'Sip a full glass slowly. It keeps your hands and mouth busy.'],
  ['Do something else', 'Walk, wash your face, chew gum, or message a friend.'],
];

/** Which tip to show with `remaining` ms left (0..3). */
export function cravTipIndex(remaining: number): number {
  return Math.max(0, Math.min(3, Math.floor((CRAVE_MS - remaining) / 15e4)));
}

/** `m:ss` for a countdown; negative values show 0:00. */
export function cravClock(ms: number): string {
  const r = Math.max(0, ms);
  return Math.floor(r / 60000) + ':' + ('0' + Math.floor((r % 60000) / 1000)).slice(-2);
}

export type CraveCheck =
  | { kind: 'none' }
  | { kind: 'running'; remaining: number }
  | { kind: 'credit'; ended: number }   // ran out while the app was open (or just now)
  | { kind: 'late'; ended: number };    // ran out more than 3 minutes ago: ask first

/** What should happen to the timer right now? (`craveEnd` is 0 when no timer runs.) */
export function checkCrave(craveEnd: number, now: number): CraveCheck {
  if (!craveEnd) return { kind: 'none' };
  const r = craveEnd - now;
  if (r > 0) return { kind: 'running', remaining: r };
  return now - craveEnd > CRAVE_LATE_MS ? { kind: 'late', ended: craveEnd } : { kind: 'credit', ended: craveEnd };
}

/** Small line under the clock. */
export function cravSubline(active: boolean, reasons: string, waited: number): string {
  if (active) return reasons ? 'Remember why: ' + reasons : 'Breathe, drink water, move around.';
  return 'Waited out so far: ' + (waited || 0);
}

type CraveFields = Pick<State, 'waited' | 'heals' | 'cravs' | 'healAt' | 'gapFrom' | 'craveEnd'>;

/** Records a waited-out craving that ended at `e0` (legacy creditCrave, minus save/UI). Mutates `s`. */
export function applyCredit(s: CraveFields, e0: number): void {
  s.craveEnd = 0;
  s.waited = (s.waited || 0) + 1;
  (s.heals = s.heals || []).push(e0);
  s.cravs.push(e0);
  s.healAt = e0;
  s.gapFrom = Math.max(s.gapFrom || 0, e0);
}

/** Text of the "you waited it out" message (legacy alertBox in creditCrave, minus the trigger question). */
export function creditText(waited: number, gapMin: number): string {
  return 'Ten minutes passed and the craving has faded. You have waited out ' + waited + ' so far.'
    + (gapMin > 0 ? ' Your next-one countdown has restarted.' : '');
}
