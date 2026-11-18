// Side-effectful challenge helpers: check, start, stop.
// Pure rules live in src/lib/challenges.ts.

import { getState, save } from '../state/index.ts';
import { toast } from '../components/Toasts.tsx';
import { alertBox, askConfirm } from '../components/Overlay.tsx';
import { clearPoke } from '../components/pokeState.ts';
import { buzz } from '../lib/buzz.ts';
import { liveIndex, lastTs } from '../lib/current.ts';
import {
  CHT,
  challengeEnded,
  chalCtx,
  endChalPatch,
  todayFails,
  type ChallengeId,
} from '../lib/challenges.ts';
import { dayAdd, startOfDay } from '../lib/dates.ts';

/**
 * If the active challenge finished (win or lose), apply the end patch.
 * Returns true when it just ended (legacy checkChallenge).
 */
export function checkChallenge(now: number = Date.now()): boolean {
  const s = getState();
  const c = s.chal;
  if (!c || !c.id || !CHT[c.id as ChallengeId]) return false;
  const ctx = chalCtx(s, liveIndex, now);
  const ended = challengeEnded(c, ctx, lastTs());
  if (!ended) return false;

  const patch = endChalPatch(c, ended.ok, now, s.stars || 0, s.earned || 0, s.badges || {});
  s.chal = patch.chal;
  s.cres = patch.cres;
  if (patch.ok) {
    if (patch.badges) s.badges = patch.badges;
    if (patch.stars != null) s.stars = patch.stars;
    if (patch.earned != null) s.earned = patch.earned;
    if (patch.cel) s.cel = patch.cel;
    save();
    buzz('heal');
    clearPoke();
    if (patch.toast) toast(patch.toast);
    const parts = patch.cres.k.split('-');
    const nm = CHT[parts[0] as ChallengeId]?.n || 'Challenge';
    alertBox(
      'Challenge complete',
      nm + ', ' + c.days + ' days. You earned a badge and ' + patch.cres.s + ' stars.',
      true,
    );
  } else {
    save();
  }
  return true;
}

/** Start a 3- or 7-day challenge. If today already fails, starts tomorrow. */
export function startChallenge(id: ChallengeId, days: 3 | 7, now: number = Date.now()): void {
  if (!CHT[id]) return;
  const s = getState();
  const ctx = chalCtx(s, liveIndex, now);
  const td = startOfDay(now);
  let st = td;
  let later = false;
  if (todayFails(id, ctx)) {
    st = dayAdd(td, 1);
    later = true;
  }
  s.chal = { id, days, start: st, grace: days >= 7 ? 1 : 0 };
  s.cres = null;
  save();
  toast(later ? 'Starts tomorrow, since today already went past it.' : 'Challenge started. Wisp is in.');
}

/** Clear the active challenge after confirm. */
export function stopChallenge(): void {
  const s = getState();
  if (!s.chal || !s.chal.id) return;
  askConfirm(
    'Stop this challenge?',
    'Your progress on it will be cleared.',
    'Stop challenge',
    () => {
      const st = getState();
      st.chal = { id: '', days: 0, start: 0, grace: 0 };
      save();
    },
    true,
  );
}
