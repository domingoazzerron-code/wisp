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
  add: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
};

const SLOTS = ['today', 'history', 'add', 'insights', 'plan'] as const;
const PAD = 8; // matches .bar horizontal padding
const H = 60; // pill height (--nb)
const ORB = 52; // bubble diameter (--ps)
const ORB_CY = 3; // bubble centre, measured from the pill's top edge

/** Pill outline with a smooth scoop under the bubble at x = cx (null = plain pill). */
function glassPath(W: number, cx: number | null): string {
  const r = H / 2;
  if (cx == null) return `M${r} 0H${W - r}A${r} ${r} 0 0 1 ${W - r} ${H}H${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  const A = 50, D = 37, S = 22;
  const arcY = (x: number) => r - Math.sqrt(Math.max(0, r * r - (r - x) * (r - x)));
  let xl = cx - A, yl = 0, xr = cx + A, yr = 0;
  if (xl < r) { xl = Math.max(xl, 9); yl = arcY(xl); }
  if (xr > W - r) { xr = Math.min(xr, W - 9); yr = arcY(W - xr); }
  const f = (n: number) => n.toFixed(2);
  const k = 0.42;
  let d = `M${f(xl)} ${f(yl)}`;
  d += `C${f(xl + (cx - xl) * k)} ${f(yl)} ${f(cx - S)} ${D} ${f(cx)} ${D}`;
  d += `C${f(cx + S)} ${D} ${f(xr - (xr - cx) * k)} ${f(yr)} ${f(xr)} ${f(yr)}`;
  d += xr > W - r ? `A${r} ${r} 0 0 1 ${W - r} ${H}` : `H${W - r}A${r} ${r} 0 0 1 ${W - r} ${H}`;
  d += `H${r}`;
  d += xl < r ? `A${r} ${r} 0 0 1 ${f(xl)} ${f(yl)}Z` : `A${r} ${r} 0 0 1 ${r} 0H${f(xl)}Z`;
  return d;
}

const LABEL = { today: 'Today', history: 'History', insights: 'Insights', plan: 'Plan' };

function Tab({ view, current }: { view: keyof typeof LABEL; current: string }) {
  return (
    <a href={'#' + view} data-v={view} aria-current={current === view ? 'page' : undefined}>
      <svg viewBox="0 0 24 24">{ICON[view]}</svg>
      <span class="lb">{LABEL[view]}</span>
    </a>
  );
}

/**
 * Floating glass bar: tabs and a + button (long-press quick menu). The active tab lifts out of the pill as a bubble.
 */
export function Nav({ current }: { current: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [qmOpen, setQmOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const lpFired = useRef(false);
  const lpT = useRef(0);
  const tipT = useRef(0);

  // Glass pill: the scoop and the bubble glide to the current tab together.
  const idx = (SLOTS as readonly string[]).indexOf(current);
  const widthRef = useRef(0);
  const xRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const vRef = useRef(0);
  const tgtRef = useRef(0);
  const lastRef = useRef(0);

  const draw = (x: number | null) => {
    const W = widthRef.current;
    const d = glassPath(W, x);
    const gf = glassRef.current;
    if (gf) gf.style.clipPath = `path('${d}')`;
    barRef.current?.querySelectorAll('.gsh path, .gs path').forEach((p) => p.setAttribute('d', d));
    const o = orbRef.current;
    if (o) {
      o.style.opacity = x == null ? '0' : '1';
      if (x != null) {
        const q = Math.min(0.14, Math.abs(vRef.current) / 5000); // stretch while moving
        o.style.transform = `translate(${x - ORB / 2}px,${ORB_CY - ORB / 2}px) scale(${1 + q},${1 - q * 0.8})`;
      }
    }
    xRef.current = x;
  };

  const centreOf = (i: number) => PAD + ((widthRef.current - PAD * 2) / 5) * (i + 0.5);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      widthRef.current = bar.offsetWidth;
      const svgs = bar.querySelectorAll('svg.gsh, svg.gs');
      svgs?.forEach((v) => v.setAttribute('viewBox', `0 0 ${widthRef.current} ${H}`));
      tgtRef.current = idx >= 0 ? centreOf(idx) : 0;
      vRef.current = 0;
      draw(idx >= 0 ? tgtRef.current : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Damped spring: interruptible and frame-rate independent.
  const step = (now: number) => {
    const to = tgtRef.current;
    const dt = Math.min(0.032, (now - lastRef.current) / 1000 || 0.016);
    lastRef.current = now;
    const x = xRef.current ?? to;
    const K = 300, C = 2 * 0.74 * Math.sqrt(K);
    vRef.current += (-K * (x - to) - C * vRef.current) * dt;
    const nx = x + vRef.current * dt;
    if (Math.abs(nx - to) < 0.04 && Math.abs(vRef.current) < 0.6) { vRef.current = 0; draw(to); return; }
    draw(nx);
    rafRef.current = requestAnimationFrame(step);
  };

  useLayoutEffect(() => {
    const stop = () => cancelAnimationFrame(rafRef.current);
    stop();
    if (!widthRef.current) return stop;
    if (idx < 0) { draw(null); return stop; }
    tgtRef.current = centreOf(idx);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (xRef.current == null || reduce) { vRef.current = 0; draw(tgtRef.current); return stop; }
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
    return stop;
  }, [current]);

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
          <svg class="gsh" aria-hidden="true"><path class="a" /><path class="b" /><path class="c" /><path class="d" /><path class="e" /></svg>
          <div class="gf" ref={glassRef} aria-hidden="true" />
          <svg class="gs" aria-hidden="true">
            <defs>
              <linearGradient id="gstroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="s1" />
                <stop offset="1" class="s2" />
              </linearGradient>
            </defs>
            <path stroke="url(#gstroke)" />
          </svg>
          <i class="hb" aria-hidden="true" />
          <div class="orb" ref={orbRef} aria-hidden="true">
            <svg viewBox="0 0 24 24" key={current}>{(ICON as any)[current]}</svg>
          </div>
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
            <svg viewBox="0 0 24 24">{ICON.add}</svg>
          </button>
          <Tab view="insights" current={current} />
          <Tab view="plan" current={current} />
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
