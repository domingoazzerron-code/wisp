import { useEffect, useRef, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { setLimit } from '../lib/current.ts';
import { useStore } from '../hooks/useStore.ts';
import { toast } from './Toasts.tsx';

/**
 * First-run setup overlay (legacy #su).
 * Shown when `S.setup` is falsy. Completing or skipping sets setup=1.
 */
export function Onboarding() {
  useStore();
  const s = getState();
  const open = !s.setup;
  const boxRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(s.name || '');
  const [why, setWhy] = useState(s.reasons || '');
  const [base, setBase] = useState(String(s.base));
  const [limit, setLimitVal] = useState(String(s.limit));
  const [pack, setPack] = useState(String(s.pack));
  const [per, setPer] = useState(String(s.per));
  const [cur, setCur] = useState(s.cur || '');

  // Re-sync form when overlay opens with current defaults.
  useEffect(() => {
    if (!open) return;
    const st = getState();
    setName(st.name || '');
    setWhy(st.reasons || '');
    setBase(String(st.base));
    setLimitVal(String(st.limit));
    setPack(String(st.pack));
    setPer(String(st.per));
    setCur(st.cur || '');
    try {
      boxRef.current?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }, [open]);

  // Simple focus trap while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !boxRef.current) return;
      const focusable = [
        ...boxRef.current.querySelectorAll<HTMLElement>('input,textarea,button'),
      ].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const a = document.activeElement;
      if (e.shiftKey && (a === boxRef.current || a === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && a === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function finish(skip: boolean) {
    const st = getState();
    if (!skip) {
      st.conf = 1;
      const sw = why.trim();
      if (sw) st.reasons = sw.slice(0, 200);
      st.name = name.trim();
      const n = (raw: string, min: number, fallback: number) => {
        const v = parseFloat(raw);
        return isNaN(v) || v < min ? fallback : v;
      };
      st.base = n(base, 0, st.base);
      setLimit(n(limit, 0, st.limit));
      st.pack = n(pack, 0, st.pack);
      st.per = Math.max(1, n(per, 1, st.per));
      const c = cur.trim();
      if (c) st.cur = c;
    }
    st.setup = 1;
    save();
    if (!skip) toast('All set. Tap + to log one');
  }

  if (!open) return null;

  return (
    <div class="ov" id="su">
      <div
        class="box"
        id="subox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sut"
        tabIndex={-1}
        ref={boxRef}
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}
      >
        <h3 id="sut">Let’s set you up</h3>
        <p>Takes about 30 seconds. You can change all of this later in Settings.</p>

        <label>
          Your name
          <input
            type="text"
            maxLength={20}
            placeholder="Optional"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
          />
        </label>

        <label class="stack">
          <span>
            Why do you want to cut down?
            <small>Optional. Wisp shows this when a craving hits</small>
          </span>
          <textarea
            rows={2}
            maxLength={200}
            placeholder="e.g. To breathe easier and save for my trip"
            value={why}
            onInput={(e) => setWhy((e.target as HTMLTextAreaElement).value)}
          />
        </label>

        <label>
          <span>
            Cigarettes per day now
            <small>Your usual, before cutting down</small>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={base}
            onInput={(e) => setBase((e.target as HTMLInputElement).value)}
          />
        </label>

        <label>
          <span>
            Daily limit
            <small>What you want to stay under</small>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={limit}
            onInput={(e) => setLimitVal((e.target as HTMLInputElement).value)}
          />
        </label>

        <label>
          Price per pack
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={pack}
            onInput={(e) => setPack((e.target as HTMLInputElement).value)}
          />
        </label>

        <label>
          Cigarettes per pack
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={per}
            onInput={(e) => setPer((e.target as HTMLInputElement).value)}
          />
        </label>

        <label>
          Currency symbol
          <input
            type="text"
            maxLength={4}
            value={cur}
            onInput={(e) => setCur((e.target as HTMLInputElement).value)}
          />
        </label>

        <div class="sheetbtns u-mt14">
          <button class="btn pri blk" type="button" onClick={() => finish(false)}>
            Start tracking
          </button>
          <button class="btn txt blk" type="button" onClick={() => finish(true)}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
