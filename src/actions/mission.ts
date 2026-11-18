// Side-effectful mission helpers: ensure, check, mark done, swap.
// Pure rules live in src/lib/missions.ts.

import { getState, save } from '../state/index.ts';
import { toast } from '../components/Toasts.tsx';
import { clearPoke } from '../components/pokeState.ts';
import { buzz } from '../lib/buzz.ts';
import { liveIndex } from '../lib/current.ts';
import {
  completeMissionPatch,
  ensureMission,
  misNew,
  misPick,
  missionComplete,
  missionCtx,
  type MissionId,
} from '../lib/missions.ts';

/** Make sure today's mission exists; write + save if it had to be created. */
export function ensureTodayMission(now: number = Date.now()): void {
  const s = getState();
  const ctx = missionCtx(s, liveIndex, now);
  const { mis, changed } = ensureMission(s.mis, s.misN || 0, ctx);
  if (changed) {
    s.mis = mis;
    save();
  }
}

/**
 * If the current mission is complete, award stars, set celebration, toast, buzz, clear poke.
 * Returns true when it just completed (legacy checkMission).
 * Call from a tick / after relevant actions.
 */
export function checkMission(now: number = Date.now()): boolean {
  const s = getState();
  const ctx = missionCtx(s, liveIndex, now);
  const { mis, changed } = ensureMission(s.mis, s.misN || 0, ctx);
  if (changed) s.mis = mis;
  if (!missionComplete(s.mis, ctx)) {
    if (changed) save();
    return false;
  }
  const patch = completeMissionPatch(
    s.mis, s.misN || 0, s.stars || 0, s.earned || 0, s.mlog || [], now,
  );
  s.mis = patch.mis;
  s.stars = patch.stars;
  s.earned = patch.earned;
  s.misN = patch.misN;
  s.mlog = patch.mlog;
  s.cel = patch.cel;
  save();
  buzz('heal');
  toast(patch.toast);
  clearPoke();
  return true;
}

/** Manual "Mark done" for water / breathe / walk / skipmeal. */
export function markMissionDone(): void {
  const s = getState();
  if (!s.mis || s.mis.done) return;
  s.mis = { ...s.mis, man: 1 };
  save();
  checkMission();
}

/** Swap once for a different mission (legacy data-m="swap"). */
export function swapMission(now: number = Date.now()): void {
  const s = getState();
  if (!s.mis || s.mis.done || s.mis.sw >= 1) return;
  const ctx = missionCtx(s, liveIndex, now);
  const id = misPick(s.mis.id, s.mis.sw + 1, s.misN || 0, ctx);
  s.mis = misNew(id as MissionId, s.mis.sw + 1, ctx);
  save();
}
