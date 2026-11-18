// Pure, state-free version of the log helpers in src/state/store.ts (sortedLog, dayCounts,
// lowerBound, firstTs). Build one from a log array; the lib functions take it as a parameter.

export interface LogIndex {
  /** Log timestamps sorted ascending. */
  sorted(): number[];
  /** Cigarettes per local day, keyed by that day's start timestamp. */
  counts(): Record<number, number>;
  /** Index of the first entry >= t. */
  lowerBound(t: number): number;
  /** Oldest timestamp, or Infinity when empty. */
  first(): number;
  /** Newest timestamp, or 0 when empty (legacy lastTs). */
  last(): number;
}

/** Lazily builds and caches the derived views. Make a new one whenever the log changes. */
export function createLogIndex(log: readonly number[]): LogIndex {
  let sorted: number[] | null = null;
  let counts: Record<number, number> | null = null;
  const getSorted = (): number[] => (sorted ??= log.slice().sort((a, b) => a - b));
  return {
    sorted: getSorted,
    counts() {
      if (!counts) {
        const m: Record<number, number> = {};
        for (const ts of getSorted()) {
          const d = new Date(ts);
          const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          m[k] = (m[k] || 0) + 1;
        }
        counts = m;
      }
      return counts;
    },
    lowerBound(t) {
      const a = getSorted();
      let lo = 0;
      let hi = a.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (a[mid] < t) lo = mid + 1; else hi = mid;
      }
      return lo;
    },
    first() {
      const a = getSorted();
      return a.length ? a[0] : Infinity;
    },
    last() {
      const a = getSorted();
      return a.length ? a[a.length - 1] : 0;
    },
  };
}
