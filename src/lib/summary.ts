// Pure summary + share stats (legacy renderSummary / shStats / shFree).

import { startOfDay, DAY_MS, dayAdd } from './dates.ts';
import { limFor } from './limits.ts';
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
  /** Oldest to newest, last 14 days: count, limit that day, and whether it is before the first entry. */
  last14: { n: number; l: number; pre: boolean }[];
}

export function shareStats(
  s: Pick<State, 'log' | 'base' | 'pack' | 'per' | 'cur' | 'limH' | 'limit' | 'plan'>,
  idx: LogIndex,
  now: number,
  limitToday: number,
): ShareStats {
  const n = s.log.length;
  const days = n ? Math.round((startOfDay(now) - startOfDay(idx.first())) / DAY_MS) + 1 : 0;
  const cnt = idx.counts();
  const td = startOfDay(now);
  const first = n ? startOfDay(idx.first()) : td;
  const last14: ShareStats['last14'] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayAdd(td, -i);
    last14.push({ n: cnt[d] || 0, l: limFor(s, d), pre: d < first });
  }
  return {
    n,
    days,
    st: streak(s, idx, now),
    cur: n ? now - idx.last() : 0,
    av: Math.max(0, s.base * days - n),
    sv: calcSaved(s, idx, now),
    curSym: s.cur,
    limitZero: limitToday === 0,
    last14,
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

const FONT = '"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif';
const FLAME = 'M12 2c.6 3.4 5.4 5.6 5.4 11A5.4 5.4 0 0 1 6.6 13c0-2 1-3.4 2.2-4.4.1 2 .9 3 2 3.2C10.4 8.6 10.6 5.2 12 2z';

/** Text with letter spacing (legacy shSp). */
function spaced(x: CanvasRenderingContext2D, t: string, px: number, py: number, sp: number, al: 'left' | 'center' | 'right'): void {
  let w = 0;
  for (const ch of t) w += x.measureText(ch).width + sp;
  w -= sp;
  let cx = al === 'center' ? px - w / 2 : al === 'right' ? px - w : px;
  x.textAlign = 'left';
  for (const ch of t) {
    x.fillText(ch, cx, py);
    cx += x.measureText(ch).width + sp;
  }
}

/** Draw the 1080×1350 progress card (port of legacy shDraw, minus the weekly-recap variant). */
export function drawShareCard(
  canvas: HTMLCanvasElement,
  kind: ShareKind,
  st: ShareStats,
  _name: string,
): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const x = canvas.getContext('2d');
  if (!x) return;
  const hero = shareHero(kind, st);
  const f = shFree(st.cur);
  const money = st.curSym + Math.round(st.sv).toLocaleString('en-US');
  const all: Record<ShareKind, { v: string; c: string }> = {
    streak: { v: String(st.st), c: (st.st === 1 ? 'day' : 'days') + ' streak' },
    free: { v: f.v + ' ' + f.u, c: 'since the last one' },
    saved: { v: money, c: 'saved' },
    avoid: { v: String(st.av), c: 'not smoked' },
  };

  // background
  let g: CanvasGradient = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0B120D');
  g.addColorStop(1, '#060908');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W / 2, 520, 0, W / 2, 520, 640);
  g.addColorStop(0, 'rgba(91,190,120,.32)');
  g.addColorStop(0.5, 'rgba(47,122,68,.13)');
  g.addColorStop(1, 'rgba(47,122,68,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W / 2, 1330, 0, W / 2, 1330, 520);
  g.addColorStop(0, 'rgba(232,162,74,.20)');
  g.addColorStop(1, 'rgba(232,162,74,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // orbit rings with drifting sparks
  x.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    x.strokeStyle = 'rgba(91,190,120,' + (0.17 - i * 0.045) + ')';
    x.beginPath();
    x.arc(W / 2, 520, 290 + i * 135, 0, Math.PI * 2);
    x.stroke();
  }
  for (let k = 0; k < 14; k++) {
    const an = k * 2.399963 + 0.6;
    const rr = 290 + (k % 3) * 135;
    const sx = W / 2 + Math.cos(an) * rr;
    const sy = 520 + Math.sin(an) * rr;
    if (sy > 790 || sy < 190) continue;
    x.fillStyle = k % 4 === 0 ? 'rgba(232,162,74,.75)' : 'rgba(140,224,162,.7)';
    x.shadowColor = k % 4 === 0 ? 'rgba(232,162,74,.9)' : 'rgba(91,190,120,.9)';
    x.shadowBlur = 18;
    x.beginPath();
    x.arc(sx, sy, 3 + (k % 3) * 2, 0, Math.PI * 2);
    x.fill();
  }
  x.shadowBlur = 0;

  // brand row
  x.fillStyle = '#2F7A44';
  roundRect(x, 72, 68, 76, 76, 20);
  x.fill();
  x.save();
  x.translate(72 + 38 - 12 * 2.6, 68 + 38 - 10 * 2.6);
  x.scale(2.6, 2.6);
  x.fillStyle = '#EAF6EE';
  x.fill(new Path2D(FLAME));
  x.restore();
  x.fillStyle = 'rgba(238,242,239,.92)';
  x.font = '700 30px ' + FONT;
  x.textBaseline = 'alphabetic';
  spaced(x, 'WISP TRACKER', 170, 118, 5, 'left');
  x.fillStyle = 'rgba(154,165,158,.9)';
  x.font = '500 26px ' + FONT;
  x.textAlign = 'right';
  x.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - 72, 118);

  // glowing flame
  x.save();
  const sc = 12;
  x.translate(W / 2 - 12 * sc, 250 - 2 * sc);
  x.scale(sc, sc);
  g = x.createLinearGradient(12, 2, 12, 18.4);
  g.addColorStop(0, '#F4D58A');
  g.addColorStop(0.35, '#8CE0A2');
  g.addColorStop(1, '#2F9A58');
  x.fillStyle = g;
  x.shadowColor = 'rgba(91,190,120,.85)';
  x.shadowBlur = 70;
  x.fill(new Path2D(FLAME));
  x.restore();
  x.shadowBlur = 0;

  // hero number
  let fs = 300;
  x.font = '700 ' + fs + 'px ' + FONT;
  while (x.measureText(hero.v).width > 880 && fs > 90) {
    fs -= 8;
    x.font = '700 ' + fs + 'px ' + FONT;
  }
  g = x.createLinearGradient(0, 560, 0, 720);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#A9E6BC');
  x.fillStyle = g;
  x.textAlign = 'center';
  x.shadowColor = 'rgba(91,190,120,.45)';
  x.shadowBlur = 40;
  x.fillText(hero.v, W / 2, 700);
  x.shadowBlur = 0;
  x.fillStyle = 'rgba(238,242,239,.88)';
  let us = 46;
  x.font = '600 ' + us + 'px ' + FONT;
  while (x.measureText(hero.u).width > 900 && us > 26) {
    us -= 2;
    x.font = '600 ' + us + 'px ' + FONT;
  }
  x.fillText(hero.u, W / 2, 780);

  // three small stats
  const ks = (['streak', 'free', 'saved', 'avoid'] as ShareKind[]).filter((q) => q !== kind).slice(0, 3);
  const cw = 296;
  const gap = 24;
  const cy = 850;
  const ch = 170;
  ks.forEach((q, j) => {
    const cx0 = 72 + j * (cw + gap);
    x.fillStyle = 'rgba(255,255,255,.05)';
    roundRect(x, cx0, cy, cw, ch, 32);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.09)';
    x.lineWidth = 2;
    roundRect(x, cx0, cy, cw, ch, 32);
    x.stroke();
    const v = all[q].v;
    let vs = 54;
    x.font = '700 ' + vs + 'px ' + FONT;
    while (x.measureText(v).width > cw - 40 && vs > 26) {
      vs -= 2;
      x.font = '700 ' + vs + 'px ' + FONT;
    }
    x.fillStyle = '#EEF2EF';
    x.textAlign = 'center';
    x.fillText(v, cx0 + cw / 2, cy + 84);
    x.fillStyle = 'rgba(154,165,158,.95)';
    x.font = '500 25px ' + FONT;
    x.fillText(all[q].c, cx0 + cw / 2, cy + 128);
  });

  // last 14 days as ember capsules
  x.fillStyle = 'rgba(154,165,158,.9)';
  x.font = '600 24px ' + FONT;
  spaced(x, 'LAST 14 DAYS', 72, 1090, 4, 'left');
  let mx = 1;
  for (const o of st.last14) mx = Math.max(mx, o.n, o.l);
  const bw = 48;
  const bg = 18;
  const bx = (W - (14 * bw + 13 * bg)) / 2;
  const base = 1250;
  const maxH = 130;
  st.last14.forEach((o, j) => {
    const bx0 = bx + j * (bw + bg);
    const h = Math.max(20, Math.round((o.n / mx) * maxH));
    if (o.pre) {
      x.fillStyle = 'rgba(255,255,255,.07)';
      roundRect(x, bx0, base - 20, bw, 20, 10);
      x.fill();
      return;
    }
    const over = o.n > o.l;
    g = x.createLinearGradient(0, base - h, 0, base);
    if (over) {
      g.addColorStop(0, '#F4C77A');
      g.addColorStop(1, '#D98A2B');
      x.shadowColor = 'rgba(232,162,74,.6)';
    } else {
      g.addColorStop(0, '#8CE0A2');
      g.addColorStop(1, '#2F9A58');
      x.shadowColor = 'rgba(91,190,120,.6)';
    }
    x.fillStyle = g;
    x.shadowBlur = o.n === 0 ? 18 : 10;
    roundRect(x, bx0, base - h, bw, h, 24);
    x.fill();
    x.shadowBlur = 0;
  });
  x.fillStyle = 'rgba(154,165,158,.8)';
  x.font = '500 24px ' + FONT;
  x.textAlign = 'center';
  x.fillText('One day at a time.', W / 2, 1316);
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
