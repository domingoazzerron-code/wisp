import { applyRemoteState, getState, subscribe } from '../state/store.ts';
import { STORAGE_KEY, stateFromObject } from '../state/storage.ts';
import { LOCK_KEY, META_MOD, META_SYN } from './config.ts';
import { createSyncEngine, type MetaStorage, type SyncUser } from './engine.ts';
import { supabase, supabaseBackend } from './supabase.ts';

// Public sync API for the UI. No markup here: the sign-in screen and the account
// controls are built in the views step (7) and call these functions.

const meta: MetaStorage = {
  getItem(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  removeItem(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const engine = createSyncEngine({
  backend: supabaseBackend,
  meta,
  getLocal: getState,
  applyRemote: applyRemoteState,
  parseState: stateFromObject,
});

export interface AuthResult {
  ok: boolean;
  message?: string;       // text to show the user
  signedIn?: boolean;     // sign-up/sign-in: a session now exists
}

const NO_CONNECTION = 'Could not connect. Check your internet and try again.';
const toUser = (u: { id: string; email?: string }): SyncUser => ({ id: u.id, email: u.email || '' });

// ---- read-only status for the UI ----
export const getSyncUser = () => engine.getUser();
export const isSignedIn = () => engine.getUser() !== null;   // legacy window.WISP_SYNC
export const getSyncStatus = () => engine.getStatus();        // e.g. "Synced at 3:07 PM"
export const subscribeSyncStatus = engine.subscribeStatus;
export const syncNow = () => engine.push();

const recoveryListeners = new Set<() => void>();
/** Fires when the user opens a password-reset email link; show the "choose a new password" form. */
export function onPasswordRecovery(fn: () => void): () => void {
  recoveryListeners.add(fn);
  return () => { recoveryListeners.delete(fn); };
}

let started = false;

/**
 * Call once on app start. Wires auto-upload, online/offline and page-hide handling, then
 * restores any saved session and syncs. 'signed-out' means show the sign-in screen;
 * 'error' means sync could not start (offline etc.): let the app run locally.
 */
export async function startSync(): Promise<'signed-in' | 'signed-out' | 'error'> {
  if (!started) {
    started = true;
    subscribe(() => engine.onLocalSave());
    window.addEventListener('online', () => engine.onOnline());
    window.addEventListener('offline', () => engine.onOffline());
    window.addEventListener('pagehide', () => engine.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') engine.flush();
    });
    supabase.auth.onAuthStateChange((ev) => {
      if (ev === 'PASSWORD_RECOVERY') recoveryListeners.forEach((fn) => fn());
    });
  }
  try {
    const { data } = await supabase.auth.getSession();
    const ses = data.session;
    if (!ses) return 'signed-out';
    await engine.enter(toUser(ses.user));
    return 'signed-in';
  } catch {
    return 'error';
  }
}

// ---- account actions ----

export async function signUp(email: string, password: string): Promise<AuthResult> {
  email = email.trim();
  if (!email || !password) return { ok: false, message: 'Enter your email and password.' };
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  try {
    const r = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
    if (r.error) return { ok: false, message: r.error.message };
    if (r.data.session) { await engine.enter(toUser(r.data.session.user)); return { ok: true, signedIn: true }; }
    return { ok: true, signedIn: false, message: 'Check your email to confirm your account, then sign in.' };
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  email = email.trim();
  if (!email || !password) return { ok: false, message: 'Enter your email and password.' };
  try {
    const r = await supabase.auth.signInWithPassword({ email, password });
    if (r.error) return { ok: false, message: r.error.message };
    if (r.data.session) { await engine.enter(toUser(r.data.session.user)); return { ok: true, signedIn: true }; }
    return { ok: true, signedIn: false, message: 'Check your email to confirm your account, then sign in.' };
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  email = email.trim();
  if (!email) return { ok: false, message: 'Enter your email first.' };
  try {
    const r = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    return r.error ? { ok: false, message: r.error.message } : { ok: true, message: 'Password reset email sent.' };
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
}

/** After the user follows a reset email link (see onPasswordRecovery). */
export async function setNewPassword(password: string): Promise<AuthResult> {
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  try {
    const r = await supabase.auth.updateUser({ password });
    if (r.error) return { ok: false, message: r.error.message };
    try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }
    return { ok: true };
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
}

function clearLocalData(): void {
  [STORAGE_KEY, META_MOD, META_SYN, LOCK_KEY].forEach((k) => meta.removeItem(k));
}

/** Uploads pending changes, signs out, erases this device's copy and reloads (as the legacy app did). */
export async function signOut(): Promise<AuthResult> {
  try {
    if (engine.getUser()) await engine.push();
    await supabase.auth.signOut();
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
  clearLocalData();
  location.reload();
  return { ok: true };
}

/** Permanently deletes the account and cloud data. Ask the user to confirm BEFORE calling. */
export async function deleteAccount(): Promise<AuthResult> {
  try {
    const r = await supabase.rpc('delete_my_account');
    if (r.error) return { ok: false, message: r.error.message };
    await supabase.auth.signOut().catch(() => {});
  } catch {
    return { ok: false, message: NO_CONNECTION };
  }
  clearLocalData();
  location.reload();
  return { ok: true };
}
