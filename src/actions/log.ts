import { addEntry, getState, removeEntry, restoreEntry, save } from '../state/index.ts';
import { toast } from '../components/Toasts.tsx';
import { alertBox, slipPrompt } from '../components/Overlay.tsx';
import { lim, countSince, lastTs, liveIndex, gapLeft } from '../lib/current.ts';
import { gapData, logCelebration } from '../lib/gaps.ts';
import { startOfDay } from '../lib/dates.ts';
import { dur, tm } from '../lib/format.ts';
import { startCrave } from './craving.ts';
import { askConfirmDual } from '../components/Overlay.tsx';

/**
 * Logs one cigarette now and gives feedback (legacy doLog).
 * Over-limit / limit-reached use alertBox; over-limit also opens the trigger prompt.
 */
export function logCigarette(): void {
  const t0 = Date.now();
  const cel = logCelebration(gapData(liveIndex, t0), lastTs(), t0);
  if (cel) getState().cel = cel;
  const now = addEntry(t0);
  const t = countSince(1);
  const L = lim();
  if (L > 0 && t > L) {
    alertBox(
      'Past today’s limit',
      'That’s ' + t + ' today, ' + (t - L) + ' past your limit of ' + L + '. A slip happens, and tomorrow starts fresh. What set it off?',
      false,
    );
    slipPrompt(now, false, 'tags');
  } else if (L > 0 && t === L) {
    alertBox('Limit reached', 'That was your last one for today (limit ' + L + ').', true);
  } else {
    toast('Logged at ' + tm(now) + '. ' + t + ' today');
  }
}

/**
 * + button path: if a minimum gap is still running and gapWarn is on, ask first (legacy askEarly).
 */
export function tryLogCigarette(): void {
  const s = getState();
  const r = gapLeft();
  if (r > 0 && s.gapWarn !== 0) {
    askEarly(r);
    return;
  }
  logCigarette();
}

/** Gap not finished yet (legacy askEarly). */
export function askEarly(remainingMs: number): void {
  const s = getState();
  askConfirmDual(
    'Your gap isn’t done yet',
    dur(remainingMs) + ' left of your ' + s.gap + ' minute gap. Every extra minute counts. You can wait it out or log it, both are fine.',
    'Wait it out · 10 min',
    () => {
      startCrave();
      toast('10 minute wait started');
    },
    'Log anyway',
    () => logCigarette(),
  );
}

/** True when the newest entry is from today (only then can it be undone from Today). */
export function canUndoLast(): boolean {
  const ul = lastTs();
  return !!ul && startOfDay(ul) === startOfDay(Date.now());
}

export function undoLast(): void {
  const log = getState().log;
  if (!log.length) return;
  const rec = removeEntry(log[log.length - 1]);
  if (rec) toast('Last entry removed', 'Undo', () => { restoreEntry(rec); toast('Entry restored'); });
}

/** Delete one log entry from History, with Undo (legacy hlist del). */
export function deleteLogEntry(ts: number): void {
  const rec = removeEntry(ts);
  if (rec) toast('Entry deleted', 'Undo', () => { restoreEntry(rec); toast('Entry restored'); });
}

/**
 * Add or edit a past entry (legacy padd). `editTs` is the old timestamp when editing.
 * Returns true if saved. Caller should open the trigger prompt for a brand-new entry with no tag.
 */
export function savePastEntry(
  when: number,
  mood: string,
  note: string,
  editTs: number | null,
): boolean {
  if (isNaN(when)) {
    toast('Pick a date and time');
    return false;
  }
  if (when > Date.now() + 6e4) {
    toast('That time is in the future');
    return false;
  }
  const s = getState();
  if (editTs) {
    const i = s.log.indexOf(editTs);
    if (i > -1) {
      s.log[i] = when;
      if (s.tags[editTs]) {
        s.tags[when] = s.tags[editTs];
        delete s.tags[editTs];
      }
    }
    delete s.notes[editTs];
  } else {
    s.log.push(when);
  }
  const nv: { m?: string; n?: string } = {};
  if (mood) nv.m = mood;
  if (note.trim()) nv.n = note.trim();
  if (nv.m || nv.n) s.notes[when] = nv;
  s.log.sort((a, b) => a - b);
  save();
  toast('Saved');
  return true;
}
