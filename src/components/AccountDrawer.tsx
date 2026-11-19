import { useEffect, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { GHOST_SVG } from './ghost.ts';
import { unlockOutfit, wearOutfit } from '../actions/evolution.ts';
import {
  FORM, hasOutfit, OUTFIT_NAME, OUTFIT_PRICE, OUTFIT_MIN_STAGE, OUTFIT_TEXT, OUTFITS,
} from '../lib/evolution.ts';
import type { Outfit } from '../state/types.ts';
import { applyFx, applyOutfitAttr, applyTheme, fxLevel, type Theme } from '../lib/theme.ts';
import {
  deleteAccount,
  getSyncStatus,
  getSyncUser,
  isSignedIn,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  subscribeSyncStatus,
} from '../sync/index.ts';
import { askConfirm } from './Overlay.tsx';
import { toast } from './Toasts.tsx';
import { AppLockToggle } from './AppLock.tsx';

/**
 * Account drawer (legacy #acct): outfit, app lock, sign-in. Appearance and motion live in Settings.
 */
export function AccountDrawer({
  open,
  onClose,
  onBack,
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  useStore();
  const s = getState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(getSyncStatus());
  const [signedIn, setSignedIn] = useState(isSignedIn());
  const user = getSyncUser();

  // Keep data-theme / data-fx / data-outfit in sync with state.
  useEffect(() => {
    applyTheme((s.theme as Theme) || 'auto');
    applyFx(fxLevel(s));
    applyOutfitAttr(s.outfit || 'none');
  }, [s.theme, s.fx, s.hap, s.outfit]);

  useEffect(() => {
    const unsub = subscribeSyncStatus(() => setStatus(getSyncStatus()));
    const tick = () => setSignedIn(isSignedIn());
    const id = setInterval(tick, 1500);
    tick();
    return () => {
      unsub();
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function pickOutfit(id: Outfit) {
    const st = getState();
    if (hasOutfit(id, st.owned || [], st.evo || 0)) wearOutfit(id);
    else unlockOutfit(id);
  }

  async function doSignIn() {
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if (!r.ok) {
      toast(r.message || 'Could not sign in');
      return;
    }
    setSignedIn(true);
    toast(r.signedIn ? 'Signed in' : r.message || 'Check your email');
  }

  async function doSignUp() {
    setBusy(true);
    const r = await signUp(email, password);
    setBusy(false);
    if (!r.ok) {
      toast(r.message || 'Could not sign up');
      return;
    }
    if (r.signedIn) setSignedIn(true);
    toast(r.message || (r.signedIn ? 'Account created' : 'Check your email to confirm'));
  }

  async function doReset() {
    setBusy(true);
    const r = await requestPasswordReset(email);
    setBusy(false);
    toast(r.message || (r.ok ? 'Email sent' : 'Could not send reset'));
  }

  function doSignOut() {
    askConfirm(
      'Sign out?',
      'Your data on this device will be cleared after a final sync.',
      'Sign out',
      () => {
        void signOut();
      },
    );
  }

  function doDelete() {
    askConfirm(
      'Delete account?',
      'This permanently removes your login and cloud data. This cannot be undone.',
      'Delete account',
      () => {
        void deleteAccount().then((r) => {
          if (!r.ok) toast(r.message || 'Could not delete account');
        });
      },
      true,
    );
  }

  const evo = s.evo || 0;
  const owned = s.owned || [];
  const stars = s.stars || 0;
  const current = (s.outfit || 'none') as Outfit;

  return (
    <aside
      class={'drawer' + (open ? ' open' : '')}
      id="acct"
      aria-label="Account"
      aria-hidden={!open}
    >
      <div class="dh" style={{ '--i': 0 }}>
        <span class="dtl">
          <button
            class="dclose"
            type="button"
            aria-label="Back to menu"
            onClick={() => (onBack ? onBack() : onClose())}
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span>Account</span>
        </span>
        <button class="dclose" type="button" aria-label="Close account" onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="acc-id" style={{ '--i': 1 }}>
        <b id="dem">{signedIn && user ? user.email || 'Signed in' : 'Not signed in'}</b>
        <small id="dsy">{signedIn ? status || 'Cloud sync on' : 'Local only'}</small>
      </div>

      <div class="dg dgs" style={{ '--i': 2 }}>
        <span>Wisp’s outfit</span>
        <span id="dstars">★ {stars}</span>
      </div>

      <div class="pref" style={{ '--i': 3 }}>
        <div class="stage">
          <div
            class="opv"
            id="opv"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: GHOST_SVG }}
            data-outfit={current}
          />
          <div class="k" id="ofn">
            {OUTFIT_TEXT[current]} · {FORM[evo] || 'Wisp'}
          </div>
        </div>
        <div class="ofg" id="ofs" role="group" aria-label="Wisp outfit">
          {OUTFITS.map((id) => {
            const locked = !hasOutfit(id, owned, evo);
            const pr = OUTFIT_PRICE[id] || 0;
            const min = OUTFIT_MIN_STAGE[id];
            const label = locked
              ? '★ ' + pr + (min != null ? ' or ' + FORM[min] : '')
              : '';
            return (
              <button
                key={id}
                type="button"
                class={'otb' + (id === current ? ' on' : '') + (locked ? ' lk' : '')}
                data-o={id}
                aria-pressed={id === current}
                aria-label={
                  OUTFIT_NAME[id] +
                  (locked
                    ? ', ' +
                      pr +
                      ' stars' +
                      (min != null ? ', or reach ' + FORM[min] : '')
                    : '')
                }
                onClick={() => pickOutfit(id)}
              >
                <span
                  class="ot"
                  dangerouslySetInnerHTML={{ __html: GHOST_SVG }}
                  data-outfit={id}
                />
                <em>{OUTFIT_NAME[id]}</em>
                <i>{label}</i>
              </button>
            );
          })}
        </div>
      </div>

      <div class="accs" style={{ '--i': 4 }}>
        <div class="dg">Account</div>
        <AppLockToggle />
        {signedIn ? (
          <>
            <a
              href="#"
              id="dout"
              onClick={(e) => {
                e.preventDefault();
                doSignOut();
              }}
            >
              Sign out
            </a>
            <a
              href="#"
              id="ddel"
              class="dng"
              onClick={(e) => {
                e.preventDefault();
                doDelete();
              }}
            >
              Delete account
              <small>Removes your login and cloud data</small>
            </a>
          </>
        ) : (
          <div class="pref" style={{ padding: '8px 0 4px' }}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              />
            </label>
            <div class="btnrow" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <button class="btn pri sm" type="button" disabled={busy} onClick={doSignIn}>
                Sign in
              </button>
              <button class="btn sec sm" type="button" disabled={busy} onClick={doSignUp}>
                Create account
              </button>
              <button class="btn txt sm" type="button" disabled={busy} onClick={doReset}>
                Reset password
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
