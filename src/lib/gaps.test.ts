import { describe, expect, it } from 'vitest';
import { checkGapRecord, gapData, logCelebration, spacingView } from './gaps.ts';
import { createLogIndex } from './logindex.ts';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const now = at(2026, 11, 18, 15, 0);

describe('gapData', () => {
  it('is all zeros for an empty log', () => {
    const g = gapData(createLogIndex([]), now);
    expect(g).toEqual({ done: 0, yest: 0, ever: 0, cur: 0, m: {} });
  });
  it('takes the longest gap per day and never counts across midnight', () => {
    const log = [
      at(2026, 11, 16, 22, 0), // 11h before the next entry, but across midnight: ignored
      at(2026, 11, 17, 9, 0), at(2026, 11, 17, 12, 0), at(2026, 11, 17, 12, 30), // yesterday: 3h, 30m
      at(2026, 11, 18, 8, 0), at(2026, 11, 18, 9, 0), at(2026, 11, 18, 13, 0), // today: 1h, 4h
    ];
    const g = gapData(createLogIndex(log), now);
    expect(g.done).toBe(4 * 36e5);
    expect(g.yest).toBe(3 * 36e5);
    expect(g.ever).toBe(4 * 36e5);
    expect(g.cur).toBe(2 * 36e5);
    expect(g.m[at(2026, 11, 17)]).toBe(3 * 36e5);
  });
  it('has no running gap when the last entry is not from today', () => {
    expect(gapData(createLogIndex([at(2026, 11, 17, 22, 0)]), now).cur).toBe(0);
  });
  it('sorts an unsorted log', () => {
    const g = gapData(createLogIndex([at(2026, 11, 18, 10, 0), at(2026, 11, 18, 8, 0)]), now);
    expect(g.done).toBe(2 * 36e5);
  });
});

describe('logCelebration', () => {
  const log = [at(2026, 11, 17, 9, 0), at(2026, 11, 17, 12, 0), at(2026, 11, 18, 8, 0), at(2026, 11, 18, 9, 0)];
  const gd = gapData(createLogIndex(log), now); // ever 3h (yesterday), yest 3h, done 1h
  it('needs an earlier entry from the same day', () => {
    expect(logCelebration(gd, 0, now)).toBeNull();
    expect(logCelebration(gd, at(2026, 11, 17, 23, 0), now)).toBeNull();
  });
  it('needs at least 30 minutes and more than today\u2019s best', () => {
    expect(logCelebration(gd, now - 29 * 6e4, now)).toBeNull();
    expect(logCelebration(gd, now - 40 * 6e4, now)).toBeNull(); // 40m < done (1h)
    expect(logCelebration(gd, now - 60 * 6e4, now)).toBeNull(); // equal to done
  });
  it('picks the longest-gap text', () => {
    expect(logCelebration(gd, now - 90 * 6e4, now)!.txt).toBe('Longest gap today: 1h 30m. I felt that.');
    expect(logCelebration(gd, now - 200 * 6e4, now)!.txt).toBe('New record gap: 3h 20m. I felt that.');
    const g2 = gapData(createLogIndex([at(2026, 11, 17, 9, 0), at(2026, 11, 17, 10, 0), at(2026, 11, 18, 8, 0)]), now); // yest 1h, ever 1h
    expect(logCelebration({ ...g2, ever: 5 * 36e5 }, now - 2 * 36e5, now)!.txt).toBe('You beat yesterday’s best gap: 2h 0m. I felt that.');
  });
  it('stamps the celebration with now', () => {
    expect(logCelebration(gd, now - 90 * 6e4, now)!.t).toBe(now);
  });
});

describe('checkGapRecord', () => {
  const log = [at(2026, 11, 17, 9, 0), at(2026, 11, 17, 11, 0), at(2026, 11, 18, 11, 30)]; // yest 2h; running 3h30m
  const gd = gapData(createLogIndex(log), now);
  const td = at(2026, 11, 18);
  it('celebrates once the running gap passes yesterday\u2019s best', () => {
    const r = checkGapRecord(gd, 0, now)!;
    expect(r.celDay).toBe(td);
    expect(r.cel).toEqual({ t: now, txt: 'You passed yesterday’s best gap (2h 0m). Still going.' });
  });
  it('only once per day', () => {
    expect(checkGapRecord(gd, td, now)).toBeNull();
  });
  it('needs yesterday to have a gap and the running gap to exceed it by 30+ minutes', () => {
    expect(checkGapRecord({ ...gd, yest: 0 }, 0, now)).toBeNull();
    expect(checkGapRecord({ ...gd, cur: 2 * 36e5 }, 0, now)).toBeNull(); // not above yest
    expect(checkGapRecord({ ...gd, yest: 10 * 6e4, cur: 29 * 6e4 }, 0, now)).toBeNull(); // under 30 min
  });
});

describe('spacingView', () => {
  it('empty log message', () => {
    const v = spacingView(gapData(createLogIndex([]), now), 0, false);
    expect(v.big).toBe('Starts with your first log');
    expect(v.sub).toContain('Wisp times the gap');
  });
  it('shows duration when there is a gap', () => {
    const log = [at(2026, 11, 18, 8, 0), at(2026, 11, 18, 10, 0)]; // 2h finished
    const g = gapData(createLogIndex(log), now);
    const v = spacingView(g, log.length, true);
    expect(v.big).toContain('h');
    expect(v.sub).toContain('Yesterday');
  });
  it('nothing logged today', () => {
    const log = [at(2026, 11, 17, 12, 0)];
    const g = gapData(createLogIndex(log), now);
    const v = spacingView(g, log.length, false);
    expect(v.big).toBe('Nothing logged today');
  });
});
