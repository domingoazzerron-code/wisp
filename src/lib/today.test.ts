import { describe, expect, it } from 'vitest';
import { createLogIndex } from './logindex.ts';
import { durS } from './format.ts';
import {
  CIG_LIT_AT, WISP_CAPTIONS, gapLine, greetingPrefix, healsToday, heroStatus, lastLine, paceProjection,
  progressPct, wispLevel, wispSubline, yesterdayCount,
} from './today.ts';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('greetingPrefix', () => {
  it('switches at 5, 12 and 18', () => {
    expect([0, 4, 5, 11, 12, 17, 18, 23].map(greetingPrefix)).toEqual([
      'Still up', 'Still up', 'Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening',
    ]);
  });
});

describe('progressPct', () => {
  it('is 0 without a limit and caps at 100', () => {
    expect(progressPct(3, 0)).toBe(0);
    expect(progressPct(0, 10)).toBe(0);
    expect(progressPct(5, 10)).toBe(50);
    expect(progressPct(15, 10)).toBe(100);
  });
});

describe('heroStatus', () => {
  it('counts down, then warns at 1 left, at the limit and past it', () => {
    expect(heroStatus(0, 5, false)).toEqual({ cls: '', msg: '5 left today' });
    expect(heroStatus(3, 5, false)).toEqual({ cls: '', msg: '2 left today' });
    expect(heroStatus(4, 5, false)).toEqual({ cls: 'warn', msg: '1 left today' });
    expect(heroStatus(5, 5, false)).toEqual({ cls: 'warn', msg: 'You’ve reached today’s limit' });
    expect(heroStatus(7, 5, false)).toEqual({ cls: 'warn', msg: '2 past today’s limit' });
  });
  it('limit 1 shows the limit-reached message, not "1 left", after the first one', () => {
    expect(heroStatus(0, 1, false)).toEqual({ cls: 'warn', msg: '1 left today' });
    expect(heroStatus(1, 1, false)).toEqual({ cls: 'warn', msg: 'You’ve reached today’s limit' });
  });
  it('quit day and no-limit messages', () => {
    expect(heroStatus(0, 0, true).msg).toBe('Smoke-free today. Keep going');
    expect(heroStatus(2, 0, true).msg).toBe('Quit day: 2 logged. Tomorrow is a fresh start');
    expect(heroStatus(2, 0, false).msg).toBe('Set a daily limit in Settings');
  });
});

describe('wispLevel', () => {
  it('is 0 with nothing logged', () => {
    expect(wispLevel(0, 10, 0)).toBe(0);
    expect(wispLevel(0, 0, 0)).toBe(0);
  });
  it('scales with the share of the limit used (1..5), and 6 once over', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => wispLevel(t, 10, 0))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(wispLevel(11, 10, 0)).toBe(6);
  });
  it('without a limit it is the count, capped at 6', () => {
    expect([1, 3, 6, 9].map((t) => wispLevel(t, 0, 0))).toEqual([1, 3, 6, 6]);
  });
  it('heals lower it by up to 2 and never below 0', () => {
    expect(wispLevel(11, 10, 1)).toBe(5);
    expect(wispLevel(11, 10, 5)).toBe(4);
    expect(wispLevel(1, 10, 2)).toBe(0);
  });
  it('every level has a caption', () => {
    for (let l = 0; l <= 6; l++) expect(typeof WISP_CAPTIONS[l]).toBe('string');
    expect(WISP_CAPTIONS.length).toBe(7);
  });
  it('the cigarette is lit from the 3rd one', () => {
    expect(CIG_LIT_AT).toBe(3);
  });
});

describe('healsToday and yesterdayCount', () => {
  const now = at(2026, 5, 20, 15);
  it('counts only heals from today', () => {
    expect(healsToday([at(2026, 5, 19, 22), at(2026, 5, 20, 9), at(2026, 5, 20, 14)], 5, 0, now)).toBe(2);
  });
  it('adds one when today is below yesterday (and something is logged)', () => {
    expect(healsToday([], 2, 5, now)).toBe(1);
    expect(healsToday([], 5, 5, now)).toBe(0);
    expect(healsToday([], 0, 5, now)).toBe(0);
    expect(healsToday([], 2, 0, now)).toBe(0);
  });
  it('yesterdayCount counts the previous calendar day only', () => {
    const idx = createLogIndex([at(2026, 5, 18, 23), at(2026, 5, 19, 0), at(2026, 5, 19, 23), at(2026, 5, 20, 0), at(2026, 5, 20, 9)]);
    expect(yesterdayCount(idx, now)).toBe(2);
  });
});

describe('wispSubline', () => {
  it('describes the day', () => {
    expect(wispSubline(0, 10, 0, 10)).toBe('No cigarettes yet today');
    expect(wispSubline(3, 10, 0, 10)).toBe('3 of 10 today');
    expect(wispSubline(3, 0, 0, 0)).toBe('3 today');
    expect(wispSubline(3, 10, 1, 10)).toBe('3 of 10 today · 1 heal');
    expect(wispSubline(3, 10, 2, 12)).toBe('3 of 10 today · 2 heals · limit lowered to 10');
  });
});

describe('lastLine and gapLine', () => {
  const now = at(2026, 5, 20, 15);
  it('lastLine', () => {
    expect(lastLine(0, now)).toBe('Nothing logged yet');
    const last = now - 65 * 1000;
    expect(lastLine(last, now).startsWith('Last one ' + durS(65 * 1000) + ' ago, at ')).toBe(true);
  });
  it('gapLine', () => {
    expect(gapLine(0, now - 1000, now)).toBe('');
    expect(gapLine(30, 0, now)).toBe('');
    expect(gapLine(30, now - 10 * 6e4, now)).toBe('Next one in ' + durS(20 * 6e4));
    expect(gapLine(30, now - 31 * 6e4, now)).toBe('Minimum gap reached. Every extra minute counts');
  });
});

describe('paceProjection', () => {
  it('needs a limit, a logged one and a day that is 20-100% through (7:00-23:00)', () => {
    expect(paceProjection(3, 0, 12, 0)).toBeNull();
    expect(paceProjection(0, 10, 12, 0)).toBeNull();
    expect(paceProjection(3, 10, 8, 0)).toBeNull();   // too early (fr = .0625)
    expect(paceProjection(3, 10, 23, 0)).toBeNull();  // fr = 1
  });
  it('projects the total and flags going over', () => {
    // 15:00 -> fr = .5
    expect(paceProjection(4, 10, 15, 0)).toEqual({ projected: 8, over: false });
    expect(paceProjection(6, 10, 15, 0)).toEqual({ projected: 12, over: true });
    expect(paceProjection(5, 10, 15, 0)).toEqual({ projected: 10, over: false });
  });
});
