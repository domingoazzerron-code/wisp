// Parity check: src/lib/gaps.ts must behave exactly like the legacy gapData, the celebration in doLog and
// the "passed yesterday's best gap" check in renderSpacing (legacy/index.html).
// Run: node tools/verify-gaps.mjs   (Node 22.18+). Try several zones, e.g. TZ=Asia/Manila / America/New_York.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createLogIndex } from '../src/lib/logindex.ts';
import { gapData, logCelebration, checkGapRecord } from '../src/lib/gaps.ts';
import { startOfDay, dayAdd } from '../src/lib/dates.ts';

const lines = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8').split('\n');
const chunk = lines.slice(1024, 1054).join('\n'); // K, def ... save()
if (!chunk.startsWith("var K='cigtracker.v1'") || !chunk.includes('function save()')) throw new Error('legacy line range moved; update tools/verify-gaps.mjs');

function extract(name) {
  const i = lines.findIndex((l) => l.startsWith('function ' + name + '('));
  if (i < 0) throw new Error('legacy function not found: ' + name);
  let depth = 0, started = false; const out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const ch of lines[j]) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
    if (started && depth === 0) break;
  }
  return out.join('\n');
}
// The two celebration lines are taken verbatim from the legacy source and wrapped in a function.
const celLineDo = lines.find((l) => l.startsWith('  if(pv&&startOfDay(pv)===startOfDay(nw)){var gg=nw-pv;'));
const celLineSp = lines.find((l) => l.startsWith('  if(g.cur>=18e5&&g.yest>0&&g.cur>g.yest&&S.celDay!==td){'));
if (!celLineDo || !celLineSp) throw new Error('legacy celebration lines moved; update tools/verify-gaps.mjs');

const src = ['srt', 'startOfDay', 'dayAdd', 'dur', 'lastTs', 'gapData'].map(extract).join('\n') + `
function legacyLog(){var nw=Date.now(),gd=gapData(),pv=lastTs();
${celLineDo}
return S.cel;}
function legacySpacing(){var g=gapData(),td=startOfDay(Date.now()),calls=0;function render(){calls++;}function setTimeout(f){f();}
${celLineSp}
return {cel:S.cel,celDay:S.celDay,calls:calls};}
`;

const RealDate = Date;
const clock = { now: 0 };
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(clock.now); }
  static now() { return clock.now; }
}
function legacy(log, celDay) {
  const store = { setItem() {}, getItem() { return null; } };
  return new Function('localStorage', 'Date', chunk + '\n' + src + '\nS.log=' + JSON.stringify(log) + ';S.celDay=' + celDay + ';S.cel=null;C=null;\nreturn {gapData:gapData,legacyLog:legacyLog,legacySpacing:legacySpacing,S:function(){return S;}};')(store, FakeDate);
}

let seed = 424242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
let fail = 0, checks = 0, fired = 0;
const check = (name, a, b) => { checks++; if (!isDeepStrictEqual(a, b)) { fail++; if (fail <= 10) console.log('MISMATCH', name, '\n  legacy:', JSON.stringify(a)?.slice(0, 300), '\n  new:   ', JSON.stringify(b)?.slice(0, 300)); } };

const specials = ['2025-03-09T06:59:59Z', '2025-03-30T01:00:01Z', '2025-10-26T01:00:01Z', '2025-11-02T06:00:01Z', '2026-03-08T07:00:01Z', '2026-10-25T01:00:01Z', '2026-11-01T06:00:01Z', '2026-11-17T15:59:59Z', '2026-11-17T16:00:01Z'].map((x) => +new RealDate(x));
const randNow = () => (rnd() < 0.3 ? pick(specials) + ri(-3, 3) * 36e5 * (rnd() < 0.5 ? 0 : 1) : +new RealDate('2025-01-01') + Math.floor(rnd() * 3 * 365 * 864e5));

