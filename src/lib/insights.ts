// Pure Insights helpers (legacy chart bars, peak hours, heat, avg gap).

import { dayAdd, startOfDay, DAY_MS } from './dates.ts';
import { dur, hl } from './format.ts';
import { limFor } from './limits.ts';
import type { LogIndex } from './logindex.ts';
import type { State } from '../state/types.ts';
import { cntBetween, countSince, per } from './streaks.ts';
import { cravIn } from './missions.ts';

export type Rng = 7 | 30 | 90;

export interface DayBar {
  full: string;
  v: number;
  lab: string;
  txt: string | number;
  over: boolean;
}

/** Bars for the cigarettes-per-day chart (legacy chart()). */
export function dayBars(
  s: Pick<State, 'limH' | 'limit' | 'plan'>,
  counts: Record<number, number>,
  rng: Rng,
  now: number,
): DayBar[] {
  const d0 = new Date(now);
  const y = d0.getFullYear();
  const mo = d0.getMonth();
  const dd = d0.getDate();
  const Lc = limFor(s, startOfDay(now));
  const bars: DayBar[] = [];
  if (rng === 90) {
    for (let i = 12; i >= 0; i--) {
      let sum = 0;
      for (let j = 6; j >= 0; j--) sum += counts[new Date(y, mo, dd - i * 7 - j).getTime()] || 0;
      const d = new Date(y, mo, dd - i * 7 - 6);
      bars.push({
        full: 'week of ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        v: sum / 7,
        lab: i % 2 === 0 ? d.getMonth() + 1 + '/' + d.getDate() : '',
        txt: sum ? (sum / 7).toFixed(1) : '',
        over: Lc > 0 && sum / 7 > Lc,
      });
    }
  } else {
    for (let i = rng - 1; i >= 0; i--) {
      const d = new Date(y, mo, dd - i);
      const c = counts[d.getTime()] || 0;
      const lm = limFor(s, d.getTime());
      bars.push({
        full: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        v: c,
        lab:
          rng === 7
            ? d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
            : i % 5 === 0
              ? String(d.getDate())
              : '',
        txt: rng === 7 ? c || '' : '',
        over: lm > 0 && c > lm,
      });
    }
  }
  return bars;
}

/** SVG inner markup for the day chart. */
export function dayChartSvg(bars: DayBar[], limitToday: number): string {
  let mx = Math.max(limitToday, 1);
  bars.forEach((x) => {
    if (x.v > mx) mx = x.v;
  });
  const n = bars.length;
  const H = 84;
  const top = 18;
  const gap = n === 7 ? 13 : n === 13 ? 6 : 2;
  const bw = (300 - (n + 1) * gap) / n;
  const fs = n === 13 ? 9 : 11;
  let s = '';
  bars.forEach((x, k) => {
    const px = gap + k * (bw + gap);
    const h = (x.v / mx) * H;
    s +=
      '<rect x="' +
      px.toFixed(1) +
      '" y="' +
      (top + H - h).toFixed(1) +
      '" width="' +
      bw.toFixed(1) +
      '" height="' +
      Math.max(h, x.v ? 3 : 0).toFixed(1) +
      '" rx="' +
      Math.min(7, bw / 2.5).toFixed(1) +
      '" fill="' +
      (x.over ? 'var(--warn)' : 'var(--g)') +
      '"' +
      (k < n - 1 ? ' fill-opacity=".85"' : '') +
      '/>';
    if (x.txt !== '') {
      s +=
        '<text x="' +
        (px + bw / 2).toFixed(1) +
        '" y="' +
        (top + H - h - 5).toFixed(1) +
        '" text-anchor="middle" font-size="' +
        fs +
        '" font-weight="600" fill="var(--mute)">' +
        x.txt +
        '</text>';
    }
    if (x.lab !== '') {
      s +=
        '<text x="' +
        (px + bw / 2).toFixed(1) +
        '" y="124" text-anchor="middle" font-size="' +
        (n === 7 ? 11 : 10) +
        '" fill="var(--mute)">' +
        x.lab +
        '</text>';
    }
  });
  if (limitToday > 0) {
    const ly = top + H - (limitToday / mx) * H;
    s =
      '<line x1="0" x2="300" y1="' +
      ly +
      '" y2="' +
      ly +
      '" stroke="var(--mute)" stroke-width="1.2" stroke-dasharray="4 4"/>' +
      s +
      '<text class="hal" x="2" y="' +
      (ly - 4) +
      '" text-anchor="start" font-size="10" fill="var(--mute)">limit ' +
      limitToday +
      '</text>';
  }
  return s;
}

