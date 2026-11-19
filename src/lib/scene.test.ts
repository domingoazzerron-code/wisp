import { describe, expect, it } from 'vitest';
import { flowerCount, sceneForTime, sceneMood, sceneOverride, villageTier } from './scene.ts';

describe('sceneForTime', () => {
  it('is day from 06:30 up to 17:00', () => {
    expect(sceneForTime(6, 30)).toBe('day');
    expect(sceneForTime(12)).toBe('day');
    expect(sceneForTime(16, 59)).toBe('day');
  });
  it('is dusk in the evening and around dawn', () => {
    expect(sceneForTime(17)).toBe('dusk');
    expect(sceneForTime(18, 59)).toBe('dusk');
    expect(sceneForTime(5, 30)).toBe('dusk');
    expect(sceneForTime(6, 29)).toBe('dusk');
  });
  it('is night from 19:00 to 05:30', () => {
    expect(sceneForTime(19)).toBe('night');
    expect(sceneForTime(0)).toBe('night');
    expect(sceneForTime(5, 29)).toBe('night');
  });
  it('wraps hours past 24', () => {
    expect(sceneForTime(36)).toBe('day');
  });
});

describe('sceneOverride', () => {
  it('reads ?scene=', () => {
    expect(sceneOverride('?scene=night')).toBe('night');
    expect(sceneOverride('?a=1&scene=DUSK')).toBe('dusk');
  });
  it('ignores unknown or missing values', () => {
    expect(sceneOverride('?scene=noon')).toBeNull();
    expect(sceneOverride('')).toBeNull();
  });
});

describe('sceneMood', () => {
  it('is ok with no limit', () => expect(sceneMood(5, 0)).toBe('ok'));
  it('is good while comfortably under', () => expect(sceneMood(2, 10)).toBe('good'));
  it('is ok when close to the limit', () => expect(sceneMood(8, 10)).toBe('ok'));
  it('is over only past the limit', () => {
    expect(sceneMood(10, 10)).toBe('ok');
    expect(sceneMood(11, 10)).toBe('over');
  });
});

describe('flowerCount / villageTier', () => {
  it('caps flowers at 12 and floors at 0', () => {
    expect(flowerCount(-3)).toBe(0);
    expect(flowerCount(5)).toBe(5);
    expect(flowerCount(40)).toBe(12);
  });
  it('grows the village with cigarettes avoided', () => {
    expect(villageTier(0)).toBe(0);
    expect(villageTier(19)).toBe(0);
    expect(villageTier(20)).toBe(1);
    expect(villageTier(100)).toBe(2);
    expect(villageTier(300)).toBe(3);
  });
});
