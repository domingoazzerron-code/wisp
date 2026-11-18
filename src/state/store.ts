import { loadState, saveState } from './storage.ts';
import type { State } from './types.ts';

// One live state object. Like the legacy app, code mutates it in place and then
// calls save(); that persists it, drops the derived caches and notifies subscribers
// (step 4 uses subscribe() for cloud sync instead of patching localStorage).

let state: State = loadState();
let sorted: number[] | null = null;
let perDay: Record<number, number> | null = null;
const listeners = new Set<() => void>();
const remoteListeners = new Set<() => void>();

export function getState(): State { return state; }

/** Swap in a whole new state (reset, restore backup, cloud pull). Call save() after if it should persist. */
export function replaceState(next: State): void {
  state = next;
  sorted = null;
  perDay = null;
}

export function save(): void {
  sorted = null;
  perDay = null;
  saveState(state);
  listeners.forEach((fn) => fn());
}

/** Runs fn after every save(). Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Applies a state that came from outside the UI (cloud sync pull): swaps it in,
 * persists it WITHOUT calling save() subscribers (so sync does not echo it back),
 * and notifies subscribeRemote() listeners so views can re-render.
 */
export function applyRemoteState(next: State): void {
  replaceState(next);
  saveState(next);
  remoteListeners.forEach((fn) => fn());
}

/** Runs fn after every applyRemoteState(). Returns an unsubscribe function. */
export function subscribeRemote(fn: () => void): () => void {
  remoteListeners.add(fn);
  return () => { remoteListeners.delete(fn); };
}

// ---- derived helpers over state.log (legacy srt / dcounts / lb / minTs) ----

/** Log timestamps sorted ascending. Cached until the next save() or replaceState(). */
export function sortedLog(): number[] {
  if (!sorted) sorted = state.log.slice().sort((a, b) => a - b);
  return sorted;
}

/** Cigarettes logged per local day, keyed by that day's start timestamp. */
export function dayCounts(): Record<number, number> {
  if (!perDay) {
    const m: Record<number, number> = {};
    for (const ts of sortedLog()) {
      const d = new Date(ts);
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      m[k] = (m[k] || 0) + 1;
    }
    perDay = m;
  }
  return perDay;
}

/** Index of the first log entry >= t (so `sortedLog().length - lowerBound(t)` counts entries since t). */
export function lowerBound(t: number): number {
  const a = sortedLog();
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Oldest log timestamp, or Infinity when nothing is logged. */
export function firstTs(): number {
  const a = sortedLog();
  return a.length ? a[0] : Infinity;
}
