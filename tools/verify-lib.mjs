// Parity check: src/lib must behave exactly like the legacy math in legacy/index.html.
// Run: node tools/verify-lib.mjs   (Node 22.18+ runs the .ts files directly)
// Time zones matter (legacy uses local midnight): run it under several, e.g.
//   for tz in UTC America/New_York Europe/London Asia/Manila Australia/Lord_Howe; do TZ=$tz node tools/verify-lib.mjs; done
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { loadState, STORAGE_KEY } from '../src/state/storage.ts';
import { defaultState } from '../src/state/defaults.ts';
import { createLogIndex } from '../src/lib/logindex.ts';
import { startOfDay, dayAdd, dayKey } from '../src/lib/dates.ts';
import { limFor, limitOn, lim, setLimit, planE, planSched } from '../src/lib/limits.ts';
import { streak, bestStreak, countSince, monthCount, cntBetween, calcSaved, per, gapBase, gapLeft } from '../src/lib/streaks.ts';
import { dur, durS, hl, tm, money } from '../src/lib/format.ts';

const lines = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8').split('\n');
const chunk = lines.slice(1024, 1054).join('\n'); // K, def ... save()
if (!chunk.startsWith("var K='cigtracker.v1'") || !chunk.includes('function save()')) throw new Error('legacy line range moved; update tools/verify-lib.mjs');

// Pull a legacy function out of the source by name (brace counting from its `function name(` line).
function extract(name) {
  const i = lines.findIndex((l) => l.startsWith('function ' + name + '('));
  if (i < 0) throw new Error('legacy function not found: ' + name);
  let depth = 0, started = false, out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const ch of lines[j]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
    if (started && depth === 0) break;
  }
  return out.join('\n');
}
const NAMES = ['dk', 'per', 'tm', 'money', 'countSince', 'monthCount', 'startOfDay', 'limFor', 'limitOn', 'setLimit', 'lim', 'dur', 'lastTs',
  'streak', 'bestStreak', 'planE', 'planSched', 'hl', 'durS', 'dayAdd', 'cntBetween', 'gapBase', 'calcSaved'];
const extra = NAMES.map(extract).join('\n') + '\nvar savedAmt=0;\nfunction gapLeft(){var l=gapBase();return(S.gap>0&&l)?l+S.gap*6e4-Date.now():0;}';
if (!lines.some((l) => l.startsWith('function gapLeft(){var l=gapBase();return(S.gap>0&&l)?l+S.gap*6e4-Date.now():0;}'))) throw new Error('legacy gapLeft changed');

const RealDate = Date;
const clock = { now: 0 };
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(clock.now); }
  static now() { return clock.now; }
}
const fns = 'dk,per,tm,money,countSince,monthCount,startOfDay,limFor,limitOn,setLimit,lim,dur,lastTs,streak,bestStreak,planE,planSched,hl,durS,dayAdd,cntBetween,gapBase,calcSaved,gapLeft'.split(',');
function legacy(storage) {
  return new Function('localStorage', 'Date', chunk + '\n' + extra + '\nreturn {S:function(){return S;},savedAmt:function(){return savedAmt;},' + fns.map((f) => f + ':' + f).join(',') + '};')(storage, FakeDate);
}
function fakeStorage(raw) {
  const data = new Map(); if (raw !== undefined) data.set(STORAGE_KEY, raw);
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, v); } };
}

let seed = 987654; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];

let fail = 0, checks = 0;
const check = (name, a, b) => { checks++; if (!isDeepStrictEqual(a, b)) { fail++; if (fail <= 10) console.log('MISMATCH', name, '\n  legacy:', JSON.stringify(a)?.slice(0, 300), '\n  new:   ', JSON.stringify(b)?.slice(0, 300)); } };

// Clock values: random moments in 2025-2027 plus moments hugging midnight and DST changes in common zones.
const specials = ['2025-03-09T06:59:59Z', '2025-03-09T07:00:01Z', '2025-03-30T00:59:59Z', '2025-03-30T01:00:01Z', '2025-10-26T00:59:59Z', '2025-10-26T01:00:01Z',
  '2025-11-02T05:59:59Z', '2025-11-02T06:00:01Z', '2026-03-08T06:59:59Z', '2026-03-29T01:00:01Z', '2026-10-25T01:00:01Z', '2026-11-01T06:00:01Z', '2026-04-04T14:30:00Z', '2026-10-03T15:30:00Z'].map((x) => +new RealDate(x));
const randNow = () => (rnd() < 0.3 ? pick(specials) + ri(-3, 3) * 3600e3 * (rnd() < 0.5 ? 0 : 1) : +new RealDate('2025-01-01') + Math.floor(rnd() * 3 * 365 * 864e5));

