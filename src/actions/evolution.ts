// Evolution check and outfit wear / unlock.

import { getState, save } from '../state/index.ts';
import type { Outfit } from '../state/types.ts';
import { toast } from '../components/Toasts.tsx';
import { alertBox, askConfirm } from '../components/Overlay.tsx';
import { liveIndex } from '../lib/current.ts';
import {
  evoInfo, FORM, GREW, hasOutfit, OUTFIT_NAME, OUTFIT_PRICE, sanitizeOutfit,
} from '../lib/evolution.ts';

/**
 * Raise S.evo when the 7-day average unlocks a higher stage (legacy checkEvo).
 * Returns true when evolution happened. Toast stands in for alertBox (SWAP 6d).
 */
export function checkEvo(now: number = Date.now()): boolean {
  const s = getState();
  const e = evoInfo(liveIndex, s.base || 0, now);
  if (e.st <= (s.evo || 0)) return false;
  s.evo = e.st;
  s.outfit = sanitizeOutfit(s.outfit, s.owned || [], s.evo);
  save();
  applyOutfitAttr(s.outfit);
  if (s.log.length && e.avg != null) {
    alertBox(
      'Wisp evolved: ' + FORM[e.st],
      'Your average over the last 7 full days is ' + e.avg.toFixed(1) + ' a day, down from your usual ' + s.base + '. Wisp grew ' + GREW[e.st] + '.',
      true,
    );
  }
  return true;
}

/** Set data-outfit on <html> so CSS shows the right accessories. */
export function applyOutfitAttr(outfit: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-outfit', outfit || 'none');
  }
}

/** Wear an already-unlocked outfit. */
export function wearOutfit(id: Outfit): void {
  const s = getState();
  if (!hasOutfit(id, s.owned || [], s.evo || 0)) return;
  s.outfit = id;
  save();
  applyOutfitAttr(id);
}

/**
 * Unlock a paid outfit with stars, then wear it.
 * If not enough stars, toast and return. Confirm dialog is SWAP 6d — spends immediately when affordable.
 */
export function unlockOutfit(id: Outfit): void {
  const s = getState();
  if (hasOutfit(id, s.owned || [], s.evo || 0)) {
    wearOutfit(id);
    return;
  }
  const pr = OUTFIT_PRICE[id] || 0;
  if ((s.stars || 0) < pr) {
    toast('Needs ' + (pr - (s.stars || 0)) + ' more stars. Missions earn them.');
    return;
  }
  const name = OUTFIT_NAME[id] || id;
  askConfirm(
    'Unlock ' + name + '?',
    'Spend ' + pr + ' stars on Wisp’s ' + name.toLowerCase() + '. You have ' + (s.stars || 0) + '.',
    'Unlock for ' + pr + ' stars',
    () => {
      const st = getState();
      if ((st.stars || 0) < pr || hasOutfit(id, st.owned || [], st.evo || 0)) return;
      st.stars = (st.stars || 0) - pr;
      st.owned = (st.owned || []).concat(id);
      st.outfit = id;
      save();
      applyOutfitAttr(id);
      toast('Wisp is wearing it');
    },
  );
}

/** Sync data-outfit from current state (call on app start / after load). */
export function syncOutfitFromState(): void {
  const s = getState();
  const o = sanitizeOutfit(s.outfit, s.owned || [], s.evo || 0);
  if (o !== s.outfit) {
    s.outfit = o;
    save();
  }
  applyOutfitAttr(o);
}
