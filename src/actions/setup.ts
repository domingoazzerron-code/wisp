import { getState, replaceState, save, stateFromBackup, defaultState } from '../state/index.ts';
import { setLimit } from '../lib/current.ts';
import { toast } from '../components/Toasts.tsx';
import { askConfirm } from '../components/Overlay.tsx';
import { TAGS } from '../components/Overlay.tsx';
import type { State } from '../state/types.ts';

/** YYYY-MM-DD for filenames (legacy ymdNow). */
export function ymdNow(now: number = Date.now()): string {
  const d = new Date(now);
  return (
    d.getFullYear() +
    '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) +
    '-' +
    ('0' + d.getDate()).slice(-2)
  );
}

/** Download a text file via a temporary anchor (legacy saveFile without Claude). */
export function saveFile(name: string, text: string, msg: string, mime: string): void {
  try {
    const b = new Blob([text], { type: mime });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(u);
    }, 500);
    toast(msg);
  } catch {
    toast('Could not save that file');
  }
}

/** Save full state as JSON backup and stamp lastBackup. */
export function saveBackupFile(): void {
  const s = getState();
  s.lastBackup = Date.now();
  save();
  saveFile(
    'cigtracker-backup-' + ymdNow() + '.json',
    JSON.stringify(s),
    'Backup saved',
    'application/json',
  );
}

/** Copy full state JSON to the clipboard (and stamp lastBackup). */
export async function copyBackupText(): Promise<void> {
  const s = getState();
  s.lastBackup = Date.now();
  save();
  const t = JSON.stringify(s);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      toast('Backup copied');
      return;
    }
  } catch { /* fall through */ }
  toast('Select all and copy the text');
}

/** Quote a CSV field (legacy csvq). */
function csvq(x: unknown): string {
  let s = String(x == null ? '' : x);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Export cigarettes + cravings as a UTF-8 CSV (legacy csvx). */
export function exportCsv(): void {
  const s = getState();
  const rows: [number, string, string, string, string][] = [];
  const p2 = (n: number) => ('0' + n).slice(-2);
  for (const t of s.log) {
    const nn = s.notes[t] || {};
    rows.push([t, 'cigarette', s.tags[t] || '', nn.m || '', nn.n || '']);
  }
  for (const t of s.cravs || []) {
    rows.push([t, 'craving', s.crt[t] || '', '', '']);
  }
  if (!rows.length) {
    toast('Nothing to export yet');
    return;
  }
  rows.sort((x, y) => x[0] - y[0]);
  const out = [['type', 'date', 'time', 'trigger', 'mood', 'note']].concat(
    rows.map((r) => {
      const d = new Date(r[0]);
      return [
        r[1],
        d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()),
        p2(d.getHours()) + ':' + p2(d.getMinutes()),
        r[2],
        r[3],
        r[4],
      ];
    }),
  );
  saveFile(
    'cigtracker-export-' + ymdNow() + '.csv',
    '\uFEFF' + out.map((r) => r.map(csvq).join(',')).join('\r\n'),
    'CSV saved',
    'text/csv',
  );
}

/**
 * Parse backup text and, after confirm, replace live state (legacy restoreFrom).
 * Returns false when the text is not a valid backup.
 */
export function restoreFromText(text: string): boolean {
  const d = stateFromBackup(text);
  if (!d) {
    toast('That backup is not valid');
    return false;
  }
  askConfirm(
    'Restore this backup?',
    'Your current data will be replaced by ' + d.log.length + ' logged entries from the backup.',
    'Restore',
    () => {
      if (d.log.length) d.setup = 1;
      replaceState(d);
      save();
      toast('Restored ' + d.log.length + ' entries');
    },
    false,
  );
  return true;
}

/** Read a File as text and run restoreFromText. */
export function restoreFromFile(file: File): void {
  if (file.size > 2e7) {
    toast('That file is too big');
    return;
  }
  const r = new FileReader();
  r.onload = () => restoreFromText(String(r.result));
  r.onerror = () => toast('Could not read that file');
  r.readAsText(file);
}

/** Add a custom trigger tag if new and not built-in. */
export function addCustomTrigger(raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  const s = getState();
  if (s.ctags.indexOf(v) >= 0 || TAGS.indexOf(v) >= 0) return false;
  s.ctags.push(v);
  save();
  return true;
}

/** Remove a custom trigger by index. */
export function removeCustomTrigger(i: number): void {
  const s = getState();
  if (i < 0 || i >= s.ctags.length) return;
  s.ctags.splice(i, 1);
  save();
}

/** Erase everything after confirm (legacy reset). Does not open first-run overlay. */
export function eraseAllData(): void {
  askConfirm(
    'Erase all data?',
    'This deletes every logged cigarette and your settings. It cannot be undone.',
    'Erase everything',
    () => {
      replaceState(defaultState());
      save();
      toast('All data erased');
    },
    true,
  );
}

/** Patch a numeric or string field on state and save. Uses setLimit for limit. */
export function patchField(key: keyof State, value: string | number | boolean): void {
  const s = getState();
  if (key === 'limit') {
    const v = typeof value === 'number' ? value : parseFloat(String(value));
    setLimit(isNaN(v) || v < 0 ? 0 : v);
    save();
    return;
  }
  if (key === 'gapWarn') {
    s.gapWarn = value ? 1 : 0;
    save();
    return;
  }
  if (key === 'name') {
    s.name = String(value);
    save();
    return;
  }
  if (key === 'cur') {
    s.cur = String(value);
    save();
    return;
  }
  const numKeys: (keyof State)[] = ['base', 'pack', 'per', 'gap', 'nic', 'tar'];
  if (numKeys.indexOf(key) >= 0) {
    let v = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(v) || v < 0) v = 0;
    if (key === 'per' && v < 1) v = 1;
    (s as unknown as Record<string, number>)[key as string] = v;
    if (key === 'base' || key === 'pack' || key === 'per') s.conf = 1;
    save();
    return;
  }
}
