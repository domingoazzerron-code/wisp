// Pure logic for Wisp's reactions on Today (legacy whisper, hello, ambient, pokeLines, poke, renderMascot caption).
// No DOM, no store, no clock: everything is passed in. Random picks take the random number as a parameter.

import { DAY_MS, startOfDay } from './dates.ts';
import { dur } from './format.ts';
import { WISP_CAPTIONS } from './today.ts';

/** Legacy pick(a, n): deterministic choice by number (the day number for greetings). */
export function pick<T>(a: readonly T[], n: number): T {
  return a[n % a.length];
}

export interface WhisperInput {
  log: readonly number[];
  tags: Readonly<Record<string, string>>;
  craveEnd: number;
  last: number;   // timestamp of the newest cigarette, 0 when none
  now: number;
}

/** Hour label like "3 PM" (legacy used toLocaleTimeString with only the hour). */
function hourLabel(h: number): string {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
}

/**
 * "Around 3 PM is usually when it gets hard, mostly <trigger>. I'm here."
 * An hour is "hard" when more than 2 cigarettes were logged in it over the last 14 days, before today.
 * Only within 45 minutes before to 30 minutes after that hour, with no timer running and the last cigarette 30+ minutes ago.
 */
export function whisper(i: WhisperInput): string | null {
  const d = new Date(i.now);
  const m = d.getHours() * 60 + d.getMinutes();
  const cut = i.now - 12096e5;
  const td = startOfDay(i.now);
  const counts: Record<number, number> = {};
  const tagCounts: Record<number, Record<string, number>> = {};
  for (const ts of i.log) {
    if (ts < cut || ts >= td) continue;
    const hh = new Date(ts).getHours();
    counts[hh] = (counts[hh] || 0) + 1;
    const tag = i.tags[ts];
    if (tag) {
      const o = (tagCounts[hh] = tagCounts[hh] || {});
      o[tag] = (o[tag] || 0) + 1;
    }
  }
  let pk = -1;
  let pc = 2;
  for (const key in counts) {
    // legacy `for (hh in c)`: keys come in ascending numeric order, strict > keeps the earliest hour on ties
    if (counts[key] > pc) { pc = counts[key]; pk = +key; }
  }
  if (pk < 0 || m < pk * 60 - 45 || m > pk * 60 + 30 || i.craveEnd) return null;
  if (i.last && i.now - i.last < 18e5) return null;
  let bt = '';
  let bn = 0;
  const o = tagCounts[pk] || {};
  for (const k in o) if (o[k] > bn) { bn = o[k]; bt = k; }
  return 'Around ' + hourLabel(pk) + ' is usually when it gets hard' + (bt ? ', mostly ' + bt.toLowerCase() : '') + '. I’m here.';
}

export interface HelloInput {
  td: number;          // start of today
  hour: number;        // current hour 0..23
  yesterdayCount: number;
  yesterdayLimit: number;
}

/** Greeting for the first 10 minutes after the first open of the day (legacy hello). */
export function hello(i: HelloInput): string {
  const n = Math.floor(i.td / DAY_MS);
  const h = i.hour;
  if (i.yesterdayLimit > 0 && i.yesterdayCount > i.yesterdayLimit) {
    return pick(['Yesterday was a heavy one, and that’s okay. Today is a clean page.', 'New day, clean page. Yesterday stays behind us.'], n);
  }
  if (h < 5) return 'Still up? I’ll keep you company.';
  if (h < 12) return pick(['Good morning! I’m glad you’re here.', 'Morning! One gap at a time today.', 'Good morning. Ready when you are.'], n);
  if (h < 18) return pick(['Hi, welcome back. How’s your day going?', 'Hey you. I was hoping you’d stop by.'], n);
  return pick(['Good evening. Let’s wind down gently.', 'Evening! How did today feel?'], n);
}

/** True when the greeting stamp (`greetDay`) has to move to today (legacy ambient wrote S.greetDay / S.greetAt). */
export function needsGreetStamp(greetDay: number, td: number): boolean {
  return greetDay !== td;
}

export interface AmbientInput {
  setup: boolean;      // S.setup is truthy
  greetAt: number;     // already stamped for today (see needsGreetStamp)
  now: number;
  last: number;
  level: number;
  hello: () => string; // lazy: only built when needed
}

