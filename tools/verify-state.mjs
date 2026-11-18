// Parity check: the new src/state code must behave exactly like the legacy code in
// legacy/index.html (def/load/fix/save/srt/dcounts/lb/minTs and restoreFrom).
// Run: node tools/verify-state.mjs   (Node 22.18+ runs the .ts files directly)
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { loadState, saveState, stateFromBackup, STORAGE_KEY } from '../src/state/storage.ts';
import { defaultState } from '../src/state/defaults.ts';
import { getState, replaceState, save, sortedLog, dayCounts, lowerBound, firstTs, subscribe } from '../src/state/store.ts';

const lines = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8').split('\n');
const chunk = lines.slice(1024, 1054).join('\n'); // legacy lines 1025-1054: K, def ... save()
if (!chunk.startsWith("var K='cigtracker.v1'") || !chunk.includes('function save()')) throw new Error('legacy line range moved; update tools/verify-state.mjs');

function legacy(storage) {
  return new Function('localStorage', chunk + '\nreturn {def:def,fix:fix,S:function(){return S;},setS:function(v){S=v;},save:save,srt:srt,dcounts:dcounts,lb:lb,minTs:minTs};')(storage);
}
function fakeStorage(raw) {
  const data = new Map(); if (raw !== undefined) data.set(STORAGE_KEY, raw);
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => { data.set(k, v); } };
}

// seeded PRNG so failures are reproducible
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const junk = () => pick([null, undefined, 'x', '', 0, -5, 3.7, NaN, Infinity, 1e15, true, [], [1, 2], {}, { a: 1 }, [[1, 2], [3, -1], 'z', [5, 'q']], [3, 1e9, -2, 'a', 1.5]]);
const goodTs = () => 1.7e12 + Math.floor(rnd() * 3e10);

function fuzzObject() {
  const base = defaultState(); const o = {};
  for (const k of Object.keys(base)) {
    const r = rnd();
    if (r < 0.35) continue;                       // missing key
    if (r < 0.6) o[k] = junk();                   // wrong type
    else o[k] = JSON.parse(JSON.stringify(base[k]));
  }
  if (rnd() < 0.8) o.log = Array.from({ length: Math.floor(rnd() * 60) }, () => (rnd() < 0.1 ? junk() : goodTs()));
  if (rnd() < 0.4) o.mlog = Array.from({ length: Math.floor(rnd() * 600) }, () => (rnd() < 0.1 ? junk() : goodTs()));
  if (rnd() < 0.5) o.plan = { on: pick([true, 1, 'y']), from: pick([10, '3', NaN]), to: 0, by: 1, every: 7, start: goodTs(), holds: pick([[], [[goodTs(), 3], [goodTs(), -1], ['a', 2]], 'no', null]), quit: pick([undefined, goodTs(), 'q']) };
  if (rnd() < 0.5) o.limH = [[goodTs(), 8], [goodTs(), 5], [1, -1], 'bad'];
  if (rnd() < 0.4) o.owned = ['none', 'crown', 'bogus', 'cape', 7];
  if (rnd() < 0.3) { o.cur = '$'; o.pack = 12; if (rnd() < 0.5) delete o.conf; }
  if (rnd() < 0.3) { o.hap = 0; o.fx = 0; }
  if (rnd() < 0.3) o.theme = pick(['dark', 'glass', 'light', 'auto', 'neon']);
  if (rnd() < 0.3) o.outfit = pick(['crown', 'tophat', 'nope']);
  if (rnd() < 0.2) o.unknownKey = 123;
  return o;
}

let fail = 0, checks = 0;
const check = (name, a, b) => { checks++; if (!isDeepStrictEqual(a, b)) { fail++; if (fail <= 8) console.log('MISMATCH', name, '\n  legacy:', JSON.stringify(a)?.slice(0, 300), '\n  new:   ', JSON.stringify(b)?.slice(0, 300)); } };

const cases = [undefined, '', 'not json', 'null', '123', '[]', '{}', JSON.stringify({ log: [1.7e12, 1.71e12], setup: 0 }), JSON.stringify({ setup: 1 }), JSON.stringify({ cur: '$', pack: 12 })];
for (let i = 0; i < 600; i++) cases.push(JSON.stringify(fuzzObject()));

for (const raw of cases) {
  const ls = fakeStorage(raw), L = legacy(ls);
  const mine = loadState(fakeStorage(raw));
  const S = L.S();
  check('loaded state', S, mine);
  // derived helpers on the loaded state
  replaceState(mine);
  check('srt', L.srt(), sortedLog());
  check('dcounts', L.dcounts(), dayCounts());
  check('minTs', L.minTs(), firstTs());
  for (const t of [0, 1.7e12, 1.705e12, 1.72e12, 9e12]) check('lb ' + t, L.lb(t), lowerBound(t));
  // saving writes identical JSON
  L.save(); const outLegacy = ls.data.get(STORAGE_KEY);
  const ms = fakeStorage(); saveState(mine, ms);
  check('saved json', outLegacy, ms.data.get(STORAGE_KEY));
}

// restore-from-backup parity (legacy restoreFrom: defaults merge + fix, null when invalid)
const L0 = legacy(fakeStorage());
for (let i = 0; i < 300; i++) {
  const text = i % 10 === 0 ? pick(['x', 'null', '{}', '{"log":5}', '[]']) : JSON.stringify(fuzzObject());
  let expected = null;
  try { const p = JSON.parse(text); if (!p || !Array.isArray(p.log)) throw 0; const d = L0.def(); for (const k in d) if (p[k] !== undefined) d[k] = p[k]; expected = L0.fix(d); } catch { expected = null; }
  check('backup', expected, stateFromBackup(text));
}

// store behaviour: caches reset on save(), subscribers fire, replaceState swaps state
const s1 = loadState(fakeStorage(JSON.stringify({ log: [30, 10, 20].map((x) => 1.7e12 + x) })));
replaceState(s1); const before = sortedLog().length;
getState().log.push(1.7e12 + 5); let fired = 0; const off = subscribe(() => { fired++; });
check('cache stale before save', sortedLog().length, before);
save(); check('cache fresh after save', sortedLog().length, before + 1); check('subscriber fired', fired, 1);
off(); save(); check('unsubscribe', fired, 1);

console.log(`${checks} checks, ${fail} mismatches`);
process.exit(fail ? 1 : 0);
