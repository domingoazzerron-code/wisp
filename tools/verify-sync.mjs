// Verifies src/sync against the legacy sync code in legacy/index.html.
//  1. merge parity   : legacy uni()/merge() vs mergeStates()
//  2. reconcile parity: legacy reconcile() (run twice, as its page reload would) vs the new engine
//  3. behaviour tests : push, retry, offline, debounce, status text
// Run: node tools/verify-sync.mjs   (Node 22.18+ runs the .ts files directly)
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createSyncEngine, hm } from '../src/sync/engine.ts';
import { mergeStates } from '../src/sync/merge.ts';
import { META_MOD, META_SYN } from '../src/sync/config.ts';
import { sanitize, stateFromObject, STORAGE_KEY } from '../src/state/storage.ts';
import { defaultState } from '../src/state/defaults.ts';

const lines = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8').split('\n');
const from = lines.findIndex((l) => l.startsWith('function uni('));
const to = lines.findIndex((l, i) => i > from && l.startsWith('function msg('));
if (from < 0 || to < 0) throw new Error('legacy sync code moved; update tools/verify-sync.mjs');
const legacyChunk = lines.slice(from, to).join('\n');          // uni, merge, reconcile
const stateChunk = lines.slice(1024, 1054).join('\n');         // legacy state load (for comparing results)

let seed = 987654; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ts = () => 1.7e12 + Math.floor(rnd() * 3e10);
let checks = 0, fail = 0;
const check = (name, a, b) => { checks++; if (!isDeepStrictEqual(a, b)) { fail++; if (fail <= 8) console.log('MISMATCH', name, '\n  legacy:', JSON.stringify(a)?.slice(0, 400), '\n  new:   ', JSON.stringify(b)?.slice(0, 400)); } };

// random but well-formed states (sanitized), some with keys removed
function randState() {
  const s = defaultState();
  s.log = Array.from({ length: Math.floor(rnd() * 25) }, ts);
  s.cravs = Array.from({ length: Math.floor(rnd() * 8) }, ts);
  s.heals = Array.from({ length: Math.floor(rnd() * 4) }, ts);
  s.mlog = Array.from({ length: Math.floor(rnd() * 12) }, ts);
  for (const k of ['tags', 'notes', 'crt']) for (const t of s.log.slice(0, 4)) if (rnd() < 0.6) s[k][t] = pick(['a', 'b', 'c']);
  s.mile = { m1: ts(), m2: ts() }; s.badges = rnd() < 0.5 ? { b1: ts() } : {}; s.diary = rnd() < 0.5 ? { [ts()]: 'x' } : {};
  s.waited = pick([0, 5, 20, 100]); s.limit = pick([5, 8, 10]); s.theme = pick(['auto', 'dark', 'glass']); s.name = pick(['', 'Ana', 'Bo']);
  s.setup = pick([0, 1]);
  if (rnd() < 0.3) s.log = s.log.concat(s.log.slice(0, 3)); // duplicates
  return sanitize(s);
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- 1. merge parity ----------
const legacyMerge = new Function(legacyChunk + '\nreturn {uni:uni,merge:merge};')();
for (let i = 0; i < 500; i++) {
  const a = clone(randState()), b = clone(randState());
  if (rnd() < 0.3) for (const k of ['tags', 'notes', 'mile', 'diary', 'badges', 'crt', 'cravs', 'heals', 'mlog', 'waited']) if (rnd() < 0.3) delete b[k];
  for (const newer of [true, false]) check('merge', legacyMerge.merge(clone(a), clone(b), newer), mergeStates(clone(a), clone(b), newer));
}

// ---------- 2. reconcile parity ----------
const FIXED_NOW = 1.75e12;
const realNow = Date.now; Date.now = () => FIXED_NOW;

function fakeStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); } };
}
function legacyLoad(raw) { // legacy state load + fix on a raw string
  const st = fakeStore(raw === null ? {} : { [STORAGE_KEY]: raw });
  return new Function('localStorage', stateChunk + '\nreturn S;')(st);
}

