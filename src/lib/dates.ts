// Day helpers (legacy startOfDay / dayAdd / dk). Days are identified by their LOCAL midnight timestamp.

export const DAY_MS = 864e5;

/** Local midnight of the day containing ts. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight n calendar days after (or before, if negative) the day containing ts. DST-safe. */
export function dayAdd(ts: number, n: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}

/** 'YYYY-M-D' key for the local day of ts (no zero padding, as in legacy). */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
