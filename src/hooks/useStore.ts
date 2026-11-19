import { useEffect, useState } from 'preact/hooks';
import { subscribe, subscribeRemote } from '../state/index.ts';

/** Re-renders the component after every save() and every cloud pull. Returns a counter you can use as a dependency. */
export function useStore(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN((x) => x + 1);
    const offLocal = subscribe(bump);
    const offRemote = subscribeRemote(bump);
    return () => { offLocal(); offRemote(); };
  }, []);
  return n;
}

/**
 * Re-renders every `ms` milliseconds (live clocks such as "last one 3m ago").
 * Pauses while the app is in the background (saves battery) and refreshes the moment it
 * comes back. Pass 0 to switch it off.
 */
export function useTick(ms = 1000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!(ms > 0)) return undefined;
    let id: ReturnType<typeof setInterval> | null = null;
    const bump = () => setN((x) => x + 1);
    const start = () => { if (id === null) id = setInterval(bump, ms); };
    const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
    const onVis = () => {
      if (document.hidden) stop();
      else { bump(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [ms]);
  return n;
}
