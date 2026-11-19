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
  unforget(s, ts);
  s.log.push(ts);
  save();
  return ts;
}

/** Remember that an entry was deleted, so a sync with another device does not bring it back. */
export function forget(s: State, ts: number): void {
  if (!s.del) s.del = [];
  if (s.del.indexOf(ts) < 0) s.del.push(ts);
  if (s.del.length > 500) s.del.splice(0, s.del.length - 500);
}

/** Entry exists again (added or restored): stop treating its timestamp as deleted. */
export function unforget(s: State, ts: number): void {
  const i = s.del ? s.del.indexOf(ts) : -1;
  if (i > -1) s.del.splice(i, 1);
}

/** Removes the entry (and its trigger tag and note). Returns what was removed so it can be restored, or null if not found. */
export function removeEntry(ts: number): RemovedEntry | null {
  const s = getState();
  const i = s.log.indexOf(ts);
  if (i < 0) return null;
  const rec: RemovedEntry = { ts, tag: s.tags[ts], note: s.notes[ts] };
  s.log.splice(i, 1);
  forget(s, ts);
  delete s.tags[ts];
  delete s.notes[ts];
  save();
  return rec;
}

/** Puts a removed entry back (log stays sorted) and saves. */
export function restoreEntry(r: RemovedEntry): void {
  const s = getState();
  unforget(s, r.ts);
  if (s.log.indexOf(r.ts) < 0) s.log.push(r.ts);
  s.log.sort((a, b) => a - b);
  if (r.tag) s.tags[r.ts] = r.tag;
  if (r.note) s.notes[r.ts] = r.note;
  save();
}
