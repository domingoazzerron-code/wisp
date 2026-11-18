import { useEffect, useState } from 'preact/hooks';
import {
  AWAY_MS,
  authenticateLock,
  canUseAppLock,
  clearSessionUnlock,
  disableAppLock,
  enableAppLock,
  isLockEnabled,
  isSessionUnlocked,
  markUnlocked,
} from '../lib/appLock.ts';
import { alertBox } from './Overlay.tsx';
import { isSignedIn, signOut } from '../sync/index.ts';

const GHOST =
  '<svg class="lg" viewBox="0 -6 120 150" aria-hidden="true"><path d="M60 8C80 8 90 24 90 46L90 100Q90 112 84 118Q80 128 74 120Q68 112 62 124Q58 130 54 122Q50 114 44 122Q38 130 36 118Q30 112 30 100L30 46C30 24 40 8 60 8Z" fill="#fff" stroke="#CBD3CE" stroke-width="3"/><circle cx="40" cy="58" r="5" fill="#FF9AA2" opacity=".6"/><circle cx="80" cy="58" r="5" fill="#FF9AA2" opacity=".6"/><ellipse cx="49" cy="46" rx="6" ry="8" fill="#14201a"/><ellipse cx="71" cy="46" rx="6" ry="8" fill="#14201a"/><circle cx="51" cy="43" r="2" fill="#fff"/><circle cx="73" cy="43" r="2" fill="#fff"/><path d="M50 66Q60 76 70 66" fill="none" stroke="#14201a" stroke-width="2.6" stroke-linecap="round"/><path d="M60 10V1" stroke="#2F7A44" stroke-width="2.4" stroke-linecap="round"/><path d="M60 3Q50 -8 42 -3Q50 4 60 3Z M60 3Q70 -10 78 -4Q70 4 60 3Z" fill="#6FD38A" stroke="#2F7A44" stroke-linejoin="round"/></svg>';

/**
 * Full-screen app lock overlay (legacy #lock).
 * Also exports helpers for the Account drawer toggle.
 */
export function AppLock() {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLockEnabled() && !isSessionUnlocked()) {
      setVisible(true);
      // Quiet auto-prompt on cold start.
      void tryUnlock(true);
    }

    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (isLockEnabled() && hiddenAt && Date.now() - hiddenAt > AWAY_MS) {
        hiddenAt = 0;
        clearSessionUnlock();
        setVisible(true);
        setMsg('');
        void tryUnlock(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(quiet: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await authenticateLock();
      markUnlocked();
      setVisible(false);
      setMsg('');
    } catch {
      if (!quiet) setMsg('Could not unlock. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function onSignOut() {
    if (isSignedIn()) {
      void signOut();
    } else {
      // No cloud session — just clear local unlock attempt message.
      setMsg('Sign in from Account after unlocking, or turn lock off once unlocked.');
    }
  }

  if (!visible) return null;

  return (
    <div id="lock" role="dialog" aria-modal="true" aria-label="Locked">
      <div class="lc">
        <div dangerouslySetInnerHTML={{ __html: GHOST }} />
        <h1>Wisp Tracker is locked</h1>
        <p>Unlock to continue.</p>
        <button type="button" class="btn pri blk" id="lkgo" disabled={busy} onClick={() => void tryUnlock(false)}>
          Unlock
        </button>
        <div class="lm" id="lkm" role="status">
          {msg}
        </div>
        <button
          type="button"
          class="btn txt blk"
          id="lkso"
          style={{ marginTop: 4 }}
          onClick={onSignOut}
        >
          Can’t unlock? Sign out
        </button>
      </div>
    </div>
  );
}

/** Account-drawer row: toggle app lock. Returns null when platform auth is unavailable. */
export function AppLockToggle() {
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(isLockEnabled());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void canUseAppLock().then(setAvailable);
  }, []);

  async function toggle(e: Event) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (isLockEnabled()) {
        try {
          await disableAppLock();
          setOn(false);
        } catch {
          alertBox(
            'App lock stays on',
            'Verify with Face ID or your passcode to turn it off.',
          );
        }
      } else {
        try {
          await enableAppLock();
          setOn(true);
        } catch {
          alertBox(
            'Could not turn on app lock',
            'Check that Face ID or a passcode is set up on this device.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (!available && !on) return null;

  return (
    <a
      href="#"
      id="dlock"
      onClick={toggle}
      aria-busy={busy}
    >
      App lock
      <small id="dlocks">{on ? 'On, locks when you leave the app' : 'Off'}</small>
    </a>
  );
}
