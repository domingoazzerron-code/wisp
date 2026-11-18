// Pure diary, last-week card, and weekly recap (legacy dayStats / diaryText / weekInfo / recapInfo).

import type { State } from '../state/types.ts';
import { dayAdd, startOfDay, DAY_MS } from './dates.ts';
import { dur, money, tm } from './format.ts';
import type { LogIndex } from './logindex.ts';
import { limFor } from './limits.ts';
import { cntBetween, per } from './streaks.ts';
import { cravIn } from './missions.ts';
import { gapData } from './gaps.ts';

export interface DayStats {
  t: number;
  f: number;
  gp: number;
  hl: number;
  tt: string;
  L: number;
  y: number;
}

export function dayStats(
  s: Pick<State, 'log' | 'heals' | 'tags' | 'limH' | 'limit' | 'plan'>,
  dayStart: number,
  now?: number,
): DayStats {
  void now;
  const e = dayStart + DAY_MS;
  const a: number[] = [];
  let py = 0;
  for (const t of s.log) {
    if (t >= dayStart && t < e) a.push(t);
    if (t >= dayStart - DAY_MS && t < dayStart) py++;
  }
  a.sort((x, y) => x - y);
  let hl = 0;
  for (const h of s.heals || []) if (h >= dayStart && h < e) hl++;
  let gp = 0;
  for (let i = 1; i < a.length; i++) gp = Math.max(gp, a[i] - a[i - 1]);
  const tc: Record<string, number> = {};
  let tt = '';
  let tn = 0;
  for (const t of a) {
    const g = s.tags?.[t];
    if (g) {
      tc[g] = (tc[g] || 0) + 1;
      if (tc[g] > tn) {
        tn = tc[g];
        tt = g;
      }
    }
  }
  return { t: a.length, f: a[0] || 0, gp, hl, tt, L: limFor(s, dayStart), y: py };
}

/** Wisp diary lines for one day (legacy diaryText). */
export function diaryText(
  s: Pick<State, 'log' | 'heals' | 'tags' | 'limH' | 'limit' | 'plan'>,
  dayStart: number,
): string[] {
  const st = dayStats(s, dayStart);
  const o: string[] = [];
  if (!st.t) o.push('Not one cigarette today. I felt almost solid.');
  else if (st.L > 0 && st.t > st.L)
    o.push(st.t + ' today, ' + (st.t - st.L) + " past your limit. Tomorrow is a fresh page. I'm still here.");
  else if (st.y > 0 && st.t < st.y)
    o.push(st.t + ' today, ' + (st.y - st.t) + ' fewer than yesterday. I felt it.');
  else if (st.L > 0 && st.t === st.L) o.push('You stopped right at ' + st.L + '. That took something.');
  else o.push(st.t + (st.L > 0 ? ' of ' + st.L : '') + ' today. I held together.');

  if (st.hl)
    o.push(
      'You waited out ' +
        st.hl +
        ' craving' +
        (st.hl > 1 ? 's' : '') +
        '. That was me getting stronger.',
    );
  else if (st.gp >= 72e5) o.push('Your longest stretch was ' + dur(st.gp) + '. I noticed.');
  else if (st.t && new Date(st.f).getHours() >= 12)
    o.push('You held off until ' + tm(st.f) + '. I noticed.');

  if (st.tt) o.push('Mostly ' + st.tt.toLowerCase() + " today. I'll watch for it.");
  else if (st.t) o.push("Tell me what sets it off and I'll watch for it.");
  return o;
}

export interface DiaryView {
  keys: number[];
  entries: Record<number, string[]>;
  /** Ensure today's (evening) and yesterday's lines are written. */
  dirty: boolean;
}

/**
 * Build diary view and optionally materialize missing entries (legacy renderDiary side-effects).
 * Caller should save if dirty.
 */
