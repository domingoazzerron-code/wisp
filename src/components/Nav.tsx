import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { tryLogCigarette } from '../actions/log.ts';
import { logCraving, startCrave } from '../actions/craving.ts';
import { toast } from './Toasts.tsx';
import { buzz } from '../lib/buzz.ts';

const ICON = {
  today: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  history: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  insights: <path d="M5 20V12M12 20V5M19 20v-5" />,
  plan: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
};
const LABEL = { today: 'Today', history: 'History', insights: 'Insights', plan: 'Plan' };

function Tab({ view, current }: { view: keyof typeof ICON; current: string }) {
  return (
    <a href={'#' + view} data-v={view} aria-current={current === view ? 'page' : undefined}>
      <svg viewBox="0 0 24 24">{ICON[view]}</svg>
      <span class="lb">{LABEL[view]}</span>
    </a>
  );
}

/**
 * Bottom bar: tabs, + button with long-press quick menu, sliding .dot indicator.
 */
export function Nav({ current }: { current: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [qmOpen, setQmOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const lpFired = useRef(false);
  const lpT = useRef(0);
  const tipT = useRef(0);
  const dotReady = useRef(false);
  const dotShown = useRef(false);

  // Sliding dot under the current tab (legacy placeDot).
  useLayoutEffect(() => {
    const d = dotRef.current;
    const bar = barRef.current;
    if (!d || !bar) return;
    const a = bar.querySelector('a[aria-current="page"]') as HTMLElement | null;
    if (!a) {
      d.style.opacity = '0';
      dotShown.current = false;
      return;
    }
    const jump = !dotReady.current || !dotShown.current;
    if (jump) d.style.transition = 'none';
    d.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    d.style.width = a.offsetWidth + 'px';
    d.style.opacity = '1';
    if (jump) {
      void d.offsetWidth;
      d.style.transition = '';
      dotReady.current = true;
    }
    dotShown.current = true;
  }, [current]);

  useEffect(() => {
    const onResize = () => {
      const d = dotRef.current;
      const bar = barRef.current;
      if (!d || !bar) return;
      const a = bar.querySelector('a[aria-current="page"]') as HTMLElement | null;
      if (!a) return;
      d.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      d.style.width = a.offsetWidth + 'px';
      d.style.opacity = '1';
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // One-time tip: hold + for quick actions (legacy qhShow).
  useEffect(() => {
    const s = getState();
    if (s.qh || !s.setup) return;
    s.qh = 1;
    save();
    setTip(true);
    tipT.current = window.setTimeout(() => setTip(false), 8000);
    const hide = () => {
      clearTimeout(tipT.current);
      setTip(false);
      document.removeEventListener('pointerdown', hide, true);
    };
    document.addEventListener('pointerdown', hide, true);
    return () => {
      clearTimeout(tipT.current);
      document.removeEventListener('pointerdown', hide, true);
    };
  }, []);

  useEffect(() => {
    if (!qmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQmOpen(false);
        try { addRef.current?.focus({ preventScroll: true }); } catch { /* */ }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [qmOpen]);

  function openQm() {
    lpFired.current = true;
    setQmOpen(true);
    buzz('strong');
  }

  function closeQm() {
    setQmOpen(false);
  }

  function onPlusClick() {
    if (lpFired.current) {
      lpFired.current = false;
      return;
    }
    if (qmOpen) {
      closeQm();
      return;
    }
    tryLogCigarette();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button > 0) return;
    lpFired.current = false;
    clearTimeout(lpT.current);
    lpT.current = window.setTimeout(openQm, 450);
  }

  function clearLp() {
    clearTimeout(lpT.current);
  }

  return (
    <>
      <div
        id="qscrim"
        hidden={!qmOpen}
        style={{ position: 'fixed', inset: 0, zIndex: 9 }}
        onClick={closeQm}
      />
      <nav aria-label="Main">
        <div class="bar" ref={barRef}>
          <div class="bgw"><i /></div>
          <Tab view="today" current={current} />
          <Tab view="history" current={current} />
          <button
            class="plus"
            id="add"
            type="button"
            aria-label="Log a cigarette"
            ref={addRef}
            onClick={onPlusClick}
            onPointerDown={onPointerDown as any}
            onPointerUp={clearLp}
            onPointerCancel={clearLp}
            onPointerLeave={clearLp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <Tab view="insights" current={current} />
          <Tab view="plan" current={current} />
          <i class="dot" id="dot" ref={dotRef as any} />
        </div>

        {tip ? (
          <div class="qh" id="qh" role="status">Tip: hold + for quick actions</div>
        ) : null}

        {!qmOpen ? null : (
          <div class="qm" id="qm" role="group" aria-label="Quick actions">
            <button
              type="button"
              id="qm-c"
              onClick={() => { closeQm(); logCraving(); }}
            >
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16.5 9" /></svg>
              Log a craving I got through
            </button>
            <button
              type="button"
              id="qm-w"
              onClick={() => {
                closeQm();
                if (location.hash !== '#today' && location.hash !== '') location.hash = '#today';
                startCrave();
                toast('10 minute wait started');
              }}
            >
              <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 1.5M9.5 3h5" /></svg>
              Start a 10 minute wait
            </button>
            <button
              type="button"
              id="qm-p"
              onClick={() => {
                closeQm();
                location.hash = '#history';
                setTimeout(() => window.dispatchEvent(new CustomEvent('wisp:open-past')), 50);
              }}
            >
              <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
              Add a past entry
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