function scenario() {
  const now = randNow();
  const span = pick([3, 10, 40, 120, 400]);
  const o = {};
  const n = pick([0, 0, 1, 5, 30, 150, 600]);
  o.log = Array.from({ length: n }, () => now - Math.floor(rnd() * span * 864e5) + (rnd() < 0.05 ? ri(1, 5) * 864e5 : 0)); // a few "future" entries too
  o.limit = ri(0, 15); o.pack = pick([0, 150, 12, 200]); o.per = pick([0, 20, 10]); o.base = ri(0, 30); o.cur = pick(['₱', '$']);
  o.gap = pick([0, 0, 30, 60, 90]); o.gapFrom = pick([0, 0, now - ri(0, 5) * 36e5, now + 36e5]);
  if (rnd() < 0.5) { const k = ri(0, 4); o.limH = Array.from({ length: k }, () => [startOfDay(now - Math.floor(rnd() * span * 864e5)), ri(0, 20)]).sort((a, b) => a[0] - b[0]); }
  if (rnd() < 0.6) {
    const start = startOfDay(now - Math.floor(rnd() * span * 864e5));
    o.plan = { on: rnd() < 0.8, from: ri(0, 25), to: ri(0, 6), by: pick([0, 1, 2, 3]), every: pick([0, 1, 2, 7]), start: rnd() < 0.9 ? start : 0,
      holds: Array.from({ length: ri(0, 3) }, () => [startOfDay(start + ri(0, 40) * 864e5), ri(0, 9)]), ...(rnd() < 0.3 ? { quit: startOfDay(now + ri(-30, 20) * 864e5) } : {}) };
  }
  return { now, raw: JSON.stringify(o) };
}

for (let i = 0; i < 700; i++) {
  const { now, raw } = scenario();
  clock.now = now;
  const L = legacy(fakeStorage(raw));
  const S = L.S();
  const mine = loadState(fakeStorage(raw));
  check('loaded state', S, mine);
  const idx = createLogIndex(mine.log);
  const days = [startOfDay(now), dayAdd(now, -1), dayAdd(now, -7), dayAdd(now, -45), dayAdd(now, 3), mine.plan.start, mine.plan.quit || 0, 0, ...Array.from({ length: 8 }, () => startOfDay(now - Math.floor(rnd() * 200 * 864e5)))];
  for (const d of days) {
    check('limFor ' + d, L.limFor(d), limFor(mine, d));
    check('limitOn ' + d, L.limitOn(d), limitOn(mine, d));
    check('planE ' + d, L.planE(d), planE(mine.plan, d));
    check('startOfDay ' + d, L.startOfDay(d), startOfDay(d));
    check('dk ' + d, L.dk(d), dayKey(d));
    for (const k of [-2, 0, 1, 30]) check('dayAdd', L.dayAdd(d, k), dayAdd(d, k));
  }
  check('lim', L.lim(), lim(mine, now));
  check('planSched', L.planSched(), planSched(mine));
  check('streak', L.streak(), streak(mine, idx, now));
  check('bestStreak', L.bestStreak(), bestStreak(mine, idx, now));
  for (const d of [1, 2, 7, 30, 90]) check('countSince ' + d, L.countSince(d), countSince(idx, d, now));
  check('monthCount', L.monthCount(), monthCount(idx, now));
  check('cntBetween', L.cntBetween(dayAdd(now, -10), dayAdd(now, -2)), cntBetween(idx, dayAdd(now, -10), dayAdd(now, -2)));
  check('per', L.per(), per(mine));
  L.calcSaved(); check('calcSaved', L.savedAmt(), calcSaved(mine, idx, now));
  check('lastTs', L.lastTs(), idx.last());
  check('gapBase', L.gapBase(), gapBase(mine, idx));
  check('gapLeft', L.gapLeft(), gapLeft(mine, idx, now));
  check('money', L.money(12.345), money(mine.cur, 12.345));
  check('tm', L.tm(now), tm(now));
  // setLimit: both sides mutate their own copy
  for (const v of [S.limit, S.limit + 1, 0, 7, 7]) {
    L.setLimit(v); setLimit(mine, v, now);
    check('setLimit limit ' + v, L.S().limit, mine.limit);
    check('setLimit limH ' + v, L.S().limH, mine.limH);
  }
}

// pure formatters on a spread of inputs
const msVals = [-5000, 0, 999, 59999, 60000, 61000, 3599999, 3600000, 5e6, 86399999, 86400000, 90061000, 2e8, 9e9, NaN];
const L0 = legacy(fakeStorage());
for (const ms of msVals) { check('dur ' + ms, L0.dur(ms), dur(ms)); check('durS ' + ms, L0.durS(ms), durS(ms)); }
for (const h of [0, 1, 11, 12, 13, 23, 24, 25, 47, 7.5]) check('hl ' + h, L0.hl(h), hl(h));

// empty-state checks
clock.now = +new RealDate('2026-11-18T10:00:00Z');
const E = legacy(fakeStorage()); const me = defaultState(); const ei = createLogIndex(me.log);
check('empty streak', E.streak(), streak(me, ei, clock.now)); check('empty best', E.bestStreak(), bestStreak(me, ei, clock.now));
check('empty first', Infinity, ei.first()); check('empty last', 0, ei.last());

console.log(`${checks} checks, ${fail} mismatches (TZ=${process.env.TZ || 'system'})`);
process.exit(fail ? 1 : 0);
