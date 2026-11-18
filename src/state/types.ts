// Shape of the saved app state (what lives in localStorage under STORAGE_KEY).
// Ported from legacy def() (legacy/index.html ~line 1026). Timestamps are ms since epoch.

export type Theme = 'auto' | 'light' | 'dark' | 'glass';

export type Outfit =
  | 'none' | 'beanie' | 'party' | 'wizard' | 'shades' | 'scarf' | 'bow'
  | 'flower' | 'headphones' | 'crown' | 'cape' | 'tophat' | 'catears' | 'sparkles';

export interface Goal { name: string; amt: number }

/** Optional mood emoji + free-text note on a log entry (legacy notes[ts] = {m,n}). */
export interface EntryNote { m?: string; n?: string }

export interface Plan {
  on: boolean;
  from: number;
  to: number;
  by: number;
  every: number;
  start: number;
  holds: [number, number][];
  quit?: number; // only present once a quit day is set
}

export interface Mission { day: number; id: string; p: number; t: number; done: number; sw: number; man: number; b: number }
export interface Challenge { id: string; days: number; start: number; grace: number }
export interface ChallengeResult { k: string; ok: 0 | 1; t: number; s: number }
export interface Celebration { t: number; txt: string }

export interface State {
  limit: number;
  limH: [number, number][];      // limit history: [dayStart, limit], sorted by day
  pack: number;
  per: number;
  cur: string;
  base: number;
  nic: number;
  tar: number;
  goal: Goal;
  notes: Record<string, EntryNote>; // keyed by log timestamp (mood + optional text)
  ctags: string[];               // custom trigger tags
  theme: Theme;
  outfit: Outfit;
  waited: number;
  craveEnd: number;
  gap: number;
  gapWarn: number;
  qh: number;
  conf: number;
  rsDay: number;
  crt: Record<string, string>;   // craving trigger per craving timestamp
  reasons: string;
  mile: Record<string, number>;  // milestone id -> reached at
  lastBackup: number;
  bkSnooze: number;
  name: string;
  heals: number[];
  healAt: number;
  diary: Record<string, unknown>; // shape not pinned down yet (see renderDiary in legacy)
  hap: number;
  gapFrom: number;
  evo: number;
  cel: Celebration | null;
  celDay: number;
  log: number[];                 // every logged cigarette (timestamps)
  setup: number;
  fx: 0 | 1 | 2 | 3;
  rng: 7 | 30 | 90;
  wkSeen: number;
  cravs: number[];
  tags: Record<string, string>;  // trigger tag per log timestamp
  stars: number;
  earned: number;
  owned: Outfit[];
  mis: Mission;
  misN: number;
  mlog: number[];
  chal: Challenge;
  cres: ChallengeResult | null;
  badges: Record<string, number>;
  greetDay: number;
  greetAt: number;
  recapSeen: number;
  plan: Plan;
}
