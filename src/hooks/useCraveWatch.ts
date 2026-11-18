import { useEffect } from 'preact/hooks';
import { getState, subscribe } from '../state/index.ts';
import { checkCraveExpiry } from '../actions/craving.ts';

/**
 * Keeps an eye on the craving timer on EVERY screen (legacy `live()` ticked while `S.craveEnd` was set).
 * Checks once on start (a timer that ended while the app was closed), then every second while a timer runs.
 * Use once, in the app shell.
 */
export function useCraveWatch(): void {
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (getState().craveEnd && id === undefined) id = setInterval(sync, 1000);
      else if (!getState().craveEnd && id !== undefined) { clearInterval(id); id = undefined; }
      checkCraveExpiry();
    };
    sync();
    const off = subscribe(sync);
    const onVis = () => { if (!document.hidden) sync(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { off(); document.removeEventListener('visibilitychange', onVis); if (id !== undefined) clearInterval(id); };
  }, []);
}
