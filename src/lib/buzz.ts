import { getState } from '../state/index.ts';
import { buzzPattern, type BuzzKind } from './haptics.ts';

/**
 * Vibrates the phone. Does nothing when haptics are off (`hap === 0`) or the browser has no vibrate().
 * NOTE: the legacy fallback clicked a hidden `#hapl` switch for the iOS haptic trick. That belongs to the
 * Setup view (step 7): add it there if you want haptics on iPhone.
 */
export function buzz(kind: BuzzKind): void {
  if (getState().hap === 0) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(buzzPattern(kind));
  } catch { /* ignore */ }
}
