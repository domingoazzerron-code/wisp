// Text formatting (legacy dur, durS, hl, tm, money).

/** Coarse duration: 'under a minute', '45m', '3h 5m', '2d 4h'. */
export function dur(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

/** Precise duration with seconds: '1d 2h 3m 4s' (days and hours hidden while zero). Negative input shows 0. */
export function durS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's';
}

/** Hour of day as '3 PM' (hours are taken mod 24). */
export function hl(h: number): string {
  h = h % 24;
  return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
}

/** Clock time in the device's locale, e.g. '3:05 PM'. */
export function tm(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Currency symbol + amount with 2 decimals. */
export function money(cur: string, n: number): string {
  return cur + n.toFixed(2);
}
