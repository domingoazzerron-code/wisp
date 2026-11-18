import { useEffect, useState } from 'preact/hooks';

// Toasts: call toast() from anywhere. Exit animation = a short "off" class before removal (CSS: .toast.off).

interface ToastItem { id: number; msg: string; action?: { label: string; run: () => void }; off: boolean }

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function dismiss(id: number, immediately = false): void {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  if (immediately) { items = items.filter((x) => x.id !== id); emit(); return; }
  if (it.off) return;
  it.off = true;
  emit();
  setTimeout(() => { items = items.filter((x) => x.id !== id); emit(); }, 220);
}

/** Shows a toast. With `actionLabel` + `onAction` it stays 5 s and gets a button; otherwise 2.2 s. Max 3 at once. */
export function toast(msg: string, actionLabel?: string, onAction?: () => void): void {
  const hasAction = !!(actionLabel && onAction);
  if (!hasAction) {
    // same plain message again: replace it instead of stacking
    for (const it of items) if (!it.action && it.msg === msg) dismiss(it.id, true);
  }
  const id = nextId++;
  items = [...items, { id, msg, off: false, action: hasAction ? { label: actionLabel!, run: onAction! } : undefined }];
  while (items.length > 3) items = items.slice(1);
  emit();
  setTimeout(() => dismiss(id), hasAction ? 5000 : 2200);
}

export function Toasts() {
  const [, setN] = useState(0);
  useEffect(() => {
    const fn = () => setN((x) => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return (
    <div id="toasts" role="status" aria-live="polite">
      {items.map((it) => (
        <div key={it.id} class={'toast' + (it.action ? ' act' : '') + (it.off ? ' off' : '')}>
          <span>{it.msg}</span>
          {it.action && (
            <button type="button" class="tact" onClick={() => { dismiss(it.id); it.action!.run(); }}>{it.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