for (let i = 0; i < 1500; i++) {
  const now = randNow();
  const td = startOfDay(now);
  const span = pick([1, 2, 3, 10, 40]);
  const n = pick([0, 0, 1, 2, 3, 6, 15, 60, 200]);
  const log = Array.from({ length: n }, () => {
    const day = dayAdd(td, -ri(0, span));
    // cluster entries inside a day so same-day gaps exist, with occasional random times and future entries
    return day + ri(6, 23) * 36e5 + ri(0, 59) * 6e4 + (rnd() < 0.05 ? ri(1, 3) * 864e5 : 0);
  });
  if (rnd() < 0.4 && n) log.push(now - ri(0, 400) * 6e4); // a recent entry, for the running gap
  const celDay = pick([0, td, dayAdd(td, -1)]);
  clock.now = now;
  const idx = createLogIndex(log);
  const L = legacy(log, celDay);

  // gapData
  const g0 = L.gapData(), g1 = gapData(idx, now);
  check('gapData', JSON.parse(JSON.stringify(g0)), JSON.parse(JSON.stringify(g1)));

  // celebration in doLog: random "log now" moments around the current time
  for (const at of [now, now + ri(1, 600) * 6e4, now + ri(1, 8) * 36e5]) {
    clock.now = at;
    const Lc = legacy(log, celDay);
    const gd = gapData(idx, at);
    const prev = idx.last();
    const mine = logCelebration(gd, prev, at);
    check('doLog cel @' + at, Lc.legacyLog(), mine);
  }
  clock.now = now;

  // renderSpacing check, at the same moment and later ones (time passing without a log)
  for (const at of [now, now + ri(1, 120) * 6e4, now + ri(1, 12) * 36e5]) {
    clock.now = at;
    const Ls = legacy(log, celDay);
    const r = Ls.legacySpacing();
    const mine = checkGapRecord(gapData(idx, at), celDay, at);
    check('renderSpacing cel @' + at, r.cel, mine ? mine.cel : null);
    check('renderSpacing celDay @' + at, r.celDay, mine ? mine.celDay : celDay);
    check('renderSpacing fired @' + at, r.calls, mine ? 1 : 0);
  }
}

// Boundary cases built on purpose: gaps that tie with today's best / yesterday's best / the 30 minute minimum, +-1 ms.
for (let i = 0; i < 1500; i++) {
  const base = randNow();
  const td = startOfDay(base);
  const MIN = 6e4;
  const yG = pick([0, 20, 29, 30, 31, 45, 60, 90, 180]) * MIN;   // yesterday's best gap (0 = no gap yesterday)
  const dG = pick([0, 30, 45, 60, 90]) * MIN;                      // best finished gap today so far
  const log = [];
  if (yG) log.push(dayAdd(td, -1) + 9 * 36e5, dayAdd(td, -1) + 9 * 36e5 + yG);
  if (rnd() < 0.3) log.push(dayAdd(td, -2) + 8 * 36e5, dayAdd(td, -2) + 8 * 36e5 + pick([30, 120, 400]) * MIN); // an older record
  const t0 = td + 6 * 36e5;
  const prev = dG ? t0 + dG : t0;
  if (dG) log.push(t0, prev); else if (rnd() < 0.8) log.push(prev);
  if (rnd() < 0.1) log.length = 0;
  const celDay = pick([0, td, dayAdd(td, -1)]);
  const gaps = [29 * MIN, 30 * MIN - 1, 30 * MIN, 30 * MIN + 1, yG, yG - 1, yG + 1, dG, dG - 1, dG + 1, 3 * 36e5, 10 * 36e5].filter((g) => g > 0);
  const idx = createLogIndex(log);
  for (const g of gaps) {
    const at = (idx.last() || prev) + g;
    clock.now = at;
    const L = legacy(log, celDay);
    check('edge gapData', JSON.parse(JSON.stringify(L.gapData())), JSON.parse(JSON.stringify(gapData(idx, at))));
    check('edge doLog', legacy(log, celDay).legacyLog(), logCelebration(gapData(idx, at), idx.last(), at));
    const r = legacy(log, celDay).legacySpacing();
    const mine = checkGapRecord(gapData(idx, at), celDay, at);
    check('edge spacing cel', r.cel, mine ? mine.cel : null);
    check('edge spacing celDay', r.celDay, mine ? mine.celDay : celDay);
    if (mine) fired++;
  }
}
console.log('edge celebrations that fired in checkGapRecord:', fired);

console.log(`${checks} checks, ${fail} mismatches (TZ=${process.env.TZ || 'system'})`);
process.exit(fail ? 1 : 0);
