# HANDOFF: Wisp Tracker framework migration

Read this whole file first, then continue from "Next step". Update this file at the end of every step.

## What this project is
A personal mobile cigarette/quit tracker PWA (mascot: Wisp, a slim floating ghost). Hosted on Vercel, data synced with Supabase, personal use only.
The original app is a single 1,850-line `legacy/index.html` (CSS in `<style>` blocks, 3 big inline scripts, global state object `S`, storage key `cigtracker.v1`, hash routes: today, history, setup, plan, insights, summary, tips).

## Decisions (do not re-debate)
- Stack: Vite + TypeScript + Preact. Vercel deploys it with no extra config.
- Personal use only: no need to preserve the old localStorage format or write migrations. Redesign state cleanly.
- Animations: CSS keyframes/transitions driven by data attributes (e.g. `data-level` for Wisp). `motion` library only if needed. Exiting elements (toasts, drawer) need a small helper.
- Keep the black-and-white theme. Planned Wisp redesign: small date + greeting on top, mascot at left of a banner with a speech bubble on the right (name + short line). Wisp goes cute to uncanny as the daily count rises (lights a cigarette after the 3rd logged). Build this in the Today view (step 6).
- User is on a free plan: work in small steps, update this file and re-zip after EVERY step.
- Views are rebuilt in Preact (step 7 done). Still fix the service worker (step 8) and first-run/account polish before treating production as fully migrated.

## Steps
- [x] 1. Scaffold Vite + TS + Preact, create HANDOFF.md
- [x] 2. Move CSS from legacy/index.html into src/styles/
- [x] 3. Move state and storage into src/state/
- [x] 4. Move Supabase sync into src/sync/ (supabase-js as npm package instead of CDN script; replace the Storage.prototype.setItem monkey-patch with a store subscription)
- [x] 5. Move plan/limit/streak math into src/lib/ with Vitest tests (limFor, planSched, streak, bestStreak, planE)
- [ ] 6. Rebuild Today view in Preact with the new Wisp layout. Too big for one chat, split into slices:
  - [x] 6a. Greeting, Wisp banner (levels + cigarette after the 3rd), hero card, + button, toasts, minimal nav and shell
  - [x] 6b. Craving timer and Wisp reactions. Was too big for one chat, so split into three small slices (do ONE per chat):
    - [x] 6b-1. Craving timer card: `crv`, `cravTip`/`CTIPS`, start/cancel (`#cgo`), "Log a craving I got through" (`#clg`), expiry (`creditCrave`, `askLate`), heals (`S.heals`, `S.healAt`), the "Wait it out" button in the pace line
    - [x] 6b-2. Wisp reactions: `buzz` (haptics), `whisper`, `ambient` (+ `hello`), poke/tap texts (`pokeLines`, `poke`), the `healed` class and the heal caption
    - [x] 6b-3. Celebration: `gapData` (with parity script), `S.cel` in `logCigarette`, the "passed yesterday's best gap" check (`S.celDay`, legacy `renderSpacing`), celebration caption
  - [x] 6c. Mission, challenge, evolution, milestones. Too big for one chat, split into four small slices (do ONE per chat):
    - [x] 6c-1. Mission card + stars: `checkMission`, `renderMission`, `MIS`, `S.mis`, stars; the two `// TODO(6c)` mission poke lines in `src/lib/reactions.ts`; `S.cel` + `pokeUntil=0` (use `pokeState`) + `buzz('heal')` + toast when a mission is done
    - [x] 6c-2. Challenge card: `checkChallenge`, `renderChal` (also writes `S.cel` + `pokeUntil=0`)
    - [x] 6c-3. Evolution: `evoInfo`, `checkEvo`, form names (Wisp name in `Wisp.tsx`), outfits/wardrobe
    - [x] 6c-4. Milestones: `checkMile`, `mileDefs`
  - [x] 6d. Rest of Today. Split into slices (do ONE per chat):
    - [x] 6d-1. Header: streak flame (`#fl` / `#flm`), page title (`#ttl`), craving pill (`#bcrv` / `#bct`), account + menu buttons; minimal menu drawer with route links (full account drawer stays step 7)
    - [x] 6d-2. More about today: spacing challenge (`renderSpacing` / gapData already in lib), spent today
    - [x] 6d-3. Restart card, backup reminder, weekly nudge
    - [x] 6d-4. Overlays: alert/confirm box, `askEarly` gap check on +, `slipPrompt`; replace SWAP(6d) toasts
    - [x] 6d-5. Nav extras: sliding `.dot` indicator, long-press quick menu (`#qm`)
- [x] 7. Rebuild remaining views, one per chat:
  - [x] 7a. History: cigarettes + cravings lists, past-entry form, edit/delete/trigger
  - [x] 7b. Setup: limits, cost, backup/restore, custom triggers, erase
  - [x] 7c. Plan: progress, quit plan, milestones
  - [x] 7d. Insights: overview, patterns, money (no diary/recap/share yet)
  - [x] 7e. Summary: stats + share card
  - [x] 7f. Tips: static craving advice cards
- [x] 8. Service worker: generate-sw.mjs writes dist/sw.js with hashed assets + content VERSION; vite plugin runs it on build; main.tsx registers /sw.js

## Step log
### Step 1 (done)
- Created Vite + TS + Preact scaffold: package.json, vite.config.ts, tsconfig.json, index.html (head tags, manifest, fonts copied from legacy), src/main.tsx, src/app.tsx (placeholder), src/styles/base.css (placeholder).
- Moved icons, manifest.json, sw.js to public/. Kept vercel.json as is.
- Kept the original app untouched at legacy/index.html as the source to extract from.
- NOT VERIFIED: `npm install` and `npm run build` could not run in the chat sandbox (no network). Dependency versions are caret ranges. First thing to do on a machine/session with network: `npm install && npm run build` and fix any version or type errors.

### Step 2 (done)
- Extracted all 4 legacy `<style>` blocks (576 lines) into 21 files in `src/styles/`, split along the original section comments: tokens, header, buttons, cards, today, forms, history, insights, nav, drawer, themes, overlays, account, outfits, wisp, native, auth, polish, missions, share, lock.
- `src/styles/index.css` imports them in the ORIGINAL cascade order (do not reorder). `src/main.tsx` imports `./styles/index.css`. Deleted the placeholder base.css.
- Verified by script: concatenating the 21 files gives the 576 original lines, identical and in order; every file has balanced braces. No styles are injected from JS in legacy.
- Not moved (belongs to later steps): inline `style=` attributes in the markup, and the theme-init script at legacy line 19 (reads localStorage, sets `data-theme`). Step 3 handles that script.
- Still unverified: `npm install` / `npm run build` (no network in the chat sandbox). Same first-thing-to-do as step 1.

