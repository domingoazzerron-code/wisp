import { describe, expect, it } from 'vitest';
import { defaultState } from '../state/defaults.ts';
import type { State } from '../state/types.ts';
import { DAY_MS, dayAdd, dayKey, startOfDay } from './dates.ts';
import { createLogIndex } from './logindex.ts';
import { lim, limFor, limitOn, planE, planSched, setLimit } from './limits.ts';
import { bestStreak, calcSaved, countSince, cntBetween, gapBase, gapLeft, monthCount, per, streak } from './streaks.ts';
import { dur, durS, hl, money } from './format.ts';

// All dates are built with local-time constructors so the tests pass in any time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const day = (y: number, m: number, d: number) => at(y, m, d, 0);

function stateWith(p: Partial<State>): State {
  return { ...defaultState(), ...p };
}
/** n entries on the given day. */
const many = (d: number, n: number) => Array.from({ length: n }, (_, i) => d + 8 * 36e5 + i * 6e4);

describe('dates', () => {
  it('startOfDay is local midnight', () => {
    expect(startOfDay(at(2026, 5, 9, 17, 45))).toBe(day(2026, 5, 9));
    expect(startOfDay(day(2026, 5, 9))).toBe(day(2026, 5, 9));
  });
  it('dayAdd moves whole calendar days, also across month ends and DST changes', () => {
    expect(dayAdd(at(2026, 1, 31, 15), 1)).toBe(day(2026, 2, 1));
    expect(dayAdd(at(2026, 3, 1, 15), -1)).toBe(day(2026, 2, 28));
    expect(dayAdd(day(2026, 3, 7), 2)).toBe(day(2026, 3, 9)); // spans US spring-forward
    expect(dayAdd(day(2026, 10, 31), 2)).toBe(day(2026, 11, 2)); // spans US fall-back
    expect(dayAdd(day(2026, 6, 15), 0)).toBe(day(2026, 6, 15));
  });
  it('dayKey is unpadded Y-M-D', () => {
    expect(dayKey(at(2026, 3, 4))).toBe('2026-3-4');
    expect(dayKey(at(2026, 12, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('createLogIndex', () => {
  const log = [30, 10, 20].map((x) => at(2026, 5, 1) + x * 6e4);
  it('sorts without touching the input', () => {
    const idx = createLogIndex(log);
    expect(idx.sorted()).toEqual([...log].sort((a, b) => a - b));
    expect(log[0]).toBe(at(2026, 5, 1) + 30 * 6e4);
  });
  it('counts per local day', () => {
    const idx = createLogIndex([...many(day(2026, 5, 1), 3), ...many(day(2026, 5, 2), 1)]);
    expect(idx.counts()).toEqual({ [day(2026, 5, 1)]: 3, [day(2026, 5, 2)]: 1 });
  });
  it('lowerBound finds the first entry >= t', () => {
    const idx = createLogIndex([10, 20, 30]);
    expect([0, 10, 11, 30, 31].map((t) => idx.lowerBound(t))).toEqual([0, 0, 1, 2, 3]);
  });
  it('first/last on empty and non-empty logs', () => {
    expect(createLogIndex([]).first()).toBe(Infinity);
    expect(createLogIndex([]).last()).toBe(0);
    expect(createLogIndex([5, 1, 9]).first()).toBe(1);
    expect(createLogIndex([5, 1, 9]).last()).toBe(9);
  });
});

describe('limits', () => {
  it('limitOn follows the limit history and falls back to the current limit', () => {
    const s = stateWith({ limit: 4, limH: [[day(2026, 5, 1), 10], [day(2026, 5, 10), 6]] });
    expect(limitOn(s, day(2026, 4, 30))).toBe(4); // before the first entry
    expect(limitOn(s, day(2026, 5, 1))).toBe(10);
    expect(limitOn(s, day(2026, 5, 9))).toBe(10);
    expect(limitOn(s, day(2026, 5, 10))).toBe(6);
    expect(limitOn(stateWith({ limit: 7, limH: [] }), day(2026, 5, 10))).toBe(7);
  });

  it('setLimit records history only once something is logged, and edits today in place', () => {
    const now = at(2026, 5, 10, 9);
    const empty = stateWith({ limit: 10 });
    setLimit(empty, 8, now);
    expect(empty.limit).toBe(8);
    expect(empty.limH).toEqual([]);

    const s = stateWith({ limit: 10, log: [now - DAY_MS] });
    setLimit(s, 8, now);
    expect(s.limH).toEqual([[0, 10], [day(2026, 5, 10), 8]]);
    setLimit(s, 6, now); // same day: edit the last entry
    expect(s.limH).toEqual([[0, 10], [day(2026, 5, 10), 6]]);
    setLimit(s, 6, now); // unchanged: no-op
    expect(s.limH).toEqual([[0, 10], [day(2026, 5, 10), 6]]);
    expect(s.limit).toBe(6);
  });

  it('planE subtracts hold days (capped at the hold length)', () => {
    const plan = { ...defaultState().plan, start: day(2026, 5, 1), holds: [[day(2026, 5, 5), 3]] as [number, number][] };
    expect(planE(plan, day(2026, 5, 1))).toBe(0);
    expect(planE(plan, day(2026, 5, 5))).toBe(4);
    expect(planE(plan, day(2026, 5, 6))).toBe(4); // 5 days in, 1 day of hold used
    expect(planE(plan, day(2026, 5, 20))).toBe(16); // 19 days in, whole 3-day hold used
  });

  const planned = (extra: Partial<State['plan']> = {}) =>
    stateWith({ limit: 20, plan: { on: true, from: 10, to: 2, by: 2, every: 7, start: day(2026, 5, 1), holds: [], ...extra } });

  it('limFor steps the plan down by `by` every `every` days, never below `to`', () => {
    const s = planned();
    expect(limFor(s, day(2026, 5, 1))).toBe(10);
    expect(limFor(s, day(2026, 5, 7))).toBe(10);
    expect(limFor(s, day(2026, 5, 8))).toBe(8);
    expect(limFor(s, day(2026, 5, 15))).toBe(6);
    expect(limFor(s, day(2026, 6, 30))).toBe(2);
  });
  it('limFor uses the manual limit before the plan starts or when the plan is off', () => {
    expect(limFor(planned(), day(2026, 4, 30))).toBe(20);
    expect(limFor(planned({ on: false }), day(2026, 5, 20))).toBe(20);
  });
  it('limFor is 0 from the quit day, whatever the plan says', () => {
    const s = planned({ quit: day(2026, 5, 12) });
    expect(limFor(s, day(2026, 5, 11))).toBe(8); // plan step 1 (10 days in)
    expect(limFor(s, day(2026, 5, 12))).toBe(0);
    expect(limFor(s, day(2026, 7, 1))).toBe(0);
  });
  it('a hold pauses the step-down', () => {
    const s = planned({ holds: [[day(2026, 5, 6), 7]] });
    expect(limFor(s, day(2026, 5, 8))).toBe(10); // would be 8 without the hold
    expect(limFor(s, day(2026, 5, 15))).toBe(8);
  });
  it('lim is limFor for the day containing now', () => {
    expect(lim(planned(), at(2026, 5, 8, 23, 59))).toBe(8);
  });

  it('planSched lists each step', () => {
    expect(planSched(planned())).toEqual([
      { d: day(2026, 5, 1), l: 10 }, { d: day(2026, 5, 8), l: 8 }, { d: day(2026, 5, 15), l: 6 },
      { d: day(2026, 5, 22), l: 4 }, { d: day(2026, 5, 29), l: 2 },
    ]);
  });
  it('planSched is null without a running plan and survives a degenerate plan', () => {
    expect(planSched(planned({ on: false }))).toBeNull();
    expect(planSched(planned({ start: 0 }))).toBeNull();
    expect(planSched(planned({ from: 3, to: 5 }))).toEqual([{ d: day(2026, 5, 1), l: 5 }]); // already below target
    expect(planSched(planned({ every: 0, by: 0 }))?.length).toBeGreaterThan(0); // every/by clamp to 1
  });
  it('planSched shifts later steps by a hold', () => {
    const s = planned({ holds: [[day(2026, 5, 6), 3]] });
    expect(planSched(s)?.[1]).toEqual({ d: day(2026, 5, 11), l: 8 });
  });
});

describe('streaks', () => {
  const now = at(2026, 5, 20, 15);
  const run = (s: State) => {
    const idx = createLogIndex(s.log);
    return { cur: streak(s, idx, now), best: bestStreak(s, idx, now) };
  };

  it('are 0 with an empty log', () => {
    expect(run(stateWith({}))).toEqual({ cur: 0, best: 0 });
  });
  it('count days at or under the limit, ending today', () => {
    const s = stateWith({ limit: 3, log: [...many(day(2026, 5, 18), 3), ...many(day(2026, 5, 19), 2), ...many(day(2026, 5, 20), 1)] });
    expect(run(s)).toEqual({ cur: 3, best: 3 });
  });
  it('a day over the limit breaks the current streak but keeps the best', () => {
    const log = [...many(day(2026, 5, 10), 1), ...many(day(2026, 5, 11), 1), ...many(day(2026, 5, 12), 1), ...many(day(2026, 5, 13), 9), ...many(day(2026, 5, 20), 1)];
    expect(run(stateWith({ limit: 3, log }))).toEqual({ cur: 7, best: 7 }); // 14th..20th is 7 days; 10-12 is 3
    const over = [...log, ...many(day(2026, 5, 20), 5)];
    expect(run(stateWith({ limit: 3, log: over })).cur).toBe(0);
    expect(run(stateWith({ limit: 3, log: over })).best).toBe(6); // 14th..19th
  });
  it('days with nothing logged count as within the limit', () => {
    expect(run(stateWith({ limit: 3, log: many(day(2026, 5, 15), 1) }))).toEqual({ cur: 6, best: 6 });
  });
  it('use the limit that applied on each day (history and plan)', () => {
    const log = many(day(2026, 5, 18), 5);
    // limit was 6 until the 18th, then 4: 5 on the 18th is over, so only the 19th and 20th count
    const s = stateWith({ limit: 4, limH: [[0, 6], [day(2026, 5, 18), 4]], log });
    expect(run(s).cur).toBe(2);
    // under the old limit of 6 the same day would have been fine
    expect(run(stateWith({ limit: 6, log })).cur).toBe(3);
    // from the quit day the limit is 0: smoking on the 19th breaks it, the smoke-free 20th counts
    const q = stateWith({ limit: 10, log: many(day(2026, 5, 19), 1), plan: { ...defaultState().plan, quit: day(2026, 5, 19) } });
    expect(run(q).cur).toBe(1);
  });
  it('current streak stops at 365 days', () => {
    const s = stateWith({ limit: 3, log: [at(2024, 1, 1)] });
    expect(run(s).cur).toBe(365);
  });
});

describe('counts, savings and gap', () => {
  const now = at(2026, 5, 20, 15);
  const log = [at(2026, 4, 28), at(2026, 5, 1, 8), at(2026, 5, 19, 9), at(2026, 5, 20, 8), at(2026, 5, 20, 12)];
  const idx = createLogIndex(log);

  it('countSince includes today', () => {
    expect(countSince(idx, 1, now)).toBe(2);
    expect(countSince(idx, 2, now)).toBe(3);
    expect(countSince(idx, 30, now)).toBe(5);
  });
  it('monthCount counts from the 1st', () => {
    expect(monthCount(idx, now)).toBe(4);
  });
  it('cntBetween is half-open', () => {
    expect(cntBetween(idx, day(2026, 5, 19), day(2026, 5, 20))).toBe(1);
    expect(cntBetween(idx, day(2026, 5, 20), day(2026, 5, 20))).toBe(0);
  });
  it('per is the price of one cigarette, 0 when unset', () => {
    expect(per({ pack: 150, per: 20 })).toBe(7.5);
    expect(per({ pack: 0, per: 20 })).toBe(0);
    expect(per({ pack: 150, per: 0 })).toBe(0);
  });
  it('calcSaved compares against the baseline since the first log, never below 0', () => {
    const s = stateWith({ log, base: 10, pack: 100, per: 20 });
    // first log 28 Apr .. 20 May = 23 days; (10*23 - 5) * 5
    expect(calcSaved(s, idx, now)).toBe((10 * 23 - 5) * 5);
    expect(calcSaved(stateWith({ log, base: 0, pack: 100, per: 20 }), idx, now)).toBe(0);
    expect(calcSaved(stateWith({}), createLogIndex([]), now)).toBe(0);
  });
  it('gap timing uses the later of last entry and gapFrom', () => {
    const last = at(2026, 5, 20, 12);
    expect(gapBase({ gapFrom: 0 }, idx)).toBe(last);
    expect(gapBase({ gapFrom: last + 1000 }, idx)).toBe(last + 1000);
    expect(gapLeft({ gap: 60, gapFrom: 0 }, idx, last + 20 * 6e4)).toBe(40 * 6e4);
    expect(gapLeft({ gap: 60, gapFrom: 0 }, idx, last + 90 * 6e4)).toBe(-30 * 6e4); // negative once the gap is over
    expect(gapLeft({ gap: 0, gapFrom: 0 }, idx, now)).toBe(0);
    expect(gapLeft({ gap: 60, gapFrom: 0 }, createLogIndex([]), now)).toBe(0);
  });
});

describe('format', () => {
  it('dur', () => {
    expect(dur(0)).toBe('under a minute');
    expect(dur(59999)).toBe('under a minute');
    expect(dur(45 * 6e4)).toBe('45m');
    expect(dur(3 * 36e5 + 5 * 6e4)).toBe('3h 5m');
    expect(dur(2 * DAY_MS + 4 * 36e5)).toBe('2d 4h');
  });
  it('durS hides zero days and hours and clamps negatives', () => {
    expect(durS(-5000)).toBe('0m 0s');
    expect(durS(65 * 1000)).toBe('1m 5s');
    expect(durS(3600 * 1000 + 4000)).toBe('1h 0m 4s');
    expect(durS(DAY_MS + 2 * 36e5 + 3 * 6e4 + 4000)).toBe('1d 2h 3m 4s');
    expect(durS(DAY_MS + 5000)).toBe('1d 0h 0m 5s');
  });
  it('hl', () => {
    expect([0, 1, 11, 12, 13, 23, 24].map(hl)).toEqual(['12 AM', '1 AM', '11 AM', '12 PM', '1 PM', '11 PM', '12 AM']);
  });
  it('money', () => {
    expect(money('₱', 12.5)).toBe('₱12.50');
    expect(money('$', 0)).toBe('$0.00');
  });
});
