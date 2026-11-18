import { describe, it, expect } from 'vitest';
import { mileDefs, newlyReached, type MileCtx } from './milestones.ts';

function ctx(partial: Partial<MileCtx> = {}): MileCtx {
  return {
    now: Date.now(),
    lastTs: Date.now(),
    streak: 0,
    savedAmt: 0,
    goalAmt: 0,
    goalName: '',
    hasLog: true,
    ...partial,
  };
}

describe('mileDefs', () => {
  it('lists 8 milestones', () => {
    expect(mileDefs(ctx()).length).toBe(8);
  });
  it('d1 / d3 / d7 / m1 from hours since last', () => {
    const now = 1_000_000_000_000;
    const m24 = mileDefs(ctx({ now, lastTs: now - 24 * 36e5 }));
    expect(m24.find((m) => m.id === 'd1')!.ok).toBe(true);
    expect(m24.find((m) => m.id === 'd3')!.ok).toBe(false);

    const m72 = mileDefs(ctx({ now, lastTs: now - 72 * 36e5 }));
    expect(m72.find((m) => m.id === 'd3')!.ok).toBe(true);
    expect(m72.find((m) => m.id === 'd7')!.ok).toBe(false);

    const m168 = mileDefs(ctx({ now, lastTs: now - 168 * 36e5 }));
    expect(m168.find((m) => m.id === 'd7')!.ok).toBe(true);

    const m720 = mileDefs(ctx({ now, lastTs: now - 720 * 36e5 }));
    expect(m720.find((m) => m.id === 'm1')!.ok).toBe(true);
  });
  it('w1 from streak', () => {
    expect(mileDefs(ctx({ streak: 6 })).find((m) => m.id === 'w1')!.ok).toBe(false);
    expect(mileDefs(ctx({ streak: 7 })).find((m) => m.id === 'w1')!.ok).toBe(true);
  });
  it('goal milestones need goal and savings', () => {
    const none = mileDefs(ctx({ goalAmt: 0, savedAmt: 100 }));
    expect(none.find((m) => m.id === 'g25')!.ok).toBe(false);

    const part = mileDefs(ctx({ goalAmt: 100, goalName: 'trip', savedAmt: 25 }));
    expect(part.find((m) => m.id === 'g25')!.ok).toBe(true);
    expect(part.find((m) => m.id === 'g50')!.ok).toBe(false);
    expect(part.find((m) => m.id === 'g25')!.body).toContain('trip');

    const full = mileDefs(ctx({ goalAmt: 100, savedAmt: 100 }));
    expect(full.find((m) => m.id === 'g100')!.ok).toBe(true);
  });
});

describe('newlyReached', () => {
  it('returns nothing without a log', () => {
    expect(newlyReached({}, ctx({ hasLog: false, streak: 10 }))).toEqual([]);
  });
  it('returns only unmet ids that are now ok', () => {
    const now = 1_000_000_000_000;
    const c = ctx({ now, lastTs: now - 30 * 36e5, hasLog: true }); // 30h → d1 only
    const fresh = newlyReached({}, c);
    expect(fresh.map((m) => m.id)).toEqual(['d1']);
    expect(newlyReached({ d1: now - 1 }, c)).toEqual([]);
  });
  it('can return several at once in legacy order', () => {
    const now = 1_000_000_000_000;
    const c = ctx({
      now, lastTs: now - 80 * 36e5, streak: 7, hasLog: true,
      goalAmt: 100, savedAmt: 100, goalName: 'bike',
    });
    const ids = newlyReached({}, c).map((m) => m.id);
    expect(ids).toContain('d1');
    expect(ids).toContain('d3');
    expect(ids).toContain('w1');
    expect(ids).toContain('g100');
    expect(ids.indexOf('d1') < ids.indexOf('d3')).toBe(true);
  });
});
