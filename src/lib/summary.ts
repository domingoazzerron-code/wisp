// Pure summary + share stats (legacy renderSummary / shStats / shFree).

import { startOfDay, DAY_MS } from './dates.ts';
import { dur } from './format.ts';
import type { LogIndex } from './logindex.ts';
import type { State } from '../state/types.ts';
import { calcSaved, per, streak } from './streaks.ts';

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryData {
  smokeFreeNow: string;
  longest: string;
  daysTracked: number;
  logged: number;
  avoided: number;
  moneySaved: string;
  moneySpent: string;
  waited: number;
  rows: SummaryRow[];
  hero: string;
  tileSaved: string;
  tileAvoided: string;
}

export function summaryData(
  s: Pick<State, 'log' | 'base' | 'pack' | 'per' | 'cur' | 'waited' | 'limH' | 'limit' | 'plan'>,
  idx: LogIndex,
  now: number,
): SummaryData {
  const a = idx.sorted();
  const n = a.length;
  let best = 0;
  for (let i = 1; i < n; i++) if (a[i] - a[i - 1] > best) best = a[i] - a[i - 1];
  const cur = n ? now - a[n - 1] : 0;
  if (cur > best) best = cur;
  const days = n ? Math.round((startOfDay(now) - startOfDay(a[0])) / DAY_MS) + 1 : 0;
  const saved = calcSaved(s, idx, now);
  const spent = n * per(s);
  const avoided = Math.max(0, s.base * days - n);
  const smokeFreeNow = n ? dur(cur) : '-';
  const longest = n ? dur(best) : '-';
  const moneySaved = s.cur + saved.toFixed(2);
  const moneySpent = s.cur + spent.toFixed(2);
  const rows: SummaryRow[] = [
    { label: 'Longest stretch', value: longest },
    { label: 'Days tracked', value: String(days) },
    { label: 'Cigarettes logged', value: String(n) },
    { label: 'Money spent', value: moneySpent },
    { label: 'Cravings waited out', value: String(s.waited || 0) },
  ];
  return {
    smokeFreeNow,
    longest,
    daysTracked: days,
    logged: n,
    avoided,
    moneySaved,
    moneySpent,
    waited: s.waited || 0,
    rows,
    hero: smokeFreeNow,
    tileSaved: moneySaved,
    tileAvoided: String(avoided),
  };
}

export type ShareKind = 'streak' | 'free' | 'saved' | 'avoid';

export interface ShareStats {
  n: number;
  days: number;
  st: number;
  cur: number;
  av: number;
  sv: number;
  curSym: string;
  limitZero: boolean;
}

export function shareStats(
  s: Pick<State, 'log' | 'base' | 'pack' | 'per' | 'cur' | 'limH' | 'limit' | 'plan'>,
  idx: LogIndex,
  now: number,
  limitToday: number,
): ShareStats {
  const n = s.log.length;
  const days = n ? Math.round((startOfDay(now) - startOfDay(idx.first())) / DAY_MS) + 1 : 0;
  return {
    n,
    days,
    st: streak(s, idx, now),
    cur: n ? now - idx.last() : 0,
    av: Math.max(0, s.base * days - n),
    sv: calcSaved(s, idx, now),
    curSym: s.cur,
    limitZero: limitToday === 0,
  };
}

export function shFree(ms: number): { v: number; u: string } {
  const h = Math.floor(ms / 36e5);
  if (h >= 48) return { v: Math.floor(h / 24), u: 'days' };
  if (h >= 1) return { v: h, u: h === 1 ? 'hour' : 'hours' };
  const m = Math.max(1, Math.floor(ms / 6e4));
  return { v: m, u: m === 1 ? 'minute' : 'minutes' };
}

export function shareHero(
  kind: ShareKind,
  st: ShareStats,
): { v: string; u: string } {
  if (kind === 'streak') {
    return {
      v: String(st.st),
      u:
        (st.st === 1 ? 'day ' : 'days ') +
        (st.limitZero ? 'smoke-free in a row' : 'within my limit in a row'),
    };
  }
  if (kind === 'free') {
    const f = shFree(st.cur);
    return { v: String(f.v), u: f.u + ' since my last cigarette' };
  }
  if (kind === 'saved') {
    return {
      v: st.curSym + Math.round(st.sv).toLocaleString('en-US'),
      u: 'saved so far',
    };
  }
  return { v: String(st.av), u: 'cigarettes not smoked' };
}

/** Draw a simple progress card onto a 1080×1350 canvas. */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  kind: ShareKind,
  st: ShareStats,
  name: string,
): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const x = canvas.getContext('2d');
  if (!x) return;
  const hero = shareHero(kind, st);

  // background
  x.fillStyle = '#0C0F0D';
  x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1A2A20');
  g.addColorStop(1, '#0C0F0D');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // card
  roundRect(x, 60, 80, W - 120, H - 200, 40);
  x.fillStyle = '#F4F6F4';
  x.fill();

  x.fillStyle = '#1A2A20';
  x.font = '600 28px system-ui,sans-serif';
  x.textAlign = 'center';
  x.fillText(name ? name + ' · Wisp' : 'Wisp tracker', W / 2, 160);

  x.fillStyle = '#1F5A34';
  x.font = '700 120px system-ui,sans-serif';
  x.fillText(hero.v, W / 2, 360);

  x.fillStyle = '#3C4A40';
  x.font = '500 36px system-ui,sans-serif';
  wrapCenter(x, hero.u, W / 2, 420, W - 220, 44);

  // secondary stats
  const others: { lab: string; val: string }[] = [];
  if (kind !== 'streak') others.push({ lab: 'Streak', val: String(st.st) });
  if (kind !== 'free') {
    const f = shFree(st.cur);
    others.push({ lab: 'Smoke-free', val: f.v + ' ' + f.u });
  }
  if (kind !== 'saved') {
    others.push({
      lab: 'Saved',
      val: st.curSym + Math.round(st.sv).toLocaleString('en-US'),
    });
  }
  if (kind !== 'avoid') others.push({ lab: 'Avoided', val: String(st.av) });
  const slice = others.slice(0, 3);
  const boxW = 280;
  const gap = 24;
  const total = slice.length * boxW + (slice.length - 1) * gap;
  let left = (W - total) / 2;
  slice.forEach((o) => {
    roundRect(x, left, 560, boxW, 160, 24);
    x.fillStyle = '#E8EDE9';
    x.fill();
    x.fillStyle = '#5A6A5E';
    x.font = '600 22px system-ui,sans-serif';
    x.textAlign = 'center';
    x.fillText(o.lab.toUpperCase(), left + boxW / 2, 620);
    x.fillStyle = '#1A2A20';
    x.font = '700 40px system-ui,sans-serif';
    x.fillText(o.val, left + boxW / 2, 680);
    left += boxW + gap;
  });

  x.fillStyle = 'rgba(26,42,32,.55)';
  x.font = '500 26px system-ui,sans-serif';
  x.textAlign = 'center';
  x.fillText(st.n + ' logged · ' + st.days + ' days tracked', W / 2, 820);

  x.fillStyle = 'rgba(26,42,32,.4)';
  x.font = '500 24px system-ui,sans-serif';
  x.fillText('One day at a time.', W / 2, 1240);
}

function roundRect(
  x: CanvasRenderingContext2D,
  a: number,
  b: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

function wrapCenter(
  x: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (x.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => x.fillText(ln, cx, y + i * lineH));
}
