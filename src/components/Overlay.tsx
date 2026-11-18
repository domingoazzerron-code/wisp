import { useEffect, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { toast } from './Toasts.tsx';
import { buzz } from '../lib/buzz.ts';
import { tm } from '../lib/format.ts';

/** Built-in trigger tags (legacy TAGS). */
export const TAGS = ['Stress', 'Coffee', 'After meal', 'Social', 'Boredom', 'Work break'];

type ChipMap = Record<string, string>;

interface OverlayState {
  open: boolean;
  title: string;
  body: string;
  warn: boolean;
  danger: boolean;
  okLabel: string;
  cancelLabel: string;
  showCancel: boolean;
  chips: string[] | null;
  chipKey: string | null; // timestamp string for tags/crt
  chipMap: 'tags' | 'crt' | null;
  allowClearChip: boolean;
  onOk: (() => void) | null;
  onCancel: (() => void) | null;
}

const idle: OverlayState = {
  open: false,
  title: '',
  body: '',
  warn: false,
  danger: false,
  okLabel: 'OK',
  cancelLabel: 'Cancel',
  showCancel: false,
  chips: null,
  chipKey: null,
  chipMap: null,
  allowClearChip: false,
  onOk: null,
  onCancel: null,
};

let state: OverlayState = { ...idle };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function setState(patch: Partial<OverlayState>): void {
  state = { ...state, ...patch };
  emit();
}

function openBase(partial: Partial<OverlayState>): void {
  state = {
    ...idle,
    open: true,
    okLabel: 'OK',
    cancelLabel: 'Cancel',
    showCancel: false,
    ...partial,
  };
  emit();
  try {
    if (partial.warn) buzz('strong');
  } catch { /* ignore */ }
}

/** Simple alert (legacy alertBox). */
export function alertBox(title: string, body: string, warn = false): void {
  openBase({ title, body, warn, onOk: null, showCancel: false });
}

/** Confirm dialog (legacy askConfirm). */
export function askConfirm(
  title: string,
  body: string,
  okLabel: string,
  onOk: () => void,
  danger = false,
): void {
  openBase({
    title,
    body,
    okLabel,
    danger,
    showCancel: true,
    cancelLabel: 'Cancel',
    onOk,
    onCancel: null,
  });
}

/**
 * Confirm with a custom cancel action (e.g. askLate "No, I had one").
 */
export function askConfirmDual(
  title: string,
  body: string,
  okLabel: string,
  onOk: () => void,
  cancelLabel: string,
  onCancel: () => void,
  danger = false,
): void {
  openBase({
    title,
    body,
    okLabel,
    cancelLabel,
    showCancel: true,
    danger,
    onOk,
    onCancel,
  });
}

/** Show trigger chips for a log or craving timestamp (legacy slipPrompt). */
export function slipPrompt(
  ts: number,
  clear = false,
  map: 'tags' | 'crt' = 'tags',
): void {
  const s = getState();
  const chips = TAGS.concat(s.ctags || []);
  // Keep current title/body if an alert is already open; otherwise minimal prompt.
  if (!state.open) {
    openBase({
      title: 'What set it off?',
      body: 'Pick one, or tap OK to skip.',
      chips,
      chipKey: String(ts),
      chipMap: map,
      allowClearChip: clear,
      showCancel: false,
    });
  } else {
    setState({
      chips,
      chipKey: String(ts),
      chipMap: map,
      allowClearChip: clear,
    });
  }
}

/** Open the trigger picker for a log entry (legacy pickTrigger). */
export function pickTrigger(ts: number): void {
  openBase({
    title: 'What set it off?',
    body: 'Entry at ' + tm(ts),
    chips: TAGS.concat(getState().ctags || []),
    chipKey: String(ts),
    chipMap: 'tags',
    allowClearChip: true,
    showCancel: false,
  });
}

export function closeOverlay(): void {
  state = { ...idle };
  emit();
}

function pickChip(v: string): void {
  const s = getState();
  const key = state.chipKey;
  if (!key || !state.chipMap) return;
  if (state.chipMap === 'tags') {
    if (v) s.tags = { ...s.tags, [key]: v };
    else {
      const next = { ...s.tags };
      delete next[key];
      s.tags = next;
    }
  } else {
    if (v) s.crt = { ...s.crt, [key]: v };
    else {
      const next = { ...s.crt };
      delete next[key];
      s.crt = next;
    }
  }
  save();
  closeOverlay();
  toast(v ? 'Trigger: ' + v : 'Trigger cleared');
}

/**
 * Modal overlay mounted once in the app shell (legacy #ov / #box).
 */
export function Overlay() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state.open]);

  if (!state.open) return null;

  const s = getState();
  const selected =
    state.chipKey && state.chipMap
      ? (state.chipMap === 'tags' ? s.tags[state.chipKey] : s.crt[state.chipKey])
      : undefined;

  return (
    <div
      class="ov"
      id="ov"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
    >
      <div
        class={'box' + (state.warn ? ' w' : '')}
        id="box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ot"
        aria-describedby="op"
        tabIndex={-1}
      >
        <h3 id="ot">{state.title}</h3>
        <p id="op">{state.body}</p>
        {state.chips ? (
          <div class="chips" id="slipc">
            {state.chips.map((t) => (
              <button
                key={t}
                type="button"
                class={'chip' + (selected === t ? ' on' : '')}
                onClick={() => pickChip(t)}
              >
                {t}
              </button>
            ))}
            {state.allowClearChip && selected ? (
              <button type="button" class="chip" onClick={() => pickChip('')}>
                No trigger
              </button>
            ) : null}
          </div>
        ) : null}
        <div class="sheetbtns">
          <button
            class={'btn ' + (state.danger ? 'dng' : 'pri') + ' blk'}
            id="ok"
            type="button"
            onClick={() => {
              const cb = state.onOk;
              closeOverlay();
              if (cb) cb();
            }}
          >
            {state.okLabel}
          </button>
          {state.showCancel ? (
            <button
              class="btn sec blk"
              id="cx"
              type="button"
              onClick={() => {
                const cb = state.onCancel;
                closeOverlay();
                if (cb) cb();
              }}
            >
              {state.cancelLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
