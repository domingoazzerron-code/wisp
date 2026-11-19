// Time-of-day scene for the Today hero: pure helpers, no DOM, easy to test.

export type SceneId = 'day' | 'dusk' | 'night';
export type Mood = 'good' | 'ok' | 'over';

export const SCENES: readonly SceneId[] = ['day', 'dusk', 'night'];

/**
 * Picks the scene from the device's local clock.
 * 06:30-17:00 day, 17:00-19:00 dusk, 19:00-05:30 night, 05:30-06:30 dawn (shown as dusk lighting).
 */
export function sceneForTime(hour: number, minute = 0): SceneId {
  const t = (((hour + minute / 60) % 24) + 24) % 24;
  if (t >= 6.5 && t < 17) return 'day';
  if ((t >= 17 && t < 19) || (t >= 5.5 && t < 6.5)) return 'dusk';
  return 'night';
}

/** `?scene=night` in the URL forces a scene (handy for previewing). Anything else returns null. */
export function sceneOverride(search: string): SceneId | null {
  const m = /[?&]scene=([a-z]+)/i.exec(search || '');
  const v = m ? m[1].toLowerCase() : '';
  return (SCENES as readonly string[]).includes(v) ? (v as SceneId) : null;
}

/** How today is going, for the weather: clear while on track, grey clouds and drizzle once over the limit. */
export function sceneMood(count: number, limit: number): Mood {
  if (!(limit > 0)) return 'ok';
  if (count > limit) return 'over';
  if (count <= limit * 0.6) return 'good';
  return 'ok';
}

/** Flowers in the foreground: one per smoke-free-streak day, up to the 12 drawn. */
export function flowerCount(streakDays: number): number {
  return Math.max(0, Math.min(12, Math.floor(streakDays) || 0));
}

/** Cottages in the village, from cigarettes not smoked against the usual (saved money / price per cigarette). */
export function villageTier(avoided: number): 0 | 1 | 2 | 3 {
  if (!(avoided > 0)) return 0;
  if (avoided >= 300) return 3;
  if (avoided >= 100) return 2;
  if (avoided >= 20) return 1;
  return 0;
}
