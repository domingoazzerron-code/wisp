import { describe, it, expect } from 'vitest';
import { createLogIndex } from './logindex.ts';
import {
  CHT, CHK, dayState, chalStates, challengeEnded, endChalPatch,
  chalStarReward, todayFails, activeChalView, type ChalCtx, type ChallengeId,
} from './challenges.ts';
import type { Challenge } from '../state/types.ts';

const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function ctx(log: number[], cravs: number[] = [], now = at(2026, 11, 18, 14), limit = 10): ChalCtx {
  return {
    now,
    idx: createLogIndex(log),
    cravs,
    limitForDay: () => limit,
  };
}

describe('CHT / CHK', () => {
  it('has five challenges', () => {
    expect(CHK).toHaveLength(5);
    for (const id of CHK) expect(CHT[id].n).toBeTruthy();
  });
});

describe('dayState', () => {
  const td = at(2026, 11, 18, 0);
  it('gap: fails when a gap is too short', () => {
    const c = ctx([at(2026, 11, 18, 10), at(2026, 11, 18, 10, 30)]); // 30 min < 45
    expect(dayState('gap45', td, td, c)).toBe('fail');
  });
  it('gap: pend today when gaps ok', () => {
    const c = ctx([at(2026, 11, 18, 10), at(2026, 11, 18, 11)]); // 60 min
    expect(dayState('gap45', td, td, c)).toBe('pend');
  });
  it('gap: ok for a past day with good gaps', () => {
    const yd = at(2026, 11, 17, 0);
    const c = ctx([at(2026, 11, 17, 10), at(2026, 11, 17, 12)]);
    expect(dayState('gap45', yd, td, c)).toBe('ok');
  });
  it('lim: fails when over limit', () => {
    const c = ctx([at(2026, 11, 18, 9), at(2026, 11, 18, 10), at(2026, 11, 18, 11)], [], at(2026, 11, 18, 14), 2);
    expect(dayState('lim', td, td, c)).toBe('fail');
  });
  it('morn: fails on morning cig', () => {
    const c = ctx([at(2026, 11, 18, 9)]);
    expect(dayState('morn', td, td, c)).toBe('fail');
  });
  it('morn: ok after noon with no morning cigs', () => {
    const c = ctx([at(2026, 11, 18, 13)], [], at(2026, 11, 18, 14));
    expect(dayState('morn', td, td, c)).toBe('ok');
  });
  it('crav: ok when a craving is logged', () => {
    const c = ctx([], [at(2026, 11, 18, 11)]);
    expect(dayState('crav', td, td, c)).toBe('ok');
  });
  it('crav: fail for past day with no craving', () => {
    const yd = at(2026, 11, 17, 0);
    const c = ctx([], []);
    expect(dayState('crav', yd, td, c)).toBe('fail');
  });
  it('future day is fut', () => {
    expect(dayState('lim', at(2026, 11, 19, 0), td, ctx([]))).toBe('fut');
  });
});

describe('chalStates / challengeEnded', () => {
  it('counts states across days', () => {
    const c: Challenge = { id: 'lim', days: 3, start: at(2026, 11, 16, 0), grace: 0 };
    // 16: 0 cigs ok, 17: 0 ok, 18: pend
    const st = chalStates(c, ctx([]));
    expect(st).toEqual(['ok', 'ok', 'pend']);
  });
  it('ends in success when all days closed ok', () => {
    const c: Challenge = { id: 'lim', days: 2, start: at(2026, 11, 16, 0), grace: 0 };
    // both past, empty log -> ok
    const ended = challengeEnded(c, ctx([], [], at(2026, 11, 18, 12)), 0);
    expect(ended).toEqual({ ok: true });
  });
  it('ends in fail when misses exceed grace', () => {
    const c: Challenge = { id: 'morn', days: 3, start: at(2026, 11, 16, 0), grace: 0 };
    // morning cigs on day 16
    const log = [at(2026, 11, 16, 9)];
    const ended = challengeEnded(c, ctx(log, [], at(2026, 11, 18, 14)), 0);
    expect(ended).toEqual({ ok: false });
  });
  it('defers fail-end for 2 minutes after a log', () => {
    const c: Challenge = { id: 'morn', days: 3, start: at(2026, 11, 16, 0), grace: 0 };
    const now = at(2026, 11, 18, 14);
    const log = [at(2026, 11, 16, 9), now - 60e3]; // last log 1 min ago
    const ended = challengeEnded(c, ctx(log, [], now), now - 60e3);
    expect(ended).toBe(null);
  });
  it('grace allows one miss on 7-day and can still win', () => {
    const c: Challenge = { id: 'morn', days: 7, start: at(2026, 11, 12, 0), grace: 1 };
    // one morning fail on day 12; other days clean; after noon today is ok too → all closed, 1 miss ≤ grace
    const log = [at(2026, 11, 12, 9)];
    const ended = challengeEnded(c, ctx(log, [], at(2026, 11, 18, 14)), 0);
    expect(ended).toEqual({ ok: true });
  });
  it('two misses on 7-day exceeds grace', () => {
    const c: Challenge = { id: 'morn', days: 7, start: at(2026, 11, 12, 0), grace: 1 };
    const log = [at(2026, 11, 12, 9), at(2026, 11, 13, 8)];
    const ended = challengeEnded(c, ctx(log, [], at(2026, 11, 18, 14)), 0);
    expect(ended).toEqual({ ok: false });
  });
});

describe('endChalPatch / stars', () => {
  it('awards 10 stars for 3-day win', () => {
    expect(chalStarReward(3)).toBe(10);
    const c: Challenge = { id: 'lim', days: 3, start: 0, grace: 0 };
    const p = endChalPatch(c, true, 1000, 5, 5, {});
    expect(p.ok).toBe(true);
    expect(p.stars).toBe(15);
    expect(p.badges!['lim-3']).toBe(1000);
    expect(p.cel!.txt).toContain('Stay within your limit');
  });
  it('awards 25 stars for 7-day win', () => {
    expect(chalStarReward(7)).toBe(25);
    const c: Challenge = { id: 'crav', days: 7, start: 0, grace: 1 };
    const p = endChalPatch(c, true, 2000, 0, 0, {});
    expect(p.stars).toBe(25);
    expect(p.cres.ok).toBe(1);
  });
  it('fail clears chal and sets cres.ok=0', () => {
    const c: Challenge = { id: 'gap45', days: 3, start: 0, grace: 0 };
    const p = endChalPatch(c, false, 3000, 10, 10, {});
    expect(p.ok).toBe(false);
    expect(p.chal.id).toBe('');
    expect(p.cres.ok).toBe(0);
    expect(p.stars == null).toBe(true);
  });
});

describe('todayFails / activeChalView', () => {
  it('todayFails when morning cig already logged', () => {
    const c = ctx([at(2026, 11, 18, 9)], [], at(2026, 11, 18, 10));
    expect(todayFails('morn', c)).toBe(true);
    expect(todayFails('lim', c)).toBe(false);
  });
  it('active view labels day and counts', () => {
    const chal: Challenge = { id: 'lim', days: 3, start: at(2026, 11, 16, 0), grace: 0 };
    const v = activeChalView(chal, ctx([]))!;
    expect(v.name).toBe('Stay within your limit');
    expect(v.dayLabel).toBe('Day 3 of 3');
    expect(v.okCount).toBe(2);
    expect(v.dots[2]).toBe('pend');
  });
});
