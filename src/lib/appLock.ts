// App lock via platform authenticator (Face ID / Touch ID / passcode).
// Legacy: cigtracker.lock credential id in localStorage; session flag cigtracker.unlocked.

import { LOCK_KEY } from '../sync/config.ts';

export const UNLOCK_KEY = 'cigtracker.unlocked';
/** Relock after this many ms in the background (legacy AWAY). */
export const AWAY_MS = 30_000;

export function isLockEnabled(): boolean {
  try {
    return !!localStorage.getItem(LOCK_KEY);
  } catch {
    return false;
  }
}

export function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearSessionUnlock(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function clearLockCredential(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

function b64(buf: ArrayBuffer): string {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64(t: string): ArrayBuffer {
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const s = atob(t);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a.buffer;
}

function rnd(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** True when this device can do platform user-verification (or lock is already on). */
export async function canUseAppLock(): Promise<boolean> {
  if (isLockEnabled()) return true;
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function authenticateLock(): Promise<void> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
  if (!id) throw new Error('no credential');
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: rnd(32),
      allowCredentials: [{ type: 'public-key', id: unb64(id) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!cred) throw new Error('cancelled');
}

/** Register a platform passkey and store its id. Marks session unlocked. */
export async function enableAppLock(): Promise<void> {
  const c = (await navigator.credentials.create({
    publicKey: {
      challenge: rnd(32),
      rp: { name: 'Wisp Tracker' },
      user: {
        id: rnd(16),
        name: 'wisp-tracker',
        displayName: 'Wisp Tracker',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!c) throw new Error('cancelled');
  try {
    localStorage.setItem(LOCK_KEY, b64(c.rawId));
  } catch {
    throw new Error('storage');
  }
  markUnlocked();
}

/** Verify then remove the stored credential. */
export async function disableAppLock(): Promise<void> {
  await authenticateLock();
  clearLockCredential();
}
