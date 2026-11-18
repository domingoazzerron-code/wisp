import { describe, it, expect } from 'vitest';
import { backupView, restartView } from './nudges.ts';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe('restartView', () => {
  const td = day(2026, 11, 18);
  const now = td + 12 * 3600e3;
  it('shows when quit started and cigs today and not dismissed', () => {
    const v = restartView(td, 2, 0, now);
    expect(v).toBeTruthy();
    expect(v!.text).toContain('2 after your quit day');
  });
  it('hides when dismissed today', () => {
    expect(restartView(td, 2, td, now)).toBe(null);
  });
  it('hides when no cigs or quit not reached', () => {
    expect(restartView(td, 0, 0, now)).toBe(null);
    expect(restartView(day(2026, 11, 20), 3, 0, now)).toBe(null);
  });
});

describe('backupView', () => {
  const now = day(2026, 11, 18) + 1;
  it('shows after 14 days and 5+ logs when not signed in', () => {
    const first = day(2026, 10, 1);
    const v = backupView(10, 0, first, 0, false, now);
    expect(v).toBeTruthy();
    expect(v!.text).toContain('not backed up');
  });
  it('hides when signed in, few logs, or snoozed', () => {
    const first = day(2026, 10, 1);
    expect(backupView(10, 0, first, 0, true, now)).toBe(null);
    expect(backupView(3, 0, first, 0, false, now)).toBe(null);
    expect(backupView(10, 0, first, now + 864e5, false, now)).toBe(null);
  });
  it('mentions days since last backup', () => {
    const last = day(2026, 10, 20);
    const v = backupView(10, last, last, 0, false, now);
    expect(v!.text).toContain('days ago');
  });
});