/** The first 10 minutes of the day: the greeting. Later: 2+ hours since the last one (and level below 6). '' otherwise. */
export function ambient(i: AmbientInput): string {
  if (i.setup && i.now - i.greetAt < 6e5) return i.hello();
  if (i.last && i.now - i.last >= 72e5 && i.level < 6) return dur(i.now - i.last) + ' since the last one. You’re doing great.';
  return '';
}

export interface PokeInput {
  now: number;
  hour: number;
  last: number;
  countToday: number;
  limit: number;
  healsToday: number;   // plain heals today (legacy healsToday() without the yesterday bonus)
  stars: number;
  /** Mission is known (id in MIS) and not yet done. */
  missionKnown?: boolean;
  /** Mission is done for today. */
  missionDone?: boolean;
}

/** Everything Wisp can say when poked (legacy pokeLines). */
export function pokeLines(i: PokeInput): string[] {
  const cur = i.last ? i.now - i.last : 0;
  const a = [
    'Hee! That tickles.', 'I’m right here.', 'Boop!', 'Thanks for checking on me.',
    'One gap at a time. I’ve got you.', 'You’re doing better than you think.',
  ];
  if (i.hour < 12) a.push('Good morning! Ready for today?'); else if (i.hour >= 18) a.push('Evening! How did today feel?');
  if (i.last && cur >= 36e5) a.push(dur(cur) + ' without one. I can feel it.');
  if (i.healsToday) a.push('That craving you waited out? Still glowing.');
  if (i.missionKnown && !i.missionDone) a.push('Psst, today’s mission is waiting.');
  if (i.missionDone) a.push('Mission done! I’m still smiling about it.');
  if (i.limit > 0 && i.countToday > i.limit) a.push('Rough day? Tomorrow is a clean page.');
  else if (i.limit > 0 && i.countToday < i.limit) a.push('Plenty of room left today. Take your time.');
  if (i.stars >= 10) a.push('You have ' + i.stars + ' stars. Want to dress me up?');
  return a;
}

export const DIZZY_LINE = 'Okay, okay, I’m dizzy! Give me a second.';
export const POKE_SHOW_MS = 7000;
const POKE_COMBO_MS = 2500;
const POKE_DIZZY_AT = 6;

export interface PokeState { n: number; t: number; last: number }

export const newPokeState = (): PokeState => ({ n: 0, t: 0, last: -1 });

/**
 * Chooses the poke reply. `rnd` is a random number in [0, 1). Updates `st` in place.
 * 6 pokes in a row (each within 2.5 s of the one before) = the dizzy line.
 * Never repeats the previous line when there is a choice.
 */
export function pokeReply(st: PokeState, lines: readonly string[], now: number, rnd: () => number): string {
  st.n = now - st.t < POKE_COMBO_MS ? st.n + 1 : 1;
  st.t = now;
  if (st.n >= POKE_DIZZY_AT) return DIZZY_LINE;
  // legacy re-rolled until the index differed from the last one; this picks among the OTHER lines directly
  // (same distribution, no loop, so a constant `rnd` in tests cannot hang)
  let i: number;
  if (lines.length > 1 && st.last >= 0 && st.last < lines.length) {
    i = Math.floor(rnd() * (lines.length - 1));
    if (i >= st.last) i++;
  } else {
    i = Math.floor(rnd() * lines.length);
  }
  st.last = i;
  return lines[i];
}

/** How long the "healed" caption and glow last after a waited-out craving (legacy 3e5). */
export const HEAL_GLOW_MS = 3e5;
export const HEALED_CAPTION = '✨ You waited it out. I feel lighter.';

export interface CaptionInput {
  level: number;
  now: number;
  pokeText: string;
  pokeUntil: number;
  healAt: number;
  celebration: { txt: string; t: number } | null; // S.cel (6b-3 fills this in)
  whisper: string | null;
  ambient: string;
}

export interface CaptionResult { text: string; healed: boolean }

/** Caption priority: poke > healed > celebration > whisper > ambient > the level caption. `healed` drives the glow class. */
export function wispCaption(i: CaptionInput): CaptionResult {
  const rc = i.now - (i.healAt || 0) < HEAL_GLOW_MS;
  const cl = !!(i.celebration && i.now - i.celebration.t < HEAL_GLOW_MS);
  const healed = rc || cl;
  let text: string;
  if (i.pokeText && i.now < i.pokeUntil) text = i.pokeText;
  else if (rc) text = HEALED_CAPTION;
  else if (cl) text = '✨ ' + i.celebration!.txt;
  else if (i.whisper) text = i.whisper;
  else text = i.ambient || WISP_CAPTIONS[i.level];
  return { text, healed };
}