async function legacyRun({ localRaw, mod, syn, row }) {
  const ls = fakeStore(); if (localRaw !== null) ls.m.set(STORAGE_KEY, localRaw);
  if (mod !== null) ls.m.set(META_MOD, String(mod)); if (syn !== null) ls.m.set(META_SYN, String(syn));
  const ss = fakeStore(); let reloads = 0, pushes = 0;
  const sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }) };
  const push = () => { pushes++; ls.m.set(META_SYN, String(FIXED_NOW)); return Promise.resolve(); };
  const location = { reload() { reloads++; } };
  const _set = function (k, v) { this.setItem(k, v); };
  const make = () => new Function('sb', 'user', 'localStorage', 'sessionStorage', 'location', '_set', 'push', 'K', 'MOD', 'SYN', 'PULL',
    legacyChunk + '\nreturn reconcile;')(sb, { id: 'u1' }, ls, ss, location, _set, push, STORAGE_KEY, META_MOD, META_SYN, 'cigtracker.pulled');
  await make()();
  if (reloads) await make()();            // the page reload re-runs reconcile on the new data
  return { state: legacyLoad(ls.m.get(STORAGE_KEY) ?? null), mod: ls.m.get(META_MOD) ?? null, syn: ls.m.get(META_SYN) ?? null, pushes };
}

async function newRun({ localRaw, mod, syn, row }) {
  const meta = fakeStore(); if (mod !== null) meta.m.set(META_MOD, String(mod)); if (syn !== null) meta.m.set(META_SYN, String(syn));
  let local = stateFromObject(localRaw === null ? null : JSON.parse(localRaw)); let pushes = 0;
  const backend = { fetchRow: async () => ({ row }), upsertRow: async () => { pushes++; return {}; } };
  const engine = createSyncEngine({ backend, meta, getLocal: () => local, applyRemote: (s) => { local = s; }, parseState: stateFromObject, now: () => FIXED_NOW, isOnline: () => true });
  engine.setUser({ id: 'u1', email: 'e' });
  await engine.reconcile();
  return { state: local, mod: meta.m.get(META_MOD) ?? null, syn: meta.m.get(META_SYN) ?? null, pushes };
}

for (let i = 0; i < 700; i++) {
  const cm = ts();
  const lstate = pick([null, defaultState(), randState(), randState(), Object.assign(defaultState(), { setup: 1 })]);
  const localRaw = lstate === null ? null : JSON.stringify(sanitize(clone(lstate)));
  const cloudState = randState(); if (rnd() < 0.5) cloudState.setup = 1;
  const row = pick([null, null, { data: null, updated_at: new Date(cm).toISOString() }, { data: clone(cloudState), updated_at: new Date(cm).toISOString() }, { data: clone(cloudState), updated_at: new Date(cm).toISOString() }, { data: clone(cloudState), updated_at: new Date(cm).toISOString() }]);
  const mod = pick([null, cm + 5000, cm - 5000, cm, FIXED_NOW]);
  const syn = pick([null, cm, cm - 7000, cm + 9000, 0]);
  const sc = { localRaw, mod, syn, row };
  const L = await legacyRun(sc), N = await newRun(sc);
  check('reconcile state', L.state, N.state); check('reconcile MOD', L.mod, N.mod); check('reconcile SYN', L.syn, N.syn); check('reconcile pushes', L.pushes, N.pushes);
}
Date.now = realNow;