/** Average same-day gap in the last rng days. */
export function avgGapMs(log: readonly number[], rng: number, now: number): number | null {
  const a = log.filter((t) => t >= now - rng * DAY_MS).slice().sort((x, y) => x - y);
  let sum = 0;
  let c = 0;
  for (let i = 1; i < a.length; i++) {
    if (startOfDay(a[i]) === startOfDay(a[i - 1])) {
      sum += a[i] - a[i - 1];
      c++;
    }
  }
  return c ? sum / c : null;
}

export interface PeakInfo {
  hours: number[];
  peak: number;
  max: number;
  count: number;
  tip: string;
  peakLabel: string;
  hoursSvg: string;
  aria: string;
}

/** Peak hours for last rng days. */
export function peakHours(log: readonly number[], rng: number, now: number): PeakInfo {
  const hc = new Array(24).fill(0);
  let pn = 0;
  for (const t of log) {
    if (t >= now - rng * DAY_MS) {
      pn++;
      hc[new Date(t).getHours()]++;
    }
  }
  let mx = 0;
  let pk = -1;
  for (let i = 0; i < 24; i++) if (hc[i] > mx) {
    mx = hc[i];
    pk = i;
  }
  let sv = '';
  for (let i = 0; i < 24; i++) {
    const h = mx ? (hc[i] / mx) * 56 : 0;
    sv +=
      '<rect x="' +
      (i * 12 + 1) +
      '" y="' +
      (62 - h) +
      '" width="10" height="' +
      Math.max(h, hc[i] ? 3 : 0) +
      '" rx="3" fill="' +
      (i === pk ? 'var(--g)' : 'var(--bar)') +
      '"/>';
  }
  (
    [
      [0, '12a'],
      [6, '6a'],
      [12, '12p'],
      [18, '6p'],
    ] as [number, string][]
  ).forEach((l) => {
    sv +=
      '<text x="' +
      (l[0] * 12 + 6) +
      '" y="80" text-anchor="middle" font-size="10" fill="var(--mute)">' +
      l[1] +
      '</text>';
  });
  const tp = hc
    .map((c, i) => (c ? i : -1))
    .filter((i) => i >= 0)
    .sort((x, y) => hc[y] - hc[x]);
  let hs = '';
  tp.slice(0, 3).forEach((h) => {
    hs += (hs ? ', ' : '') + hl(h) + ' (' + hc[h] + ')';
  });
  return {
    hours: hc,
    peak: pk,
    max: mx,
    count: pn,
    tip:
      pk >= 0 && pn >= 10
        ? 'Tip: set a phone alarm a little before ' + hl(pk) + ' to get ahead of your busiest hour.'
        : '',
    peakLabel: pk >= 0 ? 'Most at ' + hl(pk) + ' to ' + hl(pk + 1) : 'Not enough data yet',
    hoursSvg: sv,
    aria:
      'Cigarettes by hour of day, last ' +
      rng +
      ' days. ' +
      (hs ? 'Busiest hours: ' + hs + '.' : 'No data yet.'),
  };
}

/** Sorted trigger counts for tags or crt in the last rng days. */
export function tagCounts(
  timestamps: readonly number[],
  map: Record<string, string>,
  rng: number,
  now: number,
): [string, number][] {
  const tc: Record<string, number> = {};
  for (const t of timestamps) {
    if (t < now - rng * DAY_MS) continue;
    const g = map[t];
    if (g) tc[g] = (tc[g] || 0) + 1;
  }
  return Object.keys(tc)
    .sort((x, y) => tc[y] - tc[x])
    .map((k) => [k, tc[k]] as [string, number]);
}

export interface HeatDay {
  ts: number;
  count: number;
  opacity: number;
  title: string;
}

/** Last 35 days for the heat calendar. */
export function heatDays(
  counts: Record<number, number>,
  limitToday: number,
  now: number,
): { days: HeatDay[]; aria: string } {
  const mx = Math.max(limitToday, 1, ...Object.values(counts));
  const n = new Date(now);
  const days: HeatDay[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
    const c = counts[d.getTime()] || 0;
    days.push({
      ts: d.getTime(),
      count: c,
      opacity: c ? 0.25 + 0.75 * (c / mx) : 0,
      title: d.toLocaleDateString() + ': ' + c,
    });
  }
  const act = days.filter((x) => x.count > 0).length;
  let tpd: HeatDay | null = null;
  for (const x of days) if (!tpd || x.count > tpd.count) tpd = x;
  const aria =
    'Calendar of the last 5 weeks. ' +
    act +
    ' of 35 days have cigarettes logged.' +
    (tpd && tpd.count
      ? ' Busiest day: ' +
        new Date(tpd.ts).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }) +
        ', ' +
        tpd.count +
        '.'
      : '');
  return { days, aria };
}