export function ensureDiary(
  s: Pick<State, 'log' | 'heals' | 'tags' | 'limH' | 'limit' | 'plan' | 'diary'>,
  now: number,
): DiaryView {
  const D: Record<string, string[]> = { ...(s.diary as Record<string, string[]>) };
  const td = startOfDay(now);
  const yd = td - DAY_MS;
  let dirty = false;
  const first = s.log.length ? startOfDay(Math.min(...s.log)) : 0;
  if (new Date(now).getHours() >= 20) {
    const a = diaryText(s, td);
    if (JSON.stringify(D[String(td)]) !== JSON.stringify(a)) {
      D[String(td)] = a;
      dirty = true;
    }
  }
  if (!D[String(yd)] && first && first < td) {
    D[String(yd)] = diaryText(s, yd);
    dirty = true;
  }
  const keys = Object.keys(D)
    .map(Number)
    .filter((k) => !isNaN(k))
    .sort((x, y) => y - x);
  const entries: Record<number, string[]> = {};
  for (const k of keys) entries[k] = D[String(k)] || [];
  return { keys, entries, dirty };
}

export function diaryLabel(d: number, now: number): string {
  const td = startOfDay(now);
  const yd = td - DAY_MS;
  if (d === td) return 'Tonight';
  if (d === yd) return 'Yesterday';
  return new Date(d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export interface WeekCard {
  range: string;
  lines: string[];
  tot: number;
  ws: number;
}

/** Last completed week summary card (legacy weekInfo). */
export function weekCard(
  s: Pick<State, 'log' | 'base' | 'pack' | 'per' | 'cur' | 'limH' | 'limit' | 'plan' | 'cravs'>,
  idx: LogIndex,
  counts: Record<number, number>,
  now: number,
): WeekCard | null {
  const td = startOfDay(now);
  const dow = (new Date(td).getDay() + 6) % 7;
  const ws = dayAdd(td, -dow);
  const ls = dayAdd(ws, -7);
  const ps = dayAdd(ws, -14);
  const first = s.log.length ? startOfDay(idx.first()) : 0;
  if (!(first && first < ws)) return null;
  const es = Math.max(ls, first);
  const nd = Math.round((ws - es) / DAY_MS);
  if (nd <= 0) return null;
  const tot = cntBetween(idx, es, ws);
  let u = 0;
  let lt = 0;
  let bd = es;
  let bc = 1e9;
  for (let i = 0; i < nd; i++) {
    const d = dayAdd(es, i);
    const n = counts[d] || 0;
    const L = limFor(s, d);
    if (L > 0) {
      lt++;
      if (n <= L) u++;
    }
    if (n < bc) {
      bc = n;
      bd = d;
    }
  }
  const ln: string[] = [];
  ln.push('About ' + (tot / nd).toFixed(1) + ' a day over ' + nd + ' day' + (nd === 1 ? '' : 's') + '.');
  if (nd === 7 && first <= ps) {
    const tp = cntBetween(idx, ps, ls);
    const df = tot - tp;
    ln.push(
      df < 0
        ? Math.abs(df) + ' fewer than the week before.'
        : df > 0
          ? df + ' more than the week before.'
          : 'Same as the week before.',
    );
  }
  if (lt > 0) ln.push(u + ' of ' + lt + ' days within your limit.');
  ln.push(
    'Best day: ' +
      new Date(bd).toLocaleDateString(undefined, { weekday: 'long' }) +
      ', ' +
      bc +
      '.',
  );
  const sv = (s.base * nd - tot) * per(s);
  if (sv > 0 && per(s) > 0) ln.push('About ' + money(s.cur, sv) + ' saved against your usual.');
  const cc = cravIn(s.cravs || [], es, ws);
  if (cc) ln.push(cc + (cc === 1 ? ' craving' : ' cravings') + ' you got through.');
  const fm = { day: 'numeric' as const, month: 'short' as const };
  return {
    ws,
    tot,
    lines: ln,
    range:
      new Date(es).toLocaleDateString(undefined, fm) +
      ' to ' +
      new Date(dayAdd(ws, -1)).toLocaleDateString(undefined, fm),
  };
}

export interface RecapInfo {
  ws: number;
  cur: boolean;
  hl: { v: string; u: string };
  story: string[];
  range: string;
}

function wd(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
}

/** Weekly recap card (legacy recapInfo). */
export function recapInfo(
  s: Pick<
    State,
    'log' | 'limH' | 'limit' | 'plan' | 'mlog' | 'cravs' | 'base' | 'pack' | 'per'
  >,
  idx: LogIndex,
  counts: Record<number, number>,
  nowMs: number,
): RecapInfo | null {
  const now = new Date(nowMs);
  const td = startOfDay(nowMs);
  const dow = (new Date(td).getDay() + 6) % 7;
  const first = s.log.length ? startOfDay(idx.first()) : 0;
  if (!first) return null;
  const cur = dow === 6;
  const ws = cur ? dayAdd(td, -6) : dayAdd(td, -dow - 7);
  const we = dayAdd(ws, 7);
  if (first >= we) return null;
  const es = Math.max(ws, first);
  const dEnd = cur && now.getHours() < 21 ? td : we;
  const nd = Math.max(0, Math.round((dEnd - es) / DAY_MS));
  const gm = gapData(idx, nowMs).m;
  const tot = cntBetween(idx, es, we);
  const cc = cravIn(s.cravs || [], es, we);
  let zero = 0;
  let u = 0;
  let lt = 0;
  let bd = es;
  let bc = 1e9;
  let bg = 0;
  let bgd = es;
  for (let i = 0; i < nd; i++) {
    const d = dayAdd(es, i);
    const n = counts[d] || 0;
    const L = limFor(s, d);
    if (L > 0) {
      lt++;
      if (n <= L) u++;
    }
    if (n === 0) zero++;
    if (n < bc) {
      bc = n;
      bd = d;
    }
    if ((gm[d] || 0) > bg) {
      bg = gm[d];
      bgd = d;
    }
  }
  let mdn = 0;
  for (const m of s.mlog || []) if (m >= es && m < we) mdn++;

  let hl: { v: string; u: string };
  if (zero > 0) hl = { v: String(zero), u: zero === 1 ? 'smoke-free day' : 'smoke-free days' };
  else if (bg >= 54e5) hl = { v: dur(bg), u: 'longest gap, on ' + wd(bgd) };
  else if (cc > 0)
    hl = {
      v: String(cc),
      u: cc === 1 ? 'craving you got through' : 'cravings you got through',
    };
  else if (nd > 0)
    hl = {
      v: String(bc),
      u: (bc === 1 ? 'cigarette' : 'cigarettes') + ' on ' + wd(bd) + ', your best day',
    };
  else hl = { v: String(tot), u: tot === 1 ? 'cigarette so far' : 'cigarettes so far' };

  const days = Math.max(1, Math.round((Math.min(we, dayAdd(td, 1)) - es) / DAY_MS));
  const pw = dayAdd(ws, -7);
  const story: string[] = [];
  if (first <= pw && (!cur || now.getHours() >= 21)) {
    const df = tot - cntBetween(idx, pw, ws);
    story.push(
      df < 0
        ? 'You smoked ' + Math.abs(df) + ' fewer than the week before. I felt that.'
        : df > 0
          ? 'This week ran ' +
            df +
            ' heavier than the one before. It happens, and we keep going.'
          : 'About the same as the week before. Steady counts.',
    );
  } else {
    story.push('About ' + (tot / days).toFixed(1) + ' a day this week, ' + tot + ' in all.');
  }
  story.push(
    zero > 0
      ? 'You had ' +
          zero +
          ' smoke-free ' +
          (zero === 1 ? 'day' : 'days') +
          '. I felt almost solid.'
      : bg >= 54e5
        ? 'Your longest gap was ' + dur(bg) + ', on ' + wd(bgd) + '. I noticed.'
        : cc > 0
          ? 'You got through ' +
            cc +
            (cc === 1 ? ' craving' : ' cravings') +
            '. That was me getting stronger.'
          : nd > 0
            ? 'Your best day was ' + wd(bd) + '. Let’s build on it.'
            : 'This is just the start. I’m with you.',
  );
  const limitLine =
    (lt > 0 && u > 0 ? u + ' of ' + lt + ' days within your limit.' : '') +
    (mdn
      ? (lt > 0 && u > 0 ? ' And ' : 'You finished ') +
        mdn +
        (mdn === 1 ? ' mission' : ' missions') +
        (lt > 0 && u > 0 ? ' done.' : ' with me.')
      : '');
  story.push(limitLine || 'Next week, one gap at a time.');

  const fm = { day: 'numeric' as const, month: 'short' as const };
  return {
    ws,
    cur,
    hl,
    story,
    range:
      new Date(es).toLocaleDateString(undefined, fm) +
      ' to ' +
      new Date(Math.min(dayAdd(we, -1), td)).toLocaleDateString(undefined, fm),
  };
}
