import { describe, expect, it } from 'vitest';
import {
  DIZZY_LINE, HEALED_CAPTION, ambient, hello, newPokeState, pick, pokeLines, pokeReply, whisper, wispCaption,
} from './reactions.ts';
import { buzzPattern } from './haptics.ts';
import { WISP_CAPTIONS } from './today.ts';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('pick', () => {
  it('is deterministic by number and wraps', () => {
    expect(pick(['a', 'b', 'c'], 0)).toBe('a');
    expect(pick(['a', 'b', 'c'], 4)).toBe('b');
  });
});

describe('whisper', () => {
  const now = at(2026, 11, 18, 14, 40);
  // 3 cigarettes at 15:xx on three earlier days = hard hour 15
  const hard = [at(2026, 11, 10, 15, 5), at(2026, 11, 11, 15, 20), at(2026, 11, 12, 15, 50)];
  const base = { log: hard, tags: {}, craveEnd: 0, last: 0, now };

  it('speaks inside the window around a hard hour', () => {
    const w = whisper(base)!;
    expect(w).toContain('is usually when it gets hard');
    expect(w.endsWith('. I’m here.')).toBe(true);
  });
  it('needs MORE than 2 in the hour', () => {
    expect(whisper({ ...base, log: hard.slice(0, 2) })).toBeNull();
  });
  it('window is 45 minutes before to 30 after', () => {
    expect(whisper({ ...base, now: at(2026, 11, 18, 14, 14) })).toBeNull();
    expect(whisper({ ...base, now: at(2026, 11, 18, 14, 15) })).not.toBeNull();
    expect(whisper({ ...base, now: at(2026, 11, 18, 15, 30) })).not.toBeNull();
    expect(whisper({ ...base, now: at(2026, 11, 18, 15, 31) })).toBeNull();
  });
  it('is quiet while a timer runs or the last one was under 30 minutes ago', () => {
    expect(whisper({ ...base, craveEnd: now + 1000 })).toBeNull();
    expect(whisper({ ...base, last: now - 18e5 + 1 })).toBeNull();
    expect(whisper({ ...base, last: now - 18e5 })).not.toBeNull();
  });
  it('ignores today and entries older than 14 days', () => {
    const old = [at(2026, 10, 1, 15), at(2026, 10, 2, 15), at(2026, 10, 3, 15)];
    expect(whisper({ ...base, log: old })).toBeNull();
    const today = [at(2026, 11, 18, 15), at(2026, 11, 18, 15, 1), at(2026, 11, 18, 15, 2)];
    expect(whisper({ ...base, log: today })).toBeNull();
  });
  it('names the most common trigger in that hour, lower-cased', () => {
    const tags = { [hard[0]]: 'Coffee', [hard[1]]: 'Coffee', [hard[2]]: 'Stress' };
    expect(whisper({ ...base, tags })).toContain(', mostly coffee. I’m here.');
  });
});

describe('hello', () => {
  const td = at(2026, 11, 18);
  const n = Math.floor(td / 864e5);
  it('is kind after a day over the limit', () => {
    expect(hello({ td, hour: 9, yesterdayCount: 6, yesterdayLimit: 5 })).toContain('clean page');
  });
  it('does not do that without a limit or when at the limit', () => {
    expect(hello({ td, hour: 9, yesterdayCount: 6, yesterdayLimit: 0 })).not.toContain('clean page');
    expect(hello({ td, hour: 9, yesterdayCount: 5, yesterdayLimit: 5 })).not.toContain('clean page');
  });
  it('depends on the hour', () => {
    expect(hello({ td, hour: 3, yesterdayCount: 0, yesterdayLimit: 0 })).toBe('Still up? I’ll keep you company.');
    expect(hello({ td, hour: 9, yesterdayCount: 0, yesterdayLimit: 0 })).toBe(
      pick(['Good morning! I’m glad you’re here.', 'Morning! One gap at a time today.', 'Good morning. Ready when you are.'], n));
    expect(hello({ td, hour: 14, yesterdayCount: 0, yesterdayLimit: 0 })).toBe(
      pick(['Hi, welcome back. How’s your day going?', 'Hey you. I was hoping you’d stop by.'], n));
    expect(hello({ td, hour: 20, yesterdayCount: 0, yesterdayLimit: 0 })).toBe(
      pick(['Good evening. Let’s wind down gently.', 'Evening! How did today feel?'], n));
  });
});

describe('ambient', () => {
  const now = at(2026, 11, 18, 12);
  const mk = (o: Partial<Parameters<typeof ambient>[0]> = {}) =>
    ambient({ setup: true, greetAt: now - 1e6, now, last: 0, level: 0, hello: () => 'HELLO', ...o });
  it('greets during the first 10 minutes (only after setup)', () => {
    expect(mk({ greetAt: now - 599999 })).toBe('HELLO');
    expect(mk({ greetAt: now - 6e5 })).toBe('');
    expect(mk({ greetAt: now - 1000, setup: false })).toBe('');
  });
  it('praises a gap of 2 hours or more while level is below 6', () => {
    expect(mk({ last: now - 72e5 })).toBe('2h 0m since the last one. You’re doing great.');
    expect(mk({ last: now - 72e5 + 1 })).toBe('');
    expect(mk({ last: now - 72e5, level: 6 })).toBe('');
    expect(mk({ last: 0 })).toBe('');
  });
});

