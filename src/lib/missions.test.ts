import { describe, it, expect } from 'vitest';
import { createLogIndex } from './logindex.ts';
import {
  MIS, mins, nToday, bef, bef6, cravIn, tagCount, usualGap, gapNow, mornHabit,
  misPool, misNew, misPick, ensureMission, missionComplete, missionView,
  completeMissionPatch, missionCtx,
} from './missions.ts';
import type { Mission } from '../state/types.ts';

const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

function idx(log: number[]) {
  return createLogIndex(log);
}

describe('mins', () => {
  it('formats minutes and hours', () => {
    expect(mins(15)).toBe('15 minutes');
    expect(mins(60)).toBe('1 hour');
    expect(mins(90)).toBe('1h 30m');
    expect(mins(120)).toBe('2 hours');
  });
});

describe('nToday / cravIn / tagCount', () => {
  const td = at(2026, 11, 18, 0);
  const log = [at(2026, 11, 18, 9), at(2026, 11, 18, 13), at(2026, 11, 17, 10)];
  it('counts by hour filter', () => {
    expect(nToday(idx(log), at(2026, 11, 18, 14), bef)).toBe(1);
    expect(nToday(idx(log), at(2026, 11, 18, 14), bef6)).toBe(2);
  });
  it('cravIn range', () => {
    const c = [at(2026, 11, 18, 10), at(2026, 11, 18, 15), at(2026, 11, 19, 1)];
    expect(cravIn(c, td, at(2026, 11, 19, 0))).toBe(2);
  });
  it('tagCount only today with tags', () => {
    const tags: Record<string, string> = { [String(log[0])]: 'stress' };
    const crt: Record<string, string> = { [String(at(2026, 11, 18, 11))]: 'coffee' };
    expect(tagCount(log, [at(2026, 11, 18, 11)], tags, crt, at(2026, 11, 18, 14))).toBe(2);
    expect(tagCount(log, [], tags, {}, at(2026, 11, 18, 14))).toBe(1);
  });
});

describe('usualGap / gapNow', () => {
  it('usualGap averages same-day gaps in last 14d', () => {
    const a = [
      at(2026, 11, 10, 10), at(2026, 11, 10, 12), // 2h
      at(2026, 11, 11, 9), at(2026, 11, 11, 11),  // 2h
      at(2026, 11, 18, 8),
    ];
    expect(usualGap(idx(a), at(2026, 11, 18, 12))).toBe(2 * 3600e3);
  });
  it('gapNow includes open gap and finished gaps after m.t', () => {
    const m: Mission = { day: at(2026, 11, 18, 0), id: 'gap', p: 30, t: at(2026, 11, 18, 8), done: 0, sw: 0, man: 0, b: 0 };
    const a = [at(2026, 11, 18, 9), at(2026, 11, 18, 10)]; // 1h then 1h open to 11
    expect(gapNow(idx(a), m, at(2026, 11, 18, 11))).toBe(3600e3);
  });
});

describe('mornHabit', () => {
  it('true when at least 2 of last 7 days had a morning cig', () => {
    const a = [at(2026, 11, 16, 9), at(2026, 11, 15, 8), at(2026, 11, 14, 14)];
    expect(mornHabit(idx(a), at(2026, 11, 18, 10))).toBe(true);
    expect(mornHabit(idx([at(2026, 11, 16, 9)]), at(2026, 11, 18, 10))).toBe(false);
  });
});

