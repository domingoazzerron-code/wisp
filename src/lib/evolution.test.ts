import { describe, it, expect } from 'vitest';
import { createLogIndex } from './logindex.ts';
import {
  evoInfo, formLabel, hasOutfit, sanitizeOutfit, FORM, OUTFIT_PRICE,
} from './evolution.ts';
import type { Outfit } from '../state/types.ts';

const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h).getTime();

describe('evoInfo', () => {
  it('returns null avg when history is shorter than 7 days', () => {
    const log = [at(2026, 11, 15), at(2026, 11, 16)];
    const e = evoInfo(createLogIndex(log), 10, at(2026, 11, 18));
    expect(e.avg).toBe(null);
    expect(e.st).toBe(0);
  });
  it('returns null when base is 0', () => {
    const log = [];
    for (let i = 0; i < 10; i++) log.push(at(2026, 11, 5 + i));
    const e = evoInfo(createLogIndex(log), 0, at(2026, 11, 18));
    expect(e.avg).toBe(null);
  });
  it('stage 5 when 7-day avg is 0', () => {
    // first log day far enough back, but no cigs in last 7 full days
    const log = [at(2026, 10, 1)];
    const e = evoInfo(createLogIndex(log), 10, at(2026, 11, 18));
    expect(e.avg).toBe(0);
    expect(e.st).toBe(5);
  });
  it('stage from ratio to base', () => {
    // 7 days before Nov 18 = Nov 11..17. Put 1 cig each day = avg 1, base 10 → r=0.1 → stage 4
    const log = [];
    for (let d = 11; d <= 17; d++) log.push(at(2026, 11, d, 12));
    const e = evoInfo(createLogIndex(log), 10, at(2026, 11, 18));
    expect(e.avg).toBe(1);
    expect(e.st).toBe(4);
  });
  it('stage 0 when avg >= base', () => {
    const log = [];
    for (let d = 11; d <= 17; d++) {
      log.push(at(2026, 11, d, 10));
      log.push(at(2026, 11, d, 14));
    }
    const e = evoInfo(createLogIndex(log), 2, at(2026, 11, 18));
    expect(e.avg).toBe(2);
    expect(e.st).toBe(0);
  });
  it('stage 1 when avg just under base', () => {
    // 6 cigs over 7 days = avg ~0.857; base 1 → r~0.857 → stage 1 (r < 1)
    const log = [
      at(2026, 11, 11), at(2026, 11, 12), at(2026, 11, 13),
      at(2026, 11, 14), at(2026, 11, 15), at(2026, 11, 16),
    ];
    const e = evoInfo(createLogIndex(log), 1, at(2026, 11, 18));
    expect(e.avg).toBeCloseTo(6 / 7, 5);
    expect(e.st).toBe(1);
  });
});

describe('formLabel / hasOutfit', () => {
  it('formLabel', () => {
    expect(formLabel(0)).toBe('Wisp');
    expect(formLabel(2)).toBe('Wisp · Glow');
    expect(FORM[5]).toBe('Radiant');
  });
  it('free outfits always unlocked', () => {
    expect(hasOutfit('none', [], 0)).toBe(true);
    expect(hasOutfit('beanie', [], 0)).toBe(true);
  });
  it('paid needs stars-owned or evo stage', () => {
    expect(hasOutfit('flower', [], 0)).toBe(false);
    expect(hasOutfit('flower', ['flower'], 0)).toBe(true);
    expect(hasOutfit('flower', [], 1)).toBe(true); // OFMIN flower=1
    expect(hasOutfit('cape', [], 3)).toBe(false);
    expect(hasOutfit('cape', [], 4)).toBe(true);
  });
  it('sanitizeOutfit falls back to none', () => {
    expect(sanitizeOutfit('cape', [], 0)).toBe('none');
    expect(sanitizeOutfit('cape', ['cape'] as Outfit[], 0)).toBe('cape');
  });
  it('OUTFIT_PRICE known keys', () => {
    expect(OUTFIT_PRICE.flower).toBe(10);
    expect(OUTFIT_PRICE.cape).toBe(35);
  });
});
