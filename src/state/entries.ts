// Add, remove and restore single log entries (legacy removeEntry / restoreEntry and the push in doLog).
// Like the rest of the store these mutate the live state and call save().

import { getState, save } from './store.ts';
import type { State } from './types.ts';

export interface RemovedEntry {
  ts: number;
  tag: string | undefined;
  note: State['notes'][string] | undefined;
}

/** Appends a cigarette at `ts` (defaults to now), clears any running craving timer, saves. */
export function addEntry(ts: number = Date.now()): number {
  const s = getState();
  s.craveEnd = 0;
  s.log.push(ts);
  save();
  return ts;
}

/** Removes the entry (and its trigger tag and note). Returns what was removed so it can be restored, or null if not found. */
export function removeEntry(ts: number): RemovedEntry | null {
  const s = getState();
  const i = s.log.indexOf(ts);
  if (i < 0) return null;
  const rec: RemovedEntry = { ts, tag: s.tags[ts], note: s.notes[ts] };
  s.log.splice(i, 1);
  delete s.tags[ts];
  delete s.notes[ts];
  save();
  return rec;
}

/** Puts a removed entry back (log stays sorted) and saves. */
export function restoreEntry(r: RemovedEntry): void {
  const s = getState();
  if (s.log.indexOf(r.ts) < 0) s.log.push(r.ts);
  s.log.sort((a, b) => a - b);
  if (r.tag) s.tags[r.ts] = r.tag;
  if (r.note) s.notes[r.ts] = r.note;
  save();
}