### Step 3 (done)
- Created `src/state/`: `types.ts` (State interface), `defaults.ts` (defaultState, OUTFITS and outfit tables), `storage.ts` (STORAGE_KEY, `sanitize`, `loadState`, `saveState`, `stateFromBackup`), `store.ts` (live state, `save`, `subscribe`, log helpers), `index.ts` (barrel export).
- Same storage key `cigtracker.v1`, so existing data still loads. Load order preserved exactly: merge into defaults, old-save compat tweaks, sanitize, then the `setup`/`fx` fixups.
- Store pattern: like the legacy app, code mutates `getState()` in place and calls `save()`. `save()` writes to localStorage, clears the derived caches and calls subscribers. Use `replaceState(next)` then `save()` for reset, restore backup and cloud pull.
- Added the theme-init script (legacy line 19) to `index.html` so `data-theme` is set before first paint.
- tsconfig: added `allowImportingTsExtensions` and `verbatimModuleSyntax`. In `src/state` relative imports end in `.ts` and type imports use `import type` (this lets Node run the files directly for tests).
- Verified: `node tools/verify-state.mjs` runs the legacy code and the new code side by side on 910 inputs (edge cases plus seeded fuzzing of malformed data), comparing loaded state, `srt`/`dcounts`/`lb`/`minTs` results, saved JSON, and backup parsing. Result: 6,404 checks, 0 mismatches. Also passes `tsc --strict` on `src/state` (run with `types: []`, since vite types are not installed in the sandbox).
- Still unverified: `npm install` / `npm run build`. Not yet verified at all: the full `npm run build` with `types: ["vite/client"]`.
- `diary` is typed loosely (`Record<string, unknown>`); tighten it when the diary view is rebuilt.

