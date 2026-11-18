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

/** Re-renders every `ms` milliseconds (live clocks such as "last one 3m ago"). */
export function useTick(ms = 1000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}