export function weekCompare(
  idx: LogIndex,
  rng: number,
  now: number,
  cur: string,
  packPer: number,
): {
  w1: number;
  w2: number;
  df: number;
  label: string;
  verdict: string;
  verdictClass: string;
  sub: string;
} {
  const w1 = countSince(idx, rng, now);
  const w2 = countSince(idx, 2 * rng, now) - w1;
  const df = w1 - w2;
  let verdict = 'No cigarettes logged in this period.';
  let verdictClass = 'vd';
  if (w1 || w2) {
    if (df < 0) {
      verdict = 'Down ' + Math.abs(df) + '. Nice work.';
      verdictClass = 'vd good';
    } else if (df > 0) {
      verdict = 'Up ' + df + '. A new day is a fresh start.';
      verdictClass = 'vd';
    } else {
      verdict = 'Holding steady.';
      verdictClass = 'vd';
    }
  }
  const sub =
    ((w1 || w2)
      ? df < 0
        ? Math.abs(df) + ' fewer than the ' + rng + ' days before'
        : df > 0
          ? df + ' more than the ' + rng + ' days before'
          : 'Same as the ' + rng + ' days before'
      : 'Nothing logged yet') +
    '. About ' +
    (w1 / rng).toFixed(1) +
    ' a day, ' +
    cur +
    (w1 * packPer).toFixed(2) +
    ' spent.';
  return {
    w1,
    w2,
    df,
    label: 'Last ' + rng + ' days vs the ' + rng + ' before',
    verdict,
    verdictClass,
    sub,
  };
}

export function moneyTiles(
  idx: LogIndex,
  s: Pick<State, 'pack' | 'per' | 'cur' | 'base' | 'nic' | 'tar' | 'log'>,
  rng: number,
  now: number,
): {
  todayC: number;
  todayM: string;
  rangeC: number;
  rangeM: string;
  monthC: number;
  monthM: string;
  savedLabel: string;
  savedSub: string;
  nt: string;
  ntSub: string;
} {
  const p = per(s);
  const n1 = countSince(idx, 1, now);
  const nR = countSince(idx, rng, now);
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const nM = idx.sorted().length - idx.lowerBound(monthStart);
  let savedLabel = 'Not enough data yet';
  let savedSub = '';
  if (s.log.length && idx.first()) {
    const first = startOfDay(idx.first());
    const days = Math.round((startOfDay(now) - first) / DAY_MS) + 1;
    const diff = (s.base * days - s.log.length) * p;
    if (diff >= 0) {
      savedLabel = s.cur + diff.toFixed(2);
      savedSub = 'Compared with ' + s.base + ' a day over ' + days + ' days';
    } else {
      savedLabel = s.cur + (-diff).toFixed(2) + ' above your usual';
      savedSub = 'Compared with your usual ' + s.base + ' a day over ' + days + ' days';
    }
  }
  return {
    todayC: n1,
    todayM: s.cur + (n1 * p).toFixed(2),
    rangeC: nR,
    rangeM: s.cur + (nR * p).toFixed(2),
    monthC: nM,
    monthM: s.cur + (nM * p).toFixed(2),
    savedLabel,
    savedSub,
    nt: (n1 * s.nic).toFixed(1) + ' mg nicotine today',
    ntSub:
      (n1 * s.tar).toFixed(0) +
      ' mg tar today. Last ' +
      rng +
      ' days: ' +
      (nR * s.nic).toFixed(1) +
      ' mg nicotine, ' +
      (nR * s.tar).toFixed(0) +
      ' mg tar. Rough estimates from the values in Settings, not medical figures.',
  };
}

export function cravingCompare(
  cravs: readonly number[],
  rng: number,
  now: number,
): { c1: number; c2: number; text: string; sub: string } {
  const td = startOfDay(now);
  const e = td + DAY_MS;
  const c1 = cravIn(cravs, dayAdd(td, -(rng - 1)), e);
  const c2 = cravIn(cravs, dayAdd(td, -(2 * rng - 1)), dayAdd(td, -(rng - 1)));
  const df = c1 - c2;
  const text = c1 + (c1 === 1 ? ' craving' : ' cravings');
  let sub = '';
  if (c1 || c2) {
    sub =
      (df > 0 ? df + ' more than the ' + rng + ' days before' : df < 0 ? Math.abs(df) + ' fewer than the ' + rng + ' days before' : 'Same as the ' + rng + ' days before') +
      '. Waiting out a craving also lands here.';
  } else {
    sub = 'None logged yet. Hold the + button, or use the Today screen, to log one you got through.';
  }
  return { c1, c2, text, sub };
}

// silence unused import warning for cntBetween if tree-shaken
void cntBetween;
void dur;