### Step 5 (done, math only: no UI touched)
- Created `src/lib/`, all pure (state, a log index and `now` are parameters; nothing reads `Date.now()` or the store except `current.ts`):
  - `dates.ts`: `DAY_MS`, `startOfDay`, `dayAdd`, `dayKey` (legacy `dk`).
  - `logindex.ts`: `createLogIndex(log)` returns `{ sorted, counts, lowerBound, first, last }` (lazy, cached; build a new one when the log changes). Pure twin of the `sortedLog`/`dayCounts`/`lowerBound`/`firstTs` helpers in `src/state/store.ts`, plus `last()` (legacy `lastTs`, 0 when empty).
  - `limits.ts`: `planE(plan, day)`, `limitOn(s, day)`, `limFor(s, day)`, `lim(s, now)`, `setLimit(s, v, now)` (the only mutating function, like legacy), `planSched(s)`.
  - `streaks.ts` (also holds counts, savings and gap timing): `per(s)`, `countSince(idx, days, now)`, `monthCount(idx, now)`, `cntBetween(idx, a, b)`, `streak(s, idx, now)`, `bestStreak(s, idx, now)`, `trackedDays(s, idx, now)` (new small helper: the day span `calcSaved` and `shStats` both use), `calcSaved(s, idx, now)` (now RETURNS the amount; legacy stored it in the global `savedAmt`), `gapBase(s, idx)`, `gapLeft(s, idx, now)`.
  - `format.ts`: `dur`, `durS`, `hl`, `tm`, `money(cur, n)` (takes the currency as a parameter instead of reading `S.cur`).
  - `current.ts`: convenience wrappers bound to the live store and the real clock (`lim()`, `streak()`, `bestStreak()`, `countSince(days)`, `monthCount()`, `calcSaved()`, `gapLeft()`, `lastTs()`, `planSched()`, `setLimit(v)`, `limitForDay(day)`, `today()`, and `liveIndex`, a `LogIndex` over the store's cached helpers). Views should import from here; tests use the pure functions.
  - `index.ts`: barrel for the pure modules (does NOT re-export `current.ts`, to keep the pure side free of store imports).
- Tests: `src/lib/lib.test.ts` (34 Vitest tests: day/DST helpers, log index, limit history, setLimit, hold days, plan stepping, quit day, plan schedule, streak edge cases incl. 365 cap, counts, savings, gap timing, formatters). Dates are built with local constructors, so they pass in any time zone. `npm test` runs `vitest run`. Added `vitest@^3` (3.x because Vite 6) to devDependencies and an `npm run verify` script that runs the three parity scripts.
- Parity: `node tools/verify-lib.mjs` extracts the legacy functions from `legacy/index.html` by name, runs them beside the new ones (with a fake clock injected into the legacy code's `Date`) on 700 random scenarios (logs with future entries, limit histories, plans with holds, quit days, gaps; random clocks plus moments around midnight and DST changes). 121,144 checks, 0 mismatches in UTC, America/New_York, Europe/London, Asia/Manila, Australia/Lord_Howe and Pacific/Auckland. Checked that it can fail: deliberately breaking `limFor`, `streak` and the 365 cap each produced mismatches. Steps 3 and 4 scripts still pass.
- Verified: `tsc --strict` passes on `src/lib` and `src/state` (with `types: []`).
- NOT verified: real Vitest. It could not be installed (no network), so `lib.test.ts` was only run through a tiny stand-in for `describe/it/expect` (34/34 pass in 5 time zones) and has not been type-checked against real vitest types. Also still unverified: `npm install` and the full `npm run build` (it type-checks the test file too, so it needs vitest installed). First thing to do on a machine with network: `npm install && npm test && npm run build`.
- Not ported (stays with the views that use it): `heat`, `renderPace`, `whisper`, `mileDefs`, `shStats` and similar render-time helpers. They can call `src/lib/current.ts`. `savedAmt` as a global is gone: call `calcSaved()` where it is needed.
- Known legacy quirks kept on purpose (parity): `streak` is capped at 365 days and `bestStreak` scans at most 1,500 days; `streak` counts today even when nothing is logged yet; `limFor` returns the quit-day limit of 0 for every day from the quit day onward.

### Step 6a (done): Today core
- Today now renders from Preact: `src/views/Today.tsx` = greeting (date + "Good morning, <b>name</b>!"), Wisp banner, hero card. `src/app.tsx` is a small shell: hash routes as in legacy (`today, history, setup, plan, insights, summary, tips`); only `today` is real, the rest show a "Not rebuilt yet" card. The bottom `Nav` has the real tabs and the + button.
- New files: `src/lib/today.ts` (pure text/level logic: `greetingPrefix`, `progressPct`, `heroStatus`, `wispLevel`, `WISP_CAPTIONS`, `CIG_LIT_AT`, `yesterdayCount`, `healsToday`, `wispSubline`, `lastLine`, `gapLine`, `paceProjection`), `src/state/entries.ts` (`addEntry`, `removeEntry`, `restoreEntry`, exported from `src/state`), `src/hooks/useStore.ts` (`useStore()` re-renders on `save()` and cloud pulls; `useTick(ms)` for live clocks), `src/components/{Toasts,Wisp,Hero,Nav,ghost}.ts(x)`, `src/actions/log.ts` (`logCigarette`, `undoLast`, `canUndoLast`), `src/lib/today.test.ts` (19 tests).
- Wisp: the banner layout (sprite left, speech bubble right) already existed in the extracted CSS (`today.css`), so it is reused as is. The sprite is `GHOST_SVG` in `components/ghost.ts`, extracted unchanged from legacy `GHOST` plus a new `<g class="cig">` (cigarette, ember, smoke). `#masc` gets `data-st` (0..6) and `--s` (both drive the existing CSS) and `data-cig="1"` once 3 or more are logged today; the cigarette CSS is at the end of `src/styles/wisp.css` (reduced-motion aware). The cigarette position on the mouth is a first guess: LOOK AT IT on a phone and adjust the coordinates in `ghost.ts` if it sits badly.
- Toasts: `toast(msg, actionLabel?, onAction?)` from `components/Toasts.tsx`, with the 220 ms "off" exit class (the exit helper the Decisions asked for). Reuse for every later view.
- Behaviour kept from legacy: level formula and captions, status line texts, progress bar, undo only for today's newest entry (with an Undo toast), "On pace" projection (7:00-23:00), gap countdown line, "limit lowered" subline (uses `startOfDay - 864e5` like legacy).
- NOT ported yet (listed in the slices above): see 6b, 6c, 6d. Also dropped on purpose for now: the "Wait it out" button in the pace line (needs the craving timer, 6b), the "gap isn't done" confirmation on +, the record-gap celebration, the limit-reached alert box (a toast stands in), the trigger prompt after a slip, haptics, the pop animation on the + button and the `fx()` effects. `Wisp` shows the plain name "Wisp" with no evolution form yet. Logging does NOT yet trigger the later `render` at +5 minutes (`setTimeout(render,300500)`): `useTick` re-renders every second, which covers it.
- Verified: `tsc --strict` on everything EXCEPT the Preact types: preact is not installed here, so the components were type-checked against small hand-written stubs of `preact`, `preact/hooks` and `preact/jsx-runtime` (no errors in the new code). Unit tests: 19 for `today.ts`, run through the same tiny vitest stand-in as before (pass in 3 time zones). Steps 3, 4 and 5 parity scripts still pass.
- NOT verified: the app has never been built or opened in a browser (no network: no `npm install`, no Vite, no real Preact, no real Vitest). The `today.ts` functions were written by reading legacy `render()`/`renderMascot()`/`renderPace()`, so there is no side-by-side parity script for them (the legacy code is inline in DOM functions); the tests encode the legacy behaviour. Test on a phone: layout of the banner, the cigarette, toasts above the nav bar, + button, Undo.

### Step 6b split (planning only, no code)
- 6b was too big for one free-plan chat (the user hit the limit before it finished). It is now 6b-1 (craving timer), 6b-2 (Wisp reactions: buzz, whisper, ambient, poke), 6b-3 (celebration: gapData, S.cel). Legacy locations found: `crv` 1354, `cravTip`/`CTIPS` 1355-1356, `#cgo` 1358, `creditCrave` 1352, `askLate` 1353, `whisper` 1341, `buzz` 1348, `renderMascot` 1351 (uses whisper/ambient/poke text and the `healed` class), `gapData` 1365, `S.cel` in `doLog` 1157, celebration check in `renderSpacing` ~1366, `ambient` 1631, `pokeLines` 1636, `poke` 1646.
- Dependencies to remember: `pokeLines` mentions the mission (`S.mis`, `MIS`), which is slice 6c: in 6b-2 skip those two lines and leave a TODO. `ambient` calls `hello()` (greeting text for the first 10 minutes of the day): port it with `ambient`. The craving pill in the header is 6d.

### Step 6b-1 (done): craving timer card
- New: `src/lib/craving.ts` (pure: `CRAVE_MS`, `CRAVE_LATE_MS`, `CTIPS`, `cravTipIndex`, `cravClock`, `checkCrave(craveEnd, now)` -> none/running/credit/late, `cravSubline`, `applyCredit(s, e0)`, `creditText`), `src/lib/craving.test.ts` (10 tests), `src/actions/craving.ts` (`startCrave`, `cancelCrave`, `toggleCrave`, `creditCrave`, `checkCraveExpiry`, `logCraving`), `src/hooks/useCraveWatch.ts`, `src/components/CravingCard.tsx`.
- Wiring: `Today.tsx` renders `<CravingCard now>` under the hero. `Hero.tsx` has the "Wait it out" button back in the pace line (only when the projection is over the limit; shows "timer running" while a timer runs, as legacy). `app.tsx` calls `useCraveWatch()` so an expired timer is credited on EVERY screen (legacy `live()` ticked while `craveEnd` was set), once at start (timer that ended while the app was closed) and again when the tab becomes visible.
- Behaviour kept from legacy: 10 minute wait; ended within 3 minutes -> credited at once; ended earlier -> asked; credit = `waited++`, push to `heals` and `cravs`, `healAt`, `gapFrom = max(gapFrom, end)`; the tip changes every 2.5 minutes (4 tips); "Log a craving I got through" adds a craving with an Undo toast; logging a cigarette clears the timer (`addEntry` already did this since 6a).
- SWAPS FOR 6d (overlays), where legacy used a modal and 6b-1 uses a `toast`:
  - `creditCrave` (src/actions/craving.ts): legacy `alertBox('You waited it out', ...)` + `slipPrompt(e0, false, S.crt)` (the "What set it off?" trigger question, stored in `S.crt[e0]`).
  - `askLate` (same file): legacy `askConfirm('Did you get through it?', ..., 'Yes, I got through it')` plus a "No, I had one" button. The toast stays only 5 s: if it is missed, the wait is NOT credited (the timer is cleared either way). A real modal fixes that.
- Still TODO from this slice, owned by other slices: `buzz('heal')` in `creditCrave` and `logCraving` (6b-2, marked in the file); the "quit" tab click after "Add your reasons for quitting" opens only `#plan` for now (plan view is step 7); the header craving pill `#bcrv`/`#bct` (6d).
- Verified: new tests 10/10 (TZ UTC, New_York, Manila) and the older test files still pass (19 + 34), via the vitest stand-in (real Vitest still not installed). `tsc --strict` passes on all of `src` (preact and vitest checked against hand-written stubs; the only two errors left are in `src/sync` because `@supabase/supabase-js` is not installed here, nothing to do with this slice). Parity scripts for steps 3, 4, 5 still pass (6,404 / 3,830 / 121,144 checks, 0 mismatches). No parity script for 6b-1: the legacy code is DOM code, so the tests encode its rules.
- NOT verified: still never built or opened in a browser. Test on a phone: the card under the hero, Start/Cancel, the live clock, the tips, "Wait it out" in the pace line (needs a limit and a pace over it between 7:00 and 23:00), the toast after a finished wait, and closing the app during a wait.

### Step 6b-2 (done): Wisp reactions
- New pure code: `src/lib/reactions.ts` (`pick`, `whisper`, `hello`, `needsGreetStamp`, `ambient`, `pokeLines`, `pokeReply` + `newPokeState`, `wispCaption`, constants `DIZZY_LINE`, `POKE_SHOW_MS`, `HEAL_GLOW_MS`, `HEALED_CAPTION`), `src/lib/haptics.ts` (pure `buzzPattern`), `src/lib/reactions.test.ts` (24 tests). Store-aware: `src/lib/buzz.ts` (`buzz(kind)`: vibrates unless `S.hap === 0`), `src/components/pokeState.ts` (`doPoke`, `getPoke`: poke text/expiry/combo counter, NOT in saved state).
- Wiring: `Wisp.tsx` takes `caption`, `healed`, `onPoke`. The sprite is a button (click, Enter, Space), restarts the `poke` CSS animation, and buzzes `level` when the level RISES (never on first render). `Today.tsx` computes the caption with `wispCaption` (poke > healed > celebration > whisper > ambient > level text) and handles the poke (`buzz('tap')`, line for 7 s, 6 quick pokes = dizzy line, bump + a 7.1 s timeout to clear it). `actions/craving.ts` now calls `buzz('heal')` in `creditCrave` and `logCraving`.
- Behaviour kept from legacy: hard hour = more than 2 logs in one hour over the last 14 days (before today), window -45/+30 min, quiet while a timer runs or if the last one was under 30 min ago, names the most common trigger tag; greeting for 10 min after the first open of the day (needs `S.setup`), "heavy day" variant uses yesterday's count against yesterday's limit; "<dur> since the last one" at 2 h+ while level < 6; poke lines and the "never the same line twice" rule.
- Differences on purpose: (1) the day's greeting stamp (`greetDay`/`greetAt`) is written in a `useEffect` in Today, not during render, so the greeting appears from the render after the first open. (2) `pokeReply` picks among the OTHER lines directly instead of re-rolling in a loop (same distribution, cannot hang). (3) The two mission poke lines are NOT in `pokeLines`: marked `// TODO(6c)` there. (4) `Today` uses `s.cel` for the celebration caption, but nothing sets it yet (6b-3). (5) Adding the `poke` class by hand can be wiped if Preact rewrites the `class` string in the same moment (only when `healed` flips mid-animation; harmless, 0.5 s).
- NOT ported (belongs elsewhere): the legacy global click listener that buzzes `tap`/`strong` on EVERY button (put it with the app shell or in 6d if wanted), and the iOS fallback that clicks the hidden `#hapl` switch (Setup view, step 7). Until then `buzz` only works where `navigator.vibrate` exists (Android Chrome), as before on iOS-less setups.
- Verified: new tests 24/24 in UTC, America/New_York and Asia/Manila (vitest stand-in); older tests still pass (today 19, craving 10, lib 34); `node tools/verify-lib.mjs`: 121,144 checks, 0 mismatches. `tsc --strict` on all of `src` with hand-written stubs for preact/vitest: only the 3 known environment errors remain (`./styles/index.css` types and `@supabase/supabase-js` not installed, which also leaves one implicit-any in `src/sync/index.ts`).
- NOT verified: no parity script for `whisper`/`hello`/`ambient`/`pokeLines` (legacy code is DOM code; tests encode its rules). Never built or opened in a browser. Test on a phone: tap Wisp (lines, 6 quick taps = dizzy), the heal glow + caption after a finished wait, the greeting in the first 10 minutes of a new day, the "2h 0m since the last one" caption, the whisper around your hard hour, vibration on Android.

### Step 6b-3 (done): celebration
- New pure code: `src/lib/gaps.ts` (`gapData(idx, now)` returns `{done, yest, ever, cur, m}`; `logCelebration(gd, prev, now)` = the celebration text from legacy `doLog`; `checkGapRecord(gd, celDay, now)` = the check from legacy `renderSpacing`; `CEL_MIN_GAP_MS` = 30 min), exported from `src/lib/index.ts`. `src/lib/gaps.test.ts` has 11 tests.
- `logCigarette` (`src/actions/log.ts`): computes the celebration from the log as it was BEFORE the new entry (`gapData(liveIndex, t0)` + `lastTs()`), sets `getState().cel` and then `addEntry(t0)`, so the entry and `S.cel` land in one `save()`, like legacy. Texts: "New record gap: " / "You beat yesterday\u2019s best gap: " / "Longest gap today: " + duration + ". I felt that.".
- `src/hooks/useGapRecord.ts` (`useGapRecord()`, called in `app.tsx` next to `useCraveWatch()`; also exports `checkGapRecordNow()`): once per day, when the running gap passes yesterday's best (30 min minimum), sets `S.cel` + `S.celDay` and saves. Legacy ran this from `updateLive` every 15 s on EVERY screen (and on each Today render), so the hook runs at start, every 15 s, after every `save()` (subscribe) and when the tab becomes visible. After a cloud pull (`applyRemoteState` does not notify `subscribe`) the 15 s tick catches up.
- Checked in legacy, so nothing more to add: no `buzz` for the celebration, no alert box (it is only the Wisp caption), so no `SWAP(6d)`. The caption `✨ <txt>` for 5 minutes was already in `wispCaption`. `Today.tsx` passes `s.cel`.
- Other legacy writers of `S.cel` still to port in 6c: mission done (~1602) and challenge complete (~1695), both also use `pokeUntil=0` (reset the poke text: use `pokeState`).
- Parity: `node tools/verify-gaps.mjs` extracts the legacy `srt`, `gapData`, `dur`, `lastTs`, `startOfDay`, `dayAdd` AND the two celebration lines of `doLog` and `renderSpacing` verbatim from `legacy/index.html` and runs them beside the new code (fake clock): 1,500 random logs plus 1,500 boundary scenarios built on purpose (gaps tying with today's/yesterday's best or the 30 minute minimum, +-1 ms), 87,940 checks, 0 mismatches in UTC, America/New_York, Asia/Manila and Australia/Lord_Howe. Mutation check (the first version of the script did NOT catch off-by-one mutations: random data never hits ties, hence the boundary section): `>` to `>=` on done/yest/ever and the 30 minute minimum each give 500-1,700 mismatches. Added to the `npm run verify` script.
- Verified: all test files pass in UTC, America/New_York and Asia/Manila via the vitest stand-in (lib 34, today 19, craving 10, reactions 24, gaps 11). `tsc --strict` on all of `src` with hand-written stubs for preact, preact/hooks, preact/jsx-runtime, vitest and supabase: only the known `src/sync/index.ts` implicit-any remains (supabase-js is not installed here). Parity scripts for steps 3, 4, 5 still pass (6,404 / 3,830 / 121,144 checks, 0 mismatches).
- NOT verified: still never built or opened in a browser (no network). Test on a phone: log a cigarette 30+ minutes after the previous one on the same day and check the "✨ Longest gap today..." caption (5 minutes); leave the app open while the running gap passes yesterday's best and check the "You passed yesterday's best gap" caption appears once (needs yesterday to have a gap).

### Legacy name -> new name
`def` -> `defaultState`, `fix` -> `sanitize`, `S` -> `getState()`, `srt` -> `sortedLog`, `dcounts` -> `dayCounts`, `lb` -> `lowerBound`, `minTs` -> `firstTs`, `STG` -> `STAGES`, `OPRICE` -> `OUTFIT_PRICE`, `OFMIN` -> `OUTFIT_MIN_STAGE`, `OFN` -> `OUTFIT_TEXT`, `restoreFrom` parsing -> `stateFromBackup`.
Step 6a: `doLog` -> `logCigarette` (+ `addEntry`), `removeEntry`/`restoreEntry` -> `src/state/entries.ts`, `yest` -> `yesterdayCount`, `healsToday` -> `healsToday(heals, t, yesterday, now)` (includes the yesterday bonus that legacy added in `renderMascot`), `CAP` -> `WISP_CAPTIONS`, `GHOST` -> `GHOST_SVG`, `toast` -> `components/Toasts.tsx`, `setCount`/`setTxt` -> a `key` + `rup`/`rdn` class on the number in `Hero.tsx`.
Step 5: `dk` -> `dayKey`, `lb`/`minTs` stay `lowerBound`/`firstTs` (store) and `idx.lowerBound`/`idx.first()` (LogIndex); `lastTs` -> `idx.last()` or `lastTs()` in `lib/current.ts`; `calcSaved` + global `savedAmt` -> `calcSaved(s, idx, now)` returns the number; `money(n)` -> `money(cur, n)`; the others keep their names.

Step 6b-3: `gapData()` -> `gapData(idx, now)` (`src/lib/gaps.ts`); the celebration in `doLog` -> `logCelebration`; the check in `renderSpacing` -> `checkGapRecord` + `useGapRecord`.

### Step 4 (done, logic only: no sign-in UI yet)
- Added `@supabase/supabase-js@^2.45.4` to package.json (replaces the CDN script). Not installed yet: no network in the chat sandbox.
- Created `src/sync/`:
  - `config.ts`: Supabase URL and publishable key (copied from legacy) plus the localStorage meta keys (`cigtracker.mod`, `cigtracker.synced`, `cigtracker.lock`).
  - `merge.ts`: `unionNumbers`, `mergeStates` (legacy `uni`/`merge`, same rules).
  - `engine.ts`: `createSyncEngine(deps)` has push, debounce (1.5 s), reconcile, status text, online/offline/flush handling. All outside dependencies (backend, storage, clock, online check) are injected so it is testable.
  - `supabase.ts`: the real client and the `Backend` implementation (table `user_data(user_id, data, updated_at)`).
  - `index.ts`: public API for the UI: `startSync()`, `signUp`, `signIn`, `requestPasswordReset`, `setNewPassword`, `signOut`, `deleteAccount`, `isSignedIn`, `getSyncUser`, `getSyncStatus`, `subscribeSyncStatus`, `syncNow`, `onPasswordRecovery`. Each action returns `{ ok, message?, signedIn? }` with the same message text as legacy.
- `src/state` additions: `stateFromObject` (loadState now uses it), `applyRemoteState` (swap + persist without triggering save subscribers, then notifies `subscribeRemote` listeners), `subscribeRemote`.
- The `Storage.prototype.setItem` monkey-patch is gone: `startSync()` does `subscribe(() => engine.onLocalSave())`.
- BEHAVIOUR CHANGE: after pulling cloud data the legacy app reloaded the page. The new engine swaps the state in place (`applyRemoteState`) and then does the follow-up upload check directly. Views must re-render on `subscribeRemote`. Sign-out and delete-account still clear local data and reload, as legacy did.
- Dropped: the `cigtracker.pulled` sessionStorage guard (it only existed to stop reload loops).
- Verified: `node tools/verify-sync.mjs` = 3,830 checks, 0 mismatches. It runs the legacy `uni`/`merge`/`reconcile` code side by side with the new code on 700 random scenarios (fresh device, local newer, cloud newer, no cloud row, various MOD/SYN stamps, run twice for legacy as its reload would), comparing the final state, MOD, SYN and number of uploads, plus behaviour tests (upload, retry, offline, debounce, flush on page hide, signed-out no-op, status text). Steps 3 and 4 tests also pass in TZ=UTC and America/New_York. `tsc --strict` passes on src/state and src/sync, with `supabase.ts` checked only against a hand-written stub of the Supabase API.
- NOT verified: anything that talks to real Supabase (sign-up, sign-in, password reset, delete account, the real upload and fetch). `supabase.ts` and `index.ts` were written from the supabase-js v2 API but never run. Test on a phone after step 7 builds the sign-in UI.
- NOT ported yet (step 7, Setup/account view): the sign-in gate markup (`#auth`: tabs, email/password form, forgot password, new-password form `#rform`), account email and sign-out/delete buttons in the drawer (`#dout`, `#ddel`, `#dem`), and the status line (`#dsy`). Legacy lines ~935-1021 show the exact behaviour. The UI should call `startSync()` once on start; 'signed-out' shows the sign-in screen, 'error' lets the app run locally. The backup reminder in legacy hides when signed in (`!window.WISP_SYNC`): use `isSignedIn()`.


### Step 6c-1 (done): Mission card + stars
- New pure code: `src/lib/missions.ts` (`MIS`, `mins`, `nToday`, `tagCount`, `usualGap`, `gapNow`, `mornHabit`, `misPool`, `misNew`, `misPick`, `ensureMission`, `missionComplete`, `missionView`, `completeMissionPatch`, `missionCtx`), `src/lib/missions.test.ts` (coverage for pool/pick/new, ok/bad, manual mark, star award, view text).
- Actions: `src/actions/mission.ts` (`ensureTodayMission`, `checkMission`, `markMissionDone`, `swapMission`) — on complete: stars/earned/misN/mlog/cel, `buzz("heal")`, toast, `clearPoke()` (pokeState).
- UI: `src/components/MissionCard.tsx` (card under Wisp banner, star button + count, Mark done / Swap / Try another / Spend stars placeholder). Wired in `Today.tsx` with `useTick` so auto missions complete live.
- Reactions: the two mission poke lines added to `pokeLines` (`missionKnown` / `missionDone`); TODO(6c) removed. Tests extended.
- Behaviour kept from legacy: daily pick from pool (deterministic), one free swap, manual missions need Mark done, auto ones (gap/morn/eve/crav/trig) complete via `checkMission`, +stars and celebration caption, poke text cleared so cel shows.
- Not in this slice: star float / wispHit / popStars CSS flash on the mascot (visual only; card + toast + cel cover feedback); wardrobe / Spend stars (6c-3 / account); challenge card (6c-2).
- Verified: missions tests and reactions tests pass via vitest stand-in (TZ=UTC). Older lib tests not re-run this slice. tsc not fully run here (install timed out); types follow existing patterns.
- NOT verified: browser / phone — mission card under the banner, Mark done / Swap, auto-complete when a craving is logged for a crav mission, stars increment, celebration caption after complete.


### Step 6c-2 (done): Challenge card
- New pure code: `src/lib/challenges.ts` (`CHT`, `CHK`, `dayState`, `chalStates`, `challengeEnded`, `endChalPatch`, `chalStarReward`, `todayFails`, `activeChalView`, `chalCtx`), `src/lib/challenges.test.ts`.
- Actions: `src/actions/challenge.ts` (`checkChallenge`, `startChallenge`, `stopChallenge`) — win: stars/badge/cres/cel, `buzz('heal')`, `clearPoke()`, toast; fail: cres only. Stop clears chal (SWAP 6d: legacy used askConfirm; success alertBox also SWAP 6d).
- UI: `src/components/ChallengeCard.tsx` (active progress dots + stop; idle picker with 3/7 day buttons + last result). Wired in `Today.tsx` under the craving card.
- Behaviour kept from legacy: five challenge types, 3/7 day length, 1 grace day on 7-day, start tomorrow if today already fails, 2-minute defer after a log before fail-end, day dots (ok/bad/now/fut).
- Verified: challenges tests + missions + reactions pass via vitest stand-in (TZ=UTC).
- NOT verified: browser — start a challenge, watch dots, complete or fail, stop, badge/stars toast.


### Step 6c-3 (done): Evolution + form names + wardrobe
- Pure: `src/lib/evolution.ts` (`evoInfo`, `FORM`/`STAGES`, `hasOutfit`, `formLabel`, `sanitizeOutfit`, re-exports of outfit constants), `src/lib/evolution.test.ts`.
- Actions: `src/actions/evolution.ts` (`checkEvo`, `wearOutfit`, `unlockOutfit`, `applyOutfitAttr`, `syncOutfitFromState`). Evolve toast stands in for alertBox (SWAP 6d). Unlock spends stars immediately when affordable (confirm is SWAP 6d).
- `Wisp.tsx`: shows `Wisp · {form}` from `S.evo`, applies `.ev` opacity via `data-ev` (legacy `evSet`).
- `OutfitWardrobe.tsx`: compact picker opened from mission stars / "Spend stars on Wisp". Uses existing outfit CSS.
- `Today.tsx`: runs `checkEvo` on the tick, syncs `data-outfit` on mount, passes `evo` to Wisp, toggles wardrobe.
- Behaviour kept: 7-day average vs `S.base` stages 0–5; free outfits; star-priced or evo-unlocked outfits; stage-gated flower/headphones/crown/cape.
- Verified: evolution tests + missions + challenges pass via vitest stand-in (TZ=UTC).
- NOT verified: browser — evolve after a week of lower averages, form name and SVG stages, buy/wear outfit from stars button.


### Step 6c-4 (done): Milestones
- Pure: `src/lib/milestones.ts` (`mileDefs`, `newlyReached`, `mileCtx`), `src/lib/milestones.test.ts`.
- Actions: `src/actions/milestones.ts` (`checkMile`) — stamps all newly met ids into `S.mile`, toasts the first title + body (alertBox is SWAP 6d).
- Wired in `Today.tsx` on the 1s tick (legacy ran every ~30s in `updateLive` and on full render).
- Behaviour kept: 8 milestones (smoke-free hours, week under limit, savings goal thirds), first-only toast, all stamped in one save, no-op with empty log.
- Full wins list UI stays on insights/summary (step 7).
- Verified: milestones tests pass via vitest stand-in (TZ=UTC); evolution tests still pass.
- NOT verified: browser — hit 24h smoke-free and see toast; goal % milestones after savings climb.


### Step 6d-1 (done): Header
- `src/components/Header.tsx`: streak flame (`#flm` → `#plan`, count from `streak()`), title (`VIEW_TITLE`, empty on Today), craving pill (`#bcrv` / `#bct` live mm:ss, starts timer + scrolls to card), account + menu buttons.
- `src/components/MenuDrawer.tsx`: minimal right drawer + scrim with route links (full account/prefs chrome stays step 7).
- `src/app.tsx`: renders Header above the view, MenuDrawer; account jumps to Today and dispatches `wisp:open-wardrobe` (Today already hosts OutfitWardrobe).
- Behaviour kept: streak badge, pill `.on` while timer runs, title blank on Today, menu closes on route change.
- Verified: structure only (no new pure tests). Existing lib tests not re-run this slice.
- NOT verified: browser — flame count, pill countdown, menu open/close, account → wardrobe.


### Step 6d-2 (done): More about today
- Pure: `spacingView` in `src/lib/gaps.ts` (big + sub lines for the spacing challenge); tests added to `gaps.test.ts`.
- UI: `src/components/MoreAboutToday.tsx` — `<details>` with spacing challenge (`gapData` + live tick) and spent today (`count * per`, currency from state).
- Wired under the challenge card in `Today.tsx`. Gap-record celebration remains in `useGapRecord` (shell).
- Behaviour kept: empty-log copy, duration vs “No gap yet” / “Nothing logged today”, yesterday/ever subline, hold-on hint, sticks count + money.
- Verified: gaps tests (including spacingView) pass via vitest stand-in (TZ=UTC).
- NOT verified: browser — open the details, watch the running gap update, spent after a log.


### Step 6d-3 (done): Restart, backup, weekly nudge
- Pure: `src/lib/nudges.ts` (`restartView`, `backupView`, `weekNudgeView` from recap highlight rules), `src/lib/nudges.test.ts`.
- Actions: `src/actions/nudges.ts` (`setFreshQuitDay`, `dismissRestart`, `snoozeBackup`, `markRecapSeen`).
- UI: `src/components/TodayNudges.tsx` — weekly nudge link → `#insights`, restart card, backup reminder (hidden when `isSignedIn()`).
- Wired after the craving card in `Today.tsx`.
- Behaviour kept: quit-day restart once per day, backup after 14d / 5 logs / not snoozed, weekly nudge Sat or Sun–Mon when week not seen.
- Verified: nudges + gaps tests pass via vitest stand-in (TZ=UTC).
- NOT verified: browser — force quit day + log, backup thresholds, Saturday nudge.


### Step 6d-4 (done): Overlays
- `src/components/Overlay.tsx`: `alertBox`, `askConfirm`, `askConfirmDual`, `slipPrompt`, modal UI (`#ov` / `#box` / chips). Mounted in `app.tsx`.
- Wired SWAP sites: craving credit + askLate, challenge complete + stop confirm, evolution alert, outfit unlock confirm, milestones, log over-limit / limit-reached + trigger chips.
- `tryLogCigarette` / `askEarly` in `src/actions/log.ts`; Nav + button uses `tryLogCigarette` (gap warn → wait or log anyway).
- Behaviour kept: warn class + strong buzz on alertBox(warn), cancel optional, trigger chips write `tags` or `crt`, Escape / scrim closes.
- Verified: no new pure unit tests (UI/side-effect module). Existing lib tests not re-run this slice.
- NOT verified: browser — + with gap warn, over-limit log + chips, challenge stop, evolve dialog.


### Step 6d-5 (done): Nav extras
- `src/components/Nav.tsx`: sliding `.dot` (`placeDot` via useLayoutEffect on current tab + resize), long-press (450ms) quick menu `#qm` with qscrim, one-time tip `#qh` when setup is done and `S.qh` is unset.
- Quick actions: log craving, start 10 min wait, jump to History for past entry (form lands in step 7).
- Click path still runs `tryLogCigarette` (gap warn); long-press sets `lpFired` so click is suppressed.
- Escape / scrim closes menu; context menu on + prevented.
- Step 6d fully complete.
- Verified: structure only (no pure tests for DOM layout).
- NOT verified: browser — dot slides on route change, hold + opens menu, tip once.

### Step 7a (done): History
- New: `src/views/History.tsx` — seg tabs Cigarettes / Cravings, past-entry form (add + edit), day-grouped lists, show-more paging (30), best-gap line, money total per day.
- Actions: `deleteLogEntry` / `savePastEntry` in `src/actions/log.ts`; `deleteCraving` / `setCravingTrigger` in `src/actions/craving.ts`; `pickTrigger` in Overlay.
- State: notes typed as `EntryNote { m?, n? }` (was incorrectly `Record<string, string>`).
- Wiring: `app.tsx` renders History for `#history`; Nav long-press "Add a past entry" dispatches `wisp:open-past` to open the form.
- Behaviour kept: empty states, trigger picker on new past entry without tag, Undo on delete, edit moves timestamp + notes + tag, craving select writes `S.crt`.
- Verified: structure and types by reading; full `tsc` / browser not run in this sandbox (npm install hung).

### Step 7b (done): Setup
- New: `src/views/Setup.tsx` — tabs Limits & cost / Data & more.
- Limits: name, daily limit (via `setLimit` + limH), base, gap, gap warning switch, pack/per/currency, health nic/tar.
- Data: backup file save/restore, copy/paste restore, CSV export, custom triggers add/remove, home-screen tip, erase all data (confirm).
- Actions: `src/actions/setup.ts` (`saveBackupFile`, `copyBackupText`, `exportCsv`, `restoreFromText`/`restoreFromFile`, `addCustomTrigger`/`removeCustomTrigger`, `eraseAllData`, `patchField`).
- Uses existing `stateFromBackup` / `replaceState` / `setLimit` from lib/current.
- Wiring: `app.tsx` renders Setup for `#setup`.
- NOT in this slice: first-run onboarding overlay `#su`, theme/haptics (drawer), account sign-in.
- Verified: structure by reading; full tsc/browser not run in this sandbox.

### Step 7c (done): Plan
- New: `src/views/Plan.tsx` — tabs Progress / Quit plan / Milestones.
- Progress: Future Wisp date/pace text + evolution line, smoke-free stretch (live timer), streak + best, savings goal with bar.
- Quit plan: today’s limit summary, step-down toggle + fields + schedule preview + hold, quit day, reasons.
- Miles: health time milestones, achievements from `mileDefs`, challenge badges from `S.badges` + `CHT`.
- Actions: `src/actions/plan.ts` (plan on/off, fields, quit day, hold, goal, reasons).
- Uses existing `planSched`, `streak`/`bestStreak`, `calcSaved`, `evoInfo`, `mileDefs`, `cntBetween`.
- Wiring: `app.tsx` renders Plan for `#plan`.
- NOT polished: Future Wisp still shows form name text instead of full ghost SVG in `#fwm`.
- Verified: structure by reading; full tsc/browser not run in this sandbox.

### Step 7d (done): Insights
- New: `src/lib/insights.ts` (dayBars, dayChartSvg, avgGapMs, peakHours, tagCounts, heatDays, weekCompare, moneyTiles, cravingCompare).
- New: `src/views/Insights.tsx` — tabs Overview / Patterns / Money & health, 7/30/90 range seg.
- Overview: week comparison, per-day chart (SVG), average gap, cravings got through.
- Patterns: peak hours chart, cigarette triggers, craving triggers, 5-week heat calendar.
- Money: conf reminder, spend tiles (today / range / month), saved vs usual, nicotine & tar estimate.
- Wiring: `app.tsx` renders Insights for `#insights`.
- NOT in this slice: Wisp diary, last-week card, weekly recap card, share-this-week button.
- Verified: structure by reading; full tsc/browser not run in this sandbox.

### Step 7e (done): Summary
- New: `src/lib/summary.ts` — summaryData, shareStats, shFree, shareHero, drawShareCard.
- New: `src/views/Summary.tsx` — smoke-free hero, money saved / avoided tiles, detail rows, Share button.
- Share modal: kind toggles (streak / free / saved / avoid), canvas card, Share (Web Share API) or Save image download.
- Canvas is a simplified dark/light card (not a pixel clone of the legacy 1080×1350 art).
- Wiring: `app.tsx` renders Summary for `#summary`.
- Verified: structure by reading; full tsc/browser not run in this sandbox.

### Step 7f (done): Tips
- New: `src/views/Tips.tsx` — The 4 D’s, Support, Common triggers (static details cards, same copy as legacy).
- Wiring: `app.tsx` renders Tips for `#tips`.
- Step 7 (all main views) complete.
- Verified: static markup.

### Step 8 (done): Service worker / PWA
- New: `tools/generate-sw.mjs` — after build, walks `dist/`, builds PRECACHE (shell + hashed assets), content-hash VERSION, writes `dist/sw.js`.
- `vite.config.ts` — `generateServiceWorker` plugin runs the script on `closeBundle`.
- `public/sw.js` — kept as a light dev/fallback shell (VERSION `v-dev`); production overwrites in dist.
- `src/main.tsx` — registers `/sw.js` on load (skips `file:`).
- `package.json` — `"sw": "node tools/generate-sw.mjs"` for manual runs.
- How to test on a phone: `npm run build && npm run preview` (or deploy). Open site, install PWA, go offline — shell + assets should load. Redeploy with a code change → new VERSION → activate clears old caches.
- Not verified in this sandbox (no full npm build). Run build on a machine with network to confirm `dist/sw.js` lists hashed `/assets/*` files.

### Step 9a (done): First-run onboarding
- New: `src/components/Onboarding.tsx` — legacy `#su` form (name, why, base, limit, pack, per, currency).
- Start tracking saves fields + `conf=1` + `setup=1`; Skip only sets `setup=1`.
- Wired in `app.tsx` (renders when `!S.setup`). Focus trap + autofocus on open.
- Quick-hint (`qh`) after setup is still deferred (Nav already gates on `s.setup`).

### Step 9b (done): Account drawer
- New: `src/lib/theme.ts` — applyTheme, applyFx, fxLevel, applyOutfitAttr.
- New: `src/components/AccountDrawer.tsx` — outfit grid, appearance seg, motion/haptics seg, sign-in form / sign-out / delete account.
- `MenuDrawer.tsx` — profile row opens account; shared scrim in `app.tsx`.
- `app.tsx` — accountOpen state, boot theme/fx/outfit + `startSync()`, header + menu open account.
- Auth uses existing `src/sync` API (signIn/signUp/signOut/deleteAccount/status).
- App lock (`#dlock`) not ported.

### Step 9c (done): Insights diary + weekly recap
- New: `src/lib/diary.ts` — dayStats, diaryText, ensureDiary, weekCard, recapInfo.
- `Insights.tsx` Overview now shows: weekly recap card (+ Share this week → Summary share), last-week card, Wisp diary (evening + yesterday, earlier entries in details).
- Marks `recapSeen` when recap is shown; materializes diary lines after 20:00 / for yesterday.

### Step 9d (done): Future Wisp full ghost SVG
- `Plan.tsx` Progress → Future Wisp: `#fwm` now renders `GHOST_SVG` (same sprite as Today mascot / wardrobe).
- Evolution layers forced on (stage 5), matching legacy `evSet(fm, 5)` so the future form shows sprout/wings/halo/sparkles.
- Text date/pace copy unchanged.

### Step 9e (done): App lock
- New: `src/lib/appLock.ts` — WebAuthn platform passkey enable/disable/authenticate; LOCK_KEY + session unlock + 30s away relock.
- New: `src/components/AppLock.tsx` — full-screen lock overlay + `AppLockToggle` for Account drawer.
- Wired in `app.tsx` and Account drawer. Hidden when platform authenticator is unavailable.
- Sign-out from lock screen uses existing sync signOut when signed in.

### Step 10 (partial): Build verification
- Attempted `npm install` / `npm run build` in the chat sandbox: **incomplete**.
  - Full install hung / OOM’d; partial `node_modules` was cleaned.
  - Registry peer conflict: `@preact/preset-vite@2.9` wants Vite 2–5, package had Vite 6.
- Fix applied: `package.json` pins `vite@^5.4.11`, `vitest@^2.1.0` (compatible with preset-vite 2.9).
- Source spot-check: `app.tsx`, `Plan.tsx` (GHOST_SVG + fwmRef), Account/AppLock wiring look structurally OK. **No browser or tsc run succeeded here.**

## Next step (on a real machine)
1. `rm -rf node_modules package-lock.json`
2. `npm install`
3. `npm test` (optional) && `npm run build`
4. Confirm `dist/sw.js` has a content `VERSION` and hashed `/assets/*` in PRECACHE
5. `npm run preview` or deploy; smoke-test:
   - onboarding → log → Insights diary/recap → Share → Account theme/outfit → app lock → offline PWA
6. Optional: stop serving `legacy/index.html` after QA

If build fails, paste the `tsc` / Vite error log into the next chat as the only step.

Keep this chat small:
- Do not re-read the whole log above. Read only the latest step log and the files you touch.
- Only open the legacy lines you need with `grep -n` / `sed -n`.
- After EACH item add a short line under a step heading in this file.
- Re-zip only once at the end; delete `node_modules` before zipping.

Verify as far as the sandbox allows, update the log and checklist, re-zip.

## Prompt to paste in a new account
"I'm continuing a project. Read HANDOFF.md in the uploaded zip, do only the 'Next step', then update HANDOFF.md and give me the zip again."
