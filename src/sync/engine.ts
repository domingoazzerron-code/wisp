import type { State } from '../state/types.ts';
import { META_MOD, META_SYN } from './config.ts';
import { mergeStates } from './merge.ts';

// The sync logic, with every outside dependency injected so it can be tested without
// a browser or Supabase. Ported from the legacy sync script (push, reconcile, status).

export interface CloudRow { data: unknown; updated_at: string }

export interface Backend {
  fetchRow(userId: string): Promise<{ row: CloudRow | null; error?: string }>;
  upsertRow(userId: string, data: unknown, updatedAt: string): Promise<{ error?: string }>;
}

export interface MetaStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SyncUser { id: string; email: string }

export interface SyncDeps {
  backend: Backend;
  meta: MetaStorage;
  getLocal: () => State;                 // the live local state
  applyRemote: (next: State) => void;    // swap in + persist a pulled state (no save echo)
  parseState: (raw: unknown) => State;   // repair untrusted cloud data into a full state
  now?: () => number;
  isOnline?: () => boolean;
  debounceMs?: number;                   // wait after a save before uploading (legacy: 1500)
}

export type ReconcileResult = 'pulled' | 'pushed' | undefined;

/** "3:07 PM" style time, as shown in the sync status line. */
export function hm(d: Date = new Date()): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM');
}

export function createSyncEngine(deps: SyncDeps) {
  const now = deps.now ?? (() => Date.now());
  const online = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const debounceMs = deps.debounceMs ?? 1500;

  let user: SyncUser | null = null;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let status = '';
  const statusListeners = new Set<() => void>();

  const setStatus = (t: string) => { status = t; statusListeners.forEach((fn) => fn()); };
  const readNum = (key: string): number => {
    try { return +(deps.meta.getItem(key) as string) || 0; } catch { return 0; }
  };
  const writeMeta = (key: string, value: string) => {
    try { deps.meta.setItem(key, value); } catch { /* ignore */ }
  };
  const hasData = (s: State) => !!(s && (s.setup || (s.log && s.log.length)));

  /** Upload this device's data. Safe to call any time; does nothing when signed out. */
  async function push(): Promise<void> {
    if (!user) return;
    timer = null;
    if (!online()) { dirty = true; setStatus('Offline, will sync when back online'); return; }
    setStatus('Syncing…');
    const sent = new Date(now()).toISOString();
    try {
      const r = await deps.backend.upsertRow(user.id, deps.getLocal(), sent);
      if (r.error) {
        dirty = true;
        console.warn('sync', r.error);
        setStatus('Sync failed, will retry');
      } else {
        dirty = false;
        writeMeta(META_SYN, String(Date.parse(sent)));
        setStatus('Synced at ' + hm());
      }
    } catch {
      dirty = true;
      setStatus('Offline, will sync when back online');
    }
  }

  function schedule(): void {
    if (!user) return;
    dirty = true;
    if (!online()) setStatus('Offline, will sync when back online');
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, debounceMs);
  }

  /** Call after every local save: stamps when data changed and queues an upload. */
  function onLocalSave(): void {
    writeMeta(META_MOD, String(now()));
    schedule();
  }

  /**
   * After sign-in: take the cloud copy if this device has nothing or another device wrote
   * since this one last synced (merging when both have data, so nothing is dropped);
   * otherwise upload this device's newer copy.
   */
  async function reconcile(): Promise<ReconcileResult> {
    if (!user) return undefined;
    let fetched: { row: CloudRow | null; error?: string };
    try { fetched = await deps.backend.fetchRow(user.id); } catch { return undefined; }
    if (fetched.error) { console.warn('sync', fetched.error); return undefined; }
    const row = fetched.row;
    const cloudHasData = !!(row && row.data);

    let local = deps.getLocal();
    let localMod = readNum(META_MOD);
    let synced = readNum(META_SYN);
    let localHas = hasData(local);
    let pulled = false;

    if (row && row.data) {
      const cm = Date.parse(row.updated_at) || 0;
      if (!localHas || cm !== synced) {
        const next = localHas
          ? mergeStates(local as unknown as Record<string, unknown>, row.data as Record<string, unknown>, localMod > cm)
          : row.data;
        deps.applyRemote(deps.parseState(next));
        writeMeta(META_MOD, String(localHas ? now() : cm));
        writeMeta(META_SYN, String(cm));
        pulled = true;
        // The legacy app reloaded the page here and ran this check again on the new data.
        local = deps.getLocal();
        localHas = hasData(local);
        localMod = readNum(META_MOD);
        synced = readNum(META_SYN);
      }
    }
    if (localHas && (!cloudHasData || localMod > synced)) { await push(); return 'pushed'; }
    return pulled ? 'pulled' : undefined;
  }

  /** Mark the user signed in and sync. Resolves when the first sync is done. */
  async function enter(u: SyncUser): Promise<ReconcileResult> {
    user = u;
    const result = await reconcile();
    if (!status) setStatus(online() ? 'Synced' : 'Offline');
    return result;
  }

  return {
    enter,
    push,
    reconcile,
    onLocalSave,
    setUser(u: SyncUser | null) { user = u; },
    getUser: () => user,
    getStatus: () => status,
    isDirty: () => dirty,
    subscribeStatus(fn: () => void) { statusListeners.add(fn); return () => { statusListeners.delete(fn); }; },
    /** Page hidden or closing: upload right away if a save is waiting. */
    flush() { if (user && timer) { clearTimeout(timer); void push(); } },
    onOnline() { if (user && dirty) void push(); },
    onOffline() { if (user) setStatus('Offline'); },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