// ---------- 3. behaviour ----------
function rig(opts = {}) {
  const meta = fakeStore(); let local = stateFromObject({ setup: 1, log: [1.7e12] }); const calls = []; let mode = 'ok';
  const backend = {
    fetchRow: async () => ({ row: null }),
    upsertRow: async (id, data, at) => { calls.push({ id, data, at }); if (mode === 'error') return { error: 'boom' }; if (mode === 'throw') throw new Error('net'); return {}; },
  };
  const engine = createSyncEngine({ backend, meta, getLocal: () => local, applyRemote: (s) => { local = s; }, parseState: stateFromObject, debounceMs: 20, now: () => 1.75e12, isOnline: opts.online ?? (() => true) });
  return { engine, meta, calls, setMode: (m) => { mode = m; } };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

{ // success
  const r = rig(); r.engine.setUser({ id: 'u1', email: '' }); await r.engine.push();
  check('push uploads once', r.calls.length, 1); check('push user id', r.calls[0].id, 'u1'); check('push data is the local state', r.calls[0].data.log, [1.7e12]);
  check('push sets SYN', r.meta.getItem(META_SYN), String(Date.parse(new Date(1.75e12).toISOString())));
  check('push status', /^Synced at \d{1,2}:\d{2} (AM|PM)$/.test(r.engine.getStatus()), true); check('not dirty', r.engine.isDirty(), false);
}
{ // server error then retry via online event
  const r = rig(); r.engine.setUser({ id: 'u1', email: '' }); r.setMode('error'); const warn = console.warn; console.warn = () => {};
  await r.engine.push(); console.warn = warn;
  check('error status', r.engine.getStatus(), 'Sync failed, will retry'); check('error dirty', r.engine.isDirty(), true); check('error leaves SYN', r.meta.getItem(META_SYN), null);
  r.setMode('ok'); r.engine.onOnline(); await wait(15);
  check('retry on online', r.calls.length, 2); check('retry clears dirty', r.engine.isDirty(), false);
}
{ // network throw
  const r = rig(); r.engine.setUser({ id: 'u1', email: '' }); r.setMode('throw'); await r.engine.push();
  check('throw status', r.engine.getStatus(), 'Offline, will sync when back online'); check('throw dirty', r.engine.isDirty(), true);
}
{ // offline: no upload attempted
  const r = rig({ online: () => false }); r.engine.setUser({ id: 'u1', email: '' }); await r.engine.push();
  check('offline no upload', r.calls.length, 0); check('offline status', r.engine.getStatus(), 'Offline, will sync when back online'); r.engine.onOffline(); check('offline event status', r.engine.getStatus(), 'Offline');
}
{ // debounce: three saves, one upload
  const r = rig(); r.engine.setUser({ id: 'u1', email: '' }); r.engine.onLocalSave(); r.engine.onLocalSave(); r.engine.onLocalSave();
  check('MOD stamped on save', r.meta.getItem(META_MOD), String(1.75e12)); check('dirty after save', r.engine.isDirty(), true); check('nothing sent yet', r.calls.length, 0);
  await wait(60); check('one upload after debounce', r.calls.length, 1);
}
{ // flush on page hide uploads immediately
  const r = rig(); r.engine.setUser({ id: 'u1', email: '' }); r.engine.onLocalSave(); r.engine.flush(); await wait(5);
  check('flush uploads now', r.calls.length, 1); await wait(40); check('flush cancels the timer', r.calls.length, 1);
}
{ // signed out: stamps MOD but never uploads
  const r = rig(); r.engine.onLocalSave(); await wait(50);
  check('signed-out still stamps MOD', r.meta.getItem(META_MOD), String(1.75e12)); check('signed-out no upload', r.calls.length, 0); await r.engine.push(); check('signed-out push no-op', r.calls.length, 0);
}
{ // enter() with nothing to do reports Synced
  const r = rig(); await r.engine.enter({ id: 'u1', email: 'a@b.c' }); check('enter pushes local-only data', r.calls.length, 1);
  const r2 = rig(); r2.engine.setUser(null); check('no status before sign-in', r2.engine.getStatus(), '');
}
check('hm 3:07 PM', hm(new Date(2026, 0, 1, 15, 7)), '3:07 PM'); check('hm 12:00 AM', hm(new Date(2026, 0, 1, 0, 0)), '12:00 AM'); check('hm 12:30 PM', hm(new Date(2026, 0, 1, 12, 30)), '12:30 PM');

console.log(`${checks} checks, ${fail} mismatches`);
process.exit(fail ? 1 : 0);
