import type { Outfit, State } from './types.ts';

// Ported from legacy def() / OUTFITS / OPRICE / OFMIN / STG / OFN.
export function defaultState(): State {
  return {
    limit: 10, limH: [], pack: 150, per: 20, cur: '₱', base: 20, nic: 1, tar: 10,
    goal: { name: '', amt: 0 }, notes: {}, ctags: [], theme: 'auto', outfit: 'none',
    waited: 0, craveEnd: 0, gap: 0, gapWarn: 1, qh: 0, conf: 0, rsDay: 0, crt: {},
    reasons: '', mile: {}, lastBackup: 0, bkSnooze: 0, name: '', heals: [], healAt: 0,
    diary: {}, hap: 1, gapFrom: 0, evo: 0, cel: null, celDay: 0, log: [], setup: 0,
    fx: 0, rng: 7, wkSeen: 0, cravs: [], tags: {}, stars: 0, earned: 0, owned: [],
    mis: { day: 0, id: '', p: 0, t: 0, done: 0, sw: 0, man: 0, b: 0 }, misN: 0, mlog: [],
    chal: { id: '', days: 0, start: 0, grace: 0 }, cres: null, badges: {},
    greetDay: 0, greetAt: 0, recapSeen: 0,
    plan: { on: false, from: 10, to: 0, by: 1, every: 7, start: 0, holds: [] },
  };
}

export const OUTFITS: Outfit[] = [
  'none', 'beanie', 'party', 'wizard', 'shades', 'scarf', 'bow',
  'flower', 'headphones', 'crown', 'cape', 'tophat', 'catears', 'sparkles',
];

/** Star price of the outfits that must be bought (legacy OPRICE). */
export const OUTFIT_PRICE: Partial<Record<Outfit, number>> = {
  flower: 10, headphones: 15, crown: 25, cape: 35, tophat: 12, catears: 12, sparkles: 18,
};

/** Wisp stage needed to unlock an outfit (legacy OFMIN). */
export const OUTFIT_MIN_STAGE: Partial<Record<Outfit, number>> = {
  flower: 1, headphones: 2, crown: 3, cape: 4,
};

/** Wisp growth stages (legacy STG). */
export const STAGES = ['Wisp', 'Sprout', 'Glow', 'Wings', 'Halo', 'Radiant'] as const;

/** Line shown for each outfit (legacy OFN). */
export const OUTFIT_TEXT: Record<Outfit, string> = {
  none: 'Just Wisp, as he is.',
  beanie: 'A cosy beanie.',
  party: 'Party hat on. Every smoke-free hour counts.',
  wizard: 'A wizard hat. Very wise.',
  shades: 'Cool shades.',
  scarf: 'A warm scarf.',
  bow: 'Looking sharp in a bow tie.',
  flower: 'A flower crown, fresh from the sprout.',
  headphones: 'Headphones. Turn it up.',
  crown: 'A golden crown for a long streak.',
  cape: 'A hero cape. You earned it.',
  tophat: 'A top hat. Very distinguished.',
  catears: 'Cat ears. Purr-fect.',
  sparkles: 'A little sparkle follows him around.',
};
