import { describe, expect, it } from 'vitest';
import {
  CRAVE_LATE_MS, CRAVE_MS, CTIPS, applyCredit, checkCrave, cravClock, cravSubline, cravTipIndex, creditText,
} from './craving.ts';

describe('cravClock', () => {
  it('formats m:ss and floors', () => {
    expect(cravClock(CRAVE_MS)).toBe('10:00');
    expect(cravClock(599999)).toBe('9:59');
    expect(cravClock(61000)).toBe('1:01');
    expect(cravClock(9000)).toBe('0:09');
    expect(cravClock(0)).toBe('0:00');
    expect(cravClock(-5000)).toBe('0:00');
  });
});

describe('cravTipIndex', () => {
  it('moves through the 4 tips every 2.5 minutes and clamps', () => {
    expect(cravTipIndex(CRAVE_MS)).toBe(0);
    expect(cravTipIndex(CRAVE_MS - 149999)).toBe(0);
    expect(cravTipIndex(CRAVE_MS - 150000)).toBe(1);
    expect(cravTipIndex(CRAVE_MS - 300000)).toBe(2);
    expect(cravTipIndex(CRAVE_MS - 450000)).toBe(3);
    expect(cravTipIndex(0)).toBe(3);
    expect(cravTipIndex(CRAVE_MS + 5000)).toBe(0);
    expect(CTIPS.length).toBe(4);
  });
});

describe('checkCrave', () => {
  const now = 1_000_000_000;
  it('none without a timer', () => expect(checkCrave(0, now)).toEqual({ kind: 'none' }));
  it('running while time is left', () => expect(checkCrave(now + 5000, now)).toEqual({ kind: 'running', remaining: 5000 }));
  it('credits at the exact end and up to 3 minutes after', () => {
    expect(checkCrave(now, now)).toEqual({ kind: 'credit', ended: now });
    expect(checkCrave(now - CRAVE_LATE_MS, now)).toEqual({ kind: 'credit', ended: now - CRAVE_LATE_MS });
  });
  it('asks when it ended more than 3 minutes ago', () => {
    expect(checkCrave(now - CRAVE_LATE_MS - 1, now)).toEqual({ kind: 'late', ended: now - CRAVE_LATE_MS - 1 });
  });
});

describe('cravSubline', () => {
  it('shows the reasons, a default tip, or the waited-out count', () => {
    expect(cravSubline(true, 'my kids', 4)).toBe('Remember why: my kids');
    expect(cravSubline(true, '', 4)).toBe('Breathe, drink water, move around.');
    expect(cravSubline(false, 'my kids', 4)).toBe('Waited out so far: 4');
    expect(cravSubline(false, '', 0)).toBe('Waited out so far: 0');
  });
});

describe('applyCredit', () => {
  it('counts the wait, heals, craving list, healAt and gapFrom (never lowers gapFrom)', () => {
    const s = { waited: 2, heals: [1], cravs: [1], healAt: 1, gapFrom: 50, craveEnd: 99 };
    applyCredit(s, 40);
    expect(s).toEqual({ waited: 3, heals: [1, 40], cravs: [1, 40], healAt: 40, gapFrom: 50, craveEnd: 0 });
    applyCredit(s, 70);
    expect(s.gapFrom).toBe(70);
    expect(s.waited).toBe(4);
  });
  it('tolerates missing counters', () => {
    const s = { waited: undefined as unknown as number, heals: undefined as unknown as number[], cravs: [], healAt: 0, gapFrom: 0, craveEnd: 5 };
    applyCredit(s, 9);
    expect(s.waited).toBe(1);
    expect(s.heals).toEqual([9]);
  });
});

describe('creditText', () => {
  it('mentions the restarted countdown only with a gap set', () => {
    expect(creditText(3, 0)).toBe('Ten minutes passed and the craving has faded. You have waited out 3 so far.');
    expect(creditText(3, 30)).toContain('Your next-one countdown has restarted.');
  });
});