describe('pokeLines', () => {
  const base = { now: at(2026, 11, 18, 14), hour: 14, last: 0, countToday: 0, limit: 0, healsToday: 0, stars: 0 };
  it('has the 6 base lines', () => {
    expect(pokeLines(base).length).toBe(6);
  });
  it('adds morning/evening lines', () => {
    expect(pokeLines({ ...base, hour: 9 })).toContain('Good morning! Ready for today?');
    expect(pokeLines({ ...base, hour: 18 })).toContain('Evening! How did today feel?');
    expect(pokeLines({ ...base, hour: 12 }).length).toBe(6);
  });
  it('adds a no-cigarette line from 1 hour', () => {
    expect(pokeLines({ ...base, last: base.now - 36e5 })).toContain('1h 0m without one. I can feel it.');
    expect(pokeLines({ ...base, last: base.now - 36e5 + 1 }).length).toBe(6);
  });
  it('heals, limit and stars lines', () => {
    expect(pokeLines({ ...base, healsToday: 1 })).toContain('That craving you waited out? Still glowing.');
    expect(pokeLines({ ...base, limit: 5, countToday: 6 })).toContain('Rough day? Tomorrow is a clean page.');
    expect(pokeLines({ ...base, limit: 5, countToday: 2 })).toContain('Plenty of room left today. Take your time.');
    expect(pokeLines({ ...base, limit: 5, countToday: 5 }).length).toBe(6);
    expect(pokeLines({ ...base, stars: 10 })).toContain('You have 10 stars. Want to dress me up?');
    expect(pokeLines({ ...base, stars: 9 }).length).toBe(6);
  });
  it('mission waiting / done lines (6c-1)', () => {
    expect(pokeLines({ ...base, missionKnown: true, missionDone: false })).toContain('Psst, today’s mission is waiting.');
    expect(pokeLines({ ...base, missionKnown: true, missionDone: true })).toContain('Mission done! I’m still smiling about it.');
    expect(pokeLines({ ...base, missionKnown: false, missionDone: false }).length).toBe(6);
  });
});

describe('pokeReply', () => {
  const lines = ['a', 'b', 'c'];
  it('never repeats the previous line', () => {
    const st = newPokeState();
    const first = pokeReply(st, lines, 1000, () => 0); // 'a'
    expect(first).toBe('a');
    const second = pokeReply(st, lines, 20000, () => 0); // rnd keeps hitting 'a'; it must move on
    expect(second).not.toBe('a');
  });
  it('with a single line it can repeat', () => {
    const st = newPokeState();
    expect(pokeReply(st, ['x'], 1000, () => 0)).toBe('x');
    expect(pokeReply(st, ['x'], 20000, () => 0)).toBe('x');
  });
  it('6 quick pokes give the dizzy line, a pause resets', () => {
    const st = newPokeState();
    let r = '';
    for (let i = 0; i < 5; i++) r = pokeReply(st, lines, 1000 + i * 2000, () => i / 10);
    expect(r).not.toBe(DIZZY_LINE);
    expect(pokeReply(st, lines, 1000 + 5 * 2000, () => 0.5)).toBe(DIZZY_LINE);
    // exactly 2.5 s after the last poke is NOT within 2.5 s (strict <), so the count restarts at 1
    expect(pokeReply(st, lines, 1000 + 5 * 2000 + 2500, () => 0.5)).not.toBe(DIZZY_LINE);
  });
});

describe('wispCaption', () => {
  const base = {
    level: 2, now: 1e9, pokeText: '', pokeUntil: 0, healAt: 0, celebration: null, whisper: null, ambient: '',
  };
  it('falls back to the level caption', () => {
    expect(wispCaption(base)).toEqual({ text: WISP_CAPTIONS[2], healed: false });
  });
  it('priority: poke > healed > celebration > whisper > ambient', () => {
    const all = {
      ...base, pokeText: 'POKE', pokeUntil: base.now + 1, healAt: base.now - 1000,
      celebration: { txt: 'CEL', t: base.now - 1000 }, whisper: 'WHISPER', ambient: 'AMB',
    };
    expect(wispCaption(all).text).toBe('POKE');
    expect(wispCaption({ ...all, pokeUntil: base.now }).text).toBe(HEALED_CAPTION);
    expect(wispCaption({ ...all, pokeUntil: base.now, healAt: 0 }).text).toBe('✨ CEL');
    expect(wispCaption({ ...all, pokeUntil: base.now, healAt: 0, celebration: null }).text).toBe('WHISPER');
    expect(wispCaption({ ...all, pokeUntil: base.now, healAt: 0, celebration: null, whisper: null }).text).toBe('AMB');
  });
  it('healed glow lasts 5 minutes for a heal or a celebration', () => {
    expect(wispCaption({ ...base, healAt: base.now - 3e5 + 1 }).healed).toBe(true);
    expect(wispCaption({ ...base, healAt: base.now - 3e5 }).healed).toBe(false);
    expect(wispCaption({ ...base, celebration: { txt: 'x', t: base.now - 3e5 + 1 } }).healed).toBe(true);
    expect(wispCaption({ ...base, celebration: { txt: 'x', t: base.now - 3e5 } }).healed).toBe(false);
  });
});

describe('buzzPattern', () => {
  it('named kinds', () => {
    expect(buzzPattern('tap')).toEqual([10]);
    expect(buzzPattern('strong')).toEqual([38, 55, 38]);
    expect(buzzPattern('heal')).toEqual([30, 70, 30]);
  });
  it('levels make pairs that grow', () => {
    expect(buzzPattern(0)).toEqual([22, 40]);
    expect(buzzPattern(1)).toEqual([34, 40]);
    expect(buzzPattern(2)).toEqual([46, 40, 46, 40]);
    expect(buzzPattern(6)).toEqual([94, 40, 94, 40, 94, 40, 94, 40]);
  });
});
