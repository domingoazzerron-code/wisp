import { getState, save } from '../state/index.ts';
import { toast } from '../components/Toasts.tsx';
import { alertBox, askConfirmDual, slipPrompt } from '../components/Overlay.tsx';
import { CRAVE_MS, applyCredit, checkCrave, creditText } from '../lib/craving.ts';
import { tm } from '../lib/format.ts';
import { buzz } from '../lib/buzz.ts';

/** Starts the 10 minute wait. */
export function startCrave(): void {
  getState().craveEnd = Date.now() + CRAVE_MS;
  save();
}

/** Stops a running wait without crediting it. */
export function cancelCrave(): void {
  getState().craveEnd = 0;
  save();
}

/** The big button: start when idle, cancel when running. */
export function toggleCrave(): void {
  if (getState().craveEnd) cancelCrave(); else startCrave();
}

/** Credits a waited-out craving that ended at `e0`. */
export function creditCrave(e0: number): void {
  const s = getState();
  applyCredit(s, e0);
  save();
  buzz('heal');
  alertBox('You waited it out', creditText(s.waited, s.gap) + ' What set it off?', true);
  slipPrompt(e0, false, 'crt');
}

/** Timer ended while the app was closed: ask before crediting. */
function askLate(e0: number): void {
  askConfirmDual(
    'Did you get through it?',
    'Your 10 minute wait ended at ' + tm(e0) + ' while the app was closed. Did you hold off?',
    'Yes, I got through it',
    () => creditCrave(e0),
    'No, I had one',
    () => toast('No worries. Log it if you did, and start fresh.'),
  );
}

/**
 * Call about once a second. Handles a timer that has run out: credits it, or asks when the app was closed
 * for more than 3 minutes. Safe to call repeatedly (it clears `craveEnd` first).
 */
export function checkCraveExpiry(now: number = Date.now()): void {
  const s = getState();
  const c = checkCrave(s.craveEnd || 0, now);
  if (c.kind === 'credit') {
    creditCrave(c.ended);
  } else if (c.kind === 'late') {
    s.craveEnd = 0;
    save();
    askLate(c.ended);
  }
}

/** "Log a craving I got through": adds a craving now, with Undo. */
export function logCraving(): void {
  const s = getState();
  const ts = Date.now();
  s.cravs.push(ts);
  save();
  buzz('heal');
  toast('Craving logged. You got through it', 'Undo', () => {
    const i = s.cravs.indexOf(ts);
    if (i > -1) { s.cravs.splice(i, 1); save(); }
  });
}

/** Delete one craving from History, with Undo (legacy clist del). */
export function deleteCraving(ts: number): void {
  const s = getState();
  const i = s.cravs.indexOf(ts);
  if (i < 0) return;
  const had = s.crt[ts];
  s.cravs.splice(i, 1);
  delete s.crt[ts];
  save();
  toast('Craving deleted', 'Undo', () => {
    s.cravs.push(ts);
    if (had) s.crt[ts] = had;
    save();
  });
}

/** Set or clear the trigger tag on a craving (legacy clist change). */
export function setCravingTrigger(ts: number, value: string): void {
  const s = getState();
  if (value) s.crt[ts] = value;
  else delete s.crt[ts];
  save();
}
