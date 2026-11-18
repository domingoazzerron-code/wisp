// Theme + motion/haptics DOM helpers (legacy applyTheme / applyFx / fxLevel).

import type { State } from '../state/types.ts';

export type Theme = 'auto' | 'light' | 'dark' | 'glass';
export type FxLevel = 1 | 2 | 3;

export function fxLevel(s: Pick<State, 'fx'>): FxLevel {
  if (s.fx === 1 || s.fx === 2 || s.fx === 3) return s.fx as FxLevel;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 2;
  }
  return 1;
}

export function applyFx(level: FxLevel): void {
  document.documentElement.setAttribute(
    'data-fx',
    level === 1 ? 'full' : level === 2 ? 'calm' : 'quiet',
  );
}

export function fxNote(level: FxLevel): string {
  if (level === 1) return 'Animations and vibration.';
  if (level === 2) return 'No animations. Vibration stays on.';
  return 'No animations and no vibration.';
}

export function applyTheme(theme: Theme): void {
  const glass = theme === 'glass';
  const dark =
    glass ||
    theme === 'dark' ||
    (theme === 'auto' &&
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', glass ? 'glass' : dark ? 'dark' : 'light');
  const tc = glass ? '#0E0F12' : dark ? '#0C0F0D' : '#FFFFFF';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', tc);
    m.removeAttribute('media');
  });
}

export function applyOutfitAttr(outfit: string): void {
  document.documentElement.setAttribute('data-outfit', outfit || 'none');
}