describe('misPool / misNew / misPick / ensureMission', () => {
  const now = at(2026, 11, 18, 10);
  const baseCtx = {
    now, idx: idx([at(2026, 11, 10, 12), at(2026, 11, 11, 12), at(2026, 11, 12, 12)]),
    log: [1, 2, 3], cravs: [] as number[], tags: {}, crt: {}, limit: 8,
  };
  it('pool includes core + gap/trig when has logs and limit', () => {
    const p = misPool(baseCtx);
    expect(p).toContain('crav');
    expect(p).toContain('gap');
    expect(p).toContain('trig');
  });
  it('misNew sets baseline for crav/trig and p for gap/eve', () => {
    const cr = misNew('crav', 0, { ...baseCtx, cravs: [at(2026, 11, 18, 9)] });
    expect(cr.b).toBe(1);
    const g = misNew('gap', 0, baseCtx);
    expect(g.p).toBeGreaterThanOrEqual(15);
    expect(g.p).toBeLessThanOrEqual(180);
    const e = misNew('eve', 0, baseCtx);
    expect(e.p).toBe(4);
  });
  it('misPick is deterministic and excludes prev', () => {
    const a = misPick(undefined, 0, 0, baseCtx);
    const b = misPick(a, 0, 0, baseCtx);
    expect(b).not.toBe(a);
    expect(misPick(undefined, 0, 0, baseCtx)).toBe(a);
  });
  it('ensureMission creates a new one when day is stale', () => {
    const stale: Mission = { day: at(2026, 11, 17, 0), id: 'crav', p: 0, t: 0, done: 0, sw: 0, man: 0, b: 0 };
    const { mis, changed } = ensureMission(stale, 0, baseCtx);
    expect(changed).toBe(true);
    expect(mis.day).toBe(at(2026, 11, 18, 0));
    expect(MIS[mis.id as keyof typeof MIS]).toBeTruthy();
  });
  it('ensureMission keeps a valid same-day mission', () => {
    const ok: Mission = { day: at(2026, 11, 18, 0), id: 'water', p: 0, t: now, done: 0, sw: 0, man: 0, b: 0 };
    const { mis, changed } = ensureMission(ok, 0, baseCtx);
    expect(changed).toBe(false);
    expect(mis).toBe(ok);
  });
});

describe('missionComplete / missionView / completeMissionPatch', () => {
  const now = at(2026, 11, 18, 14);
  const ctx = {
    now, idx: idx([]), log: [] as number[], cravs: [] as number[], tags: {}, crt: {}, limit: 10,
  };
  it('manual mission needs man=1', () => {
    const m: Mission = { day: at(2026, 11, 18, 0), id: 'water', p: 0, t: now, done: 0, sw: 0, man: 0, b: 0 };
    expect(missionComplete(m, ctx)).toBe(false);
    expect(missionComplete({ ...m, man: 1 }, ctx)).toBe(true);
  });
  it('crav ok when more cravings than baseline', () => {
    const m: Mission = { day: at(2026, 11, 18, 0), id: 'crav', p: 0, t: now, done: 0, sw: 0, man: 0, b: 0 };
    const c = { ...ctx, cravs: [at(2026, 11, 18, 10)] };
    expect(missionComplete(m, c)).toBe(true);
    expect(missionComplete({ ...m, b: 1 }, c)).toBe(false);
  });
  it('view shows done / bad / progress', () => {
    const m: Mission = { day: at(2026, 11, 18, 0), id: 'water', p: 0, t: now, done: 0, sw: 0, man: 0, b: 0 };
    const v = missionView(m, ctx)!;
    expect(v.canMark).toBe(true);
    expect(v.canSwap).toBe(true);
    expect(v.done).toBe(false);
    const done = missionView({ ...m, done: now }, ctx)!;
    expect(done.done).toBe(true);
    expect(done.title.startsWith('✓')).toBe(true);
  });
  it('completeMissionPatch awards stars and sets cel', () => {
    const m: Mission = { day: at(2026, 11, 18, 0), id: 'water', p: 0, t: now, done: 0, sw: 0, man: 1, b: 0 };
    const p = completeMissionPatch(m, 2, 5, 5, [], now);
    expect(p.stars).toBe(7);
    expect(p.earned).toBe(7);
    expect(p.misN).toBe(3);
    expect(p.mis.done).toBe(now);
    expect(p.cel.txt).toContain('+2 stars.');
    expect(p.toast).toBe('Mission done. +2 stars');
  });
});

describe('missionCtx limit', () => {
  it('uses limFor for the day', () => {
    const s = {
      log: [] as number[], cravs: [] as number[], tags: {}, crt: {},
      limit: 10, limH: [] as [number, number][], plan: { on: false, from: 10, to: 0, by: 1, every: 7, start: 0, holds: [] as [number, number][] },
    };
    const c = missionCtx(s, idx([]), at(2026, 11, 18, 12));
    expect(c.limit).toBe(10);
  });
});
