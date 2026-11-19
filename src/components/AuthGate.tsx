import { useEffect, useRef, useState } from 'preact/hooks';
import {
  onPasswordRecovery,
  requestPasswordReset,
  setNewPassword,
  signIn,
  signUp,
  startSync,
} from '../sync/index.ts';

type Phase = 'checking' | 'form' | 'reset' | 'leaving' | 'done';
type Mode = 'up' | 'in';

const EXIT_MS = 340;

/**
 * Wisp at the top of the sign-in card. While a password field is focused he covers his
 * eyes with both hands; otherwise his hands rest at his sides. While the email field is
 * focused his eyes look down and drift along with what you type.
 */
function AuthMascot({ covering, look, sad }: { covering: boolean; look: number; sad: boolean }) {
  // look: 0..1 = how far along the email field the typing is (-1 = not looking at it)
  const looking = look >= 0;
  const lx = looking ? -2.6 + look * 5.2 : 0;
  const ly = looking ? 2.2 : 0;
  return (
    <svg
      class={'lg' + (covering ? ' cover' : '') + (sad ? ' sad' : '')}
      viewBox="-4 -12 128 160"
      aria-hidden="true"
      style={{ '--lx': lx + 'px', '--ly': ly + 'px' }}
    >
      <ellipse class="lg-sd" cx="60" cy="140" rx="24" ry="4.5" />
      <g class="lg-bob">
        <path
          class="lg-body"
          d="M60 8C80 8 90 24 90 46L90 100Q90 112 84 118Q80 128 74 120Q68 112 62 124Q58 130 54 122Q50 114 44 122Q38 130 36 118Q30 112 30 100L30 46C30 24 40 8 60 8Z"
        />
        <circle class="lg-ch" cx="40" cy="58" r="5" />
        <circle class="lg-ch" cx="80" cy="58" r="5" />
        <g class="lg-look">
          <g class="lg-eyes">
            <ellipse cx="49" cy="46" rx="6" ry="8" fill="#14201a" />
            <ellipse cx="71" cy="46" rx="6" ry="8" fill="#14201a" />
            <circle cx="51" cy="43" r="2" fill="#fff" />
            <circle cx="73" cy="43" r="2" fill="#fff" />
          </g>
        </g>
        <path class="lg-mouth lg-smile" d="M50 66Q60 76 70 66" />
        <path class="lg-mouth lg-frown" d="M51 71Q60 64 69 71" />
        <path d="M60 10V1" stroke="#2F7A44" stroke-width="2.4" stroke-linecap="round" fill="none" />
        <path
          d="M60 3Q50 -8 42 -3Q50 4 60 3Z M60 3Q70 -10 78 -4Q70 4 60 3Z"
          fill="#6FD38A"
          stroke="#2F7A44"
          stroke-linejoin="round"
        />
        {/* Arms rotate about the shoulder: 0deg = hand over the eye, rest = hanging at the side. */}
        <g class="lg-arm lg-arm-l">
          <path d="M32 70L49 46" class="lg-arm-o" />
          <path d="M32 70L49 46" class="lg-arm-i" />
          <circle class="lg-hand" cx="49" cy="46" r="11.5" />
        </g>
        <g class="lg-arm lg-arm-r">
          <path d="M88 70L71 46" class="lg-arm-o" />
          <path d="M88 70L71 46" class="lg-arm-i" />
          <circle class="lg-hand" cx="71" cy="46" r="11.5" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Sign-in / sign-up gate (legacy #auth). Owns startSync(): the app stays behind this screen
 * until a session exists, or until sync cannot start at all (offline), in which case it
 * runs locally just like the old app did.
 */
export function AuthGate() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [mode, setMode] = useState<Mode>('up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [covering, setCovering] = useState(false);
  const [look, setLook] = useState(-1);
  const [shaking, setShaking] = useState(false);
  const recovering = useRef(false);
  const busyRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  // Boot: restore a saved session, or show the form.
  useEffect(() => {
    let alive = true;
    const off = onPasswordRecovery(() => {
      recovering.current = true;
      setMsg('');
      setPw('');
      setPhase('reset');
    });
    startSync().then((r) => {
      if (!alive || recovering.current) return;
      setPhase(r === 'signed-out' ? 'form' : 'done');
    });
    return () => { alive = false; off(); };
  }, []);

  // Focus the new-password field when the reset form appears.
  useEffect(() => {
    if (phase === 'reset') setTimeout(() => pwRef.current?.focus(), 60);
  }, [phase]);

  function finish() {
    recovering.current = false;
    setCovering(false);
    setPhase('leaving');
    setTimeout(() => setPhase('done'), EXIT_MS);
  }

  function fail(text: string) {
    setOk(false);
    setMsg(text);
    setShaking(false);
    // Next frame, so the animation restarts even on back-to-back errors.
    requestAnimationFrame(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 460);
    });
  }

  function switchMode(m: Mode) {
    if (m === mode || busy) return;
    setMode(m);
    setMsg('');
    setOk(false);
  }

  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg('');
    const r = mode === 'up' ? await signUp(email, pw) : await signIn(email, pw);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) return fail(r.message || 'Something went wrong. Try again.');
    if (r.signedIn) return finish();
    // Signed up but the email still needs confirming.
    setMode('in');
    setPw('');
    setOk(true);
    setMsg(r.message || 'Check your email to confirm your account, then sign in.');
  }

  async function forgot() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const r = await requestPasswordReset(email);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) return fail(r.message || 'Could not send the reset email.');
    setOk(true);
    setMsg(r.message || 'Password reset email sent.');
  }

  async function submitNewPassword() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg('');
    const r = await setNewPassword(pw);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) return fail(r.message || 'Could not update your password.');
    setPw('');
    finish();
  }

  function onEmailInput(v: string) {
    setEmail(v);
    setLook(Math.min(1, v.length / 28));
  }

  if (phase === 'done') return null;
  if (phase === 'checking') return <div id="auth" class="boot" aria-hidden="true" />;

  const up = mode === 'up';
  const resetting = phase === 'reset';
  const subtitle = resetting
    ? 'Choose a new password.'
    : up ? 'Create an account to save your progress.' : 'Welcome back.';

  return (
    <div
      id="auth"
      class={phase === 'leaving' ? 'out' : ''}
      role="dialog"
      aria-modal="true"
      aria-label={resetting ? 'Choose a new password' : up ? 'Sign up' : 'Sign in'}
    >
      <div class="ac">
       <div class={'shk' + (shaking ? ' on' : '')}>
        <AuthMascot covering={covering} look={look} sad={!!msg && !ok} />
        <h1>Wisp Tracker</h1>
        <p class="as" key={subtitle}>{subtitle}</p>

        {!resetting && (
          <form
            class="aform"
            noValidate
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
          >
            <div class="tabs" role="tablist" data-mode={mode}>
              <i aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={up}
                onClick={() => switchMode('up')}
              >
                Sign up
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!up}
                onClick={() => switchMode('in')}
              >
                Sign in
              </button>
            </div>

            <label for="aem">Email</label>
            <input
              id="aem"
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onInput={(e) => onEmailInput((e.target as HTMLInputElement).value)}
              onFocus={() => setLook(Math.min(1, email.length / 28))}
              onBlur={() => setLook(-1)}
            />
            <label for="apw">Password</label>
            <input
              id="apw"
              ref={pwRef}
              type="password"
              autoComplete={up ? 'new-password' : 'current-password'}
              placeholder="At least 8 characters"
              value={pw}
              onInput={(e) => setPw((e.target as HTMLInputElement).value)}
              onFocus={() => setCovering(true)}
              onBlur={() => setCovering(false)}
            />

            <div class={'am' + (ok ? ' ok' : '')} role="status" aria-live="polite">
              {msg && <span key={msg}>{msg}</span>}
            </div>

            <button type="submit" class={'btn pri blk go' + (busy ? ' busy' : '')} disabled={busy}>
              <span class="go-t" key={mode}>{up ? 'Create account' : 'Sign in'}</span>
              <span class="go-s" aria-hidden="true" />
            </button>

            <div class={'forgot' + (up ? '' : ' show')} aria-hidden={up}>
              <div>
                <button
                  type="button"
                  class="btn txt blk"
                  tabIndex={up ? -1 : 0}
                  disabled={busy}
                  onClick={() => void forgot()}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </form>
        )}

        {resetting && (
          <form
            class="aform"
            noValidate
            onSubmit={(e) => { e.preventDefault(); void submitNewPassword(); }}
          >
            <label for="rpw">New password</label>
            <input
              id="rpw"
              ref={pwRef}
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={pw}
              onInput={(e) => setPw((e.target as HTMLInputElement).value)}
              onFocus={() => setCovering(true)}
              onBlur={() => setCovering(false)}
            />
            <div class={'am' + (ok ? ' ok' : '')} role="status" aria-live="polite">
              {msg && <span key={msg}>{msg}</span>}
            </div>
            <button type="submit" class={'btn pri blk go' + (busy ? ' busy' : '')} disabled={busy}>
              <span class="go-t">Update password</span>
              <span class="go-s" aria-hidden="true" />
            </button>
          </form>
        )}
       </div>
      </div>
    </div>
  );
}
