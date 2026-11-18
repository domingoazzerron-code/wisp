import { useEffect } from 'preact/hooks';
import { getState, save, subscribe } from '../state/index.ts';
import { liveIndex } from '../lib/current.ts';
import { checkGapRecord, gapData } from '../lib/gaps.ts';

/** Legacy ticked this check every 15 s (updateLive -> renderSpacing) and on every Today render. */
const CHECK_MS = 15000;

/**
 * Once per day, when the running gap passes yesterday's best, sets `S.cel` and `S.celDay` and saves
 * (legacy renderSpacing). Runs on EVERY screen, like legacy `updateLive`. Use once, in the app shell.
 */
export function checkGapRecordNow(): void {
  const s = getState();
  const now = Date.now();
  const r = checkGapRecord(gapData(liveIndex, now), s.celDay, now);
  if (!r) return;
  s.celDay = r.celDay;
  s.cel = r.cel;
  save(); // subscribers re-render; the check is false the second time because celDay is now today
}

export function useGapRecord(): void {
  useEffect(() => {
    checkGapRecordNow();
    const id = setInterval(checkGapRecordNow, CHECK_MS);
    const off = subscribe(checkGapRecordNow); // after a log, an undo, or a cloud pull
    const onVis = () => { if (!document.hidden) checkGapRecordNow(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); off(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
}
