import { defaultState, OUTFITS } from './defaults.ts';
import type { State } from './types.ts';

// Same key as the legacy app, so data saved by the old app still loads.
export const STORAGE_KEY = 'cigtracker.v1';

// Minimal slice of the Storage API, so tests can pass a fake.
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try { return localStorage; } catch { return null; }
}

/**
 * Repairs a state object in place and returns it. Anything of the wrong type
 * falls back to the default. Ported 1:1 from legacy fix(); stays loosely typed
 * on purpose because the input is untrusted (storage, backups, cloud).
 */
export function sanitize(state: State): State {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = state as unknown as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = defaultState() as unknown as Record<string, any>;
  let k: string;
  const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

  if (!Array.isArray(o.log)) o.log = [];
  o.log = o.log.filter((x: unknown) => typeof x === 'number' && isFinite(x) && x > 0 && x < 4e12);
  ['tags', 'notes', 'mile', 'diary', 'crt'].forEach((q) => { if (!isObj(o[q])) o[q] = {}; });
  ['ctags', 'heals', 'cravs'].forEach((q) => { if (!Array.isArray(o[q])) o[q] = []; });
  if ([7, 30, 90].indexOf(o.rng) < 0) o.rng = 7;
  if ([0, 1, 2, 3].indexOf(o.fx) < 0) o.fx = 0;
  o.cravs = o.cravs.filter((x: unknown) => typeof x === 'number' && isFinite(x) && x > 0);
  o.ctags = o.ctags.filter((x: unknown) => typeof x === 'string');
  o.heals = o.heals.filter((x: unknown) => typeof x === 'number');
  if (!isObj(o.goal)) o.goal = d.goal;
  if (typeof o.goal.name !== 'string') o.goal.name = '';
  if (typeof o.goal.amt !== 'number' || !isFinite(o.goal.amt)) o.goal.amt = 0;
  if (!isObj(o.plan)) o.plan = d.plan;
  for (k in d.plan) if (typeof o.plan[k] !== typeof d.plan[k]) o.plan[k] = d.plan[k];
  if (o.plan.quit !== undefined && typeof o.plan.quit !== 'number') o.plan.quit = 0;
  if (!Array.isArray(o.plan.holds)) o.plan.holds = [];
  o.plan.holds = o.plan.holds.filter((x: unknown) =>
    Array.isArray(x) && typeof x[0] === 'number' && typeof x[1] === 'number' && x[1] > 0);
  ['limit', 'pack', 'per', 'base', 'nic', 'tar', 'gap', 'waited', 'craveEnd', 'gapFrom', 'evo',
    'lastBackup', 'bkSnooze', 'healAt', 'celDay', 'setup', 'wkSeen', 'fx', 'qh', 'conf', 'rsDay',
    'stars', 'earned', 'misN', 'greetDay', 'greetAt', 'recapSeen',
  ].forEach((q) => { if (typeof o[q] !== 'number' || !isFinite(o[q]) || o[q] < 0) o[q] = d[q]; });
  ['cur', 'name', 'reasons'].forEach((q) => { if (typeof o[q] !== 'string') o[q] = d[q]; });
  if (['auto', 'light', 'dark', 'glass'].indexOf(o.theme) < 0) o.theme = 'auto';
  if (OUTFITS.indexOf(o.outfit) < 0) o.outfit = 'none';
  ['mis', 'chal', 'badges'].forEach((q) => { if (!isObj(o[q])) o[q] = d[q]; });
  for (k in d.mis) if (typeof o.mis[k] !== typeof d.mis[k]) o.mis[k] = d.mis[k];
  for (k in d.chal) if (typeof o.chal[k] !== typeof d.chal[k]) o.chal[k] = d.chal[k];
  o.limH = Array.isArray(o.limH)
    ? o.limH
        .filter((x: unknown) => Array.isArray(x) && typeof x[0] === 'number' && typeof x[1] === 'number' && isFinite(x[1]) && x[1] >= 0)
        .sort((a: number[], b: number[]) => a[0] - b[0])
    : [];
  if (!Array.isArray(o.owned)) o.owned = [];
  o.owned = o.owned.filter((x: unknown) => OUTFITS.indexOf(x as never) > 0);
  if (!Array.isArray(o.mlog)) o.mlog = [];
  o.mlog = o.mlog.filter((x: unknown) => typeof x === 'number' && isFinite(x)).slice(-400);
  if (o.cres && (typeof o.cres !== 'object' || Array.isArray(o.cres))) o.cres = null;
  o.stars = Math.floor(o.stars);
  return state;
}

/** Defaults with every known key overridden by the object's value (unknown keys are dropped). */
function mergeIntoDefaults(p: Record<string, unknown>): State {
  const s = defaultState() as unknown as Record<string, unknown>;
  for (const k in s) if (p[k] !== undefined) s[k] = p[k];
  return s as unknown as State;
}

/**
 * Builds a full, repaired state from any parsed value (saved data, cloud row).
 * Anything missing or malformed falls back to defaults; unknown keys are dropped.
 */
export function stateFromObject(p: unknown): State {
  const s = defaultState();
  if (p && typeof p === 'object') {
    const src = p as Record<string, unknown>;
    const rec = s as unknown as Record<string, unknown>;
    for (const k in rec) if (src[k] !== undefined) rec[k] = src[k];
    if (src.conf === undefined && src.setup) s.conf = 1;
  }
  // Very old saves defaulted to $ and 12-cigarette packs.
  if (s.cur === '$' && s.pack === 12 && !s.conf) { s.cur = '₱'; s.pack = 150; }
  sanitize(s);
  if (!s.setup && s.log.length) s.setup = 1;
  if (!s.fx && s.hap === 0) s.fx = 3;
  return s;
}

/** Reads and repairs the saved state. Never throws; bad or missing data gives defaults. */
export function loadState(storage: KeyValueStorage | null = browserStorage()): State {
  let p: unknown = null;
  try {
    const raw = storage ? storage.getItem(STORAGE_KEY) : null;
    if (raw) p = JSON.parse(raw);
  } catch { p = null; }
  return stateFromObject(p);
}

/** Writes the state. Ignores storage errors (private mode, quota), like the legacy app. */
export function saveState(state: State, storage: KeyValueStorage | null = browserStorage()): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/**
 * Parses a backup file's text into a repaired state, or null if it is not a valid
 * backup (legacy restoreFrom). The caller confirms with the user, then calls
 * replaceState() and sets `setup = 1` if the backup has entries.
 */
export function stateFromBackup(text: string): State | null {
  try {
    const p = JSON.parse(text);
    if (!p || !Array.isArray(p.log)) return null;
    return sanitize(mergeIntoDefaults(p));
  } catch {
    return null;
  }
}
