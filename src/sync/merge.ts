// Pure merge of this device's data with the cloud copy. Ported 1:1 from legacy uni()/merge().
// Records only ever get added: nothing logged on either device is dropped.

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Union of two number lists, de-duplicated and sorted ascending. Non-numbers are ignored. */
export function unionNumbers(a: unknown, b: unknown): number[] {
  const seen: Record<number, 1> = {};
  const out: number[] = [];
  const all = (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []);
  all.forEach((x) => {
    if (typeof x === 'number' && !seen[x]) { seen[x] = 1; out.push(x); }
  });
  return out.sort((x, y) => x - y);
}

/**
 * Settings come from whichever copy is newer (localNewer picks local). Logs are unioned,
 * per-entry maps are combined (the newer copy wins on the same key), `waited` takes the max.
 */
export function mergeStates(local: Rec, cloud: Rec, localNewer: boolean): Rec {
  const o: Rec = JSON.parse(JSON.stringify(localNewer ? local : cloud));
  ['log', 'cravs', 'heals', 'mlog'].forEach((q) => { o[q] = unionNumbers(cloud[q], local[q]); });
  ['tags', 'notes', 'crt', 'mile', 'diary', 'badges'].forEach((q) => {
    const a = localNewer ? cloud[q] : local[q];
    const b = localNewer ? local[q] : cloud[q];
    o[q] = Object.assign({}, a || {}, b || {});
  });
  o.waited = Math.max(+cloud.waited || 0, +local.waited || 0);
  return o;
}
