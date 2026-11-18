import { useEffect, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { Wisp } from '../components/Wisp.tsx';
import { doPoke, getPoke } from '../components/pokeState.ts';
import { Hero } from '../components/Hero.tsx';
import { CravingCard } from '../components/CravingCard.tsx';
import { MissionCard } from '../components/MissionCard.tsx';
import { ChallengeCard } from '../components/ChallengeCard.tsx';
import { MoreAboutToday } from '../components/MoreAboutToday.tsx';
import { TodayNudges } from '../components/TodayNudges.tsx';
import { OutfitWardrobe } from '../components/OutfitWardrobe.tsx';
import { startCrave } from '../actions/craving.ts';
import { checkEvo, syncOutfitFromState } from '../actions/evolution.ts';
import { checkMile } from '../actions/milestones.ts';
import { toast } from '../components/Toasts.tsx';
import { buzz } from '../lib/buzz.ts';
import { canUndoLast, undoLast } from '../actions/log.ts';
import { countSince, gapBase, lastTs, lim, liveIndex } from '../lib/current.ts';
import { limFor } from '../lib/limits.ts';
import { dayAdd, startOfDay } from '../lib/dates.ts';
import { POKE_SHOW_MS, ambient, hello, needsGreetStamp, pokeLines, whisper, wispCaption } from '../lib/reactions.ts';
import { greetingPrefix, healsToday, wispLevel, wispSubline, yesterdayCount } from '../lib/today.ts';
import { MIS } from '../lib/missions.ts';

/**
 * Today view through 6d-3: full Today cards except overlays and nav extras.
 * Still to come: overlays (6d-4), nav extras (6d-5).
 */
export function Today() {
  useStore();
  useTick(1000);
  const [, bump] = useState(0);
  const [wardrobe, setWardrobe] = useState(false);

  // Header account button dispatches this (full account drawer is step 7).
  useEffect(() => {
    const on = () => setWardrobe(true);
    window.addEventListener('wisp:open-wardrobe', on);
    return () => window.removeEventListener('wisp:open-wardrobe', on);
  }, []);

  const s = getState();
  const now = Date.now();
  const d = new Date(now);
  const t = countSince(1);
  const L = lim();
  const heals = healsToday(s.heals || [], t, yesterdayCount(liveIndex, now), now);
  const level = wispLevel(t, L, heals);
  // legacy uses "midnight minus 24h" here (not dayAdd); kept for parity
  const limitYesterday = limFor(s, startOfDay(now) - 864e5);
  const quitActive = !!s.plan.quit && startOfDay(now) >= s.plan.quit;
  const td = startOfDay(now);

  // Greeting stamp + outfit attr + evolution check (legacy ambient / applyOutfit / checkEvo).
  useEffect(() => {
    const st = getState();
    const n = Date.now();
    if (needsGreetStamp(st.greetDay, startOfDay(n))) { st.greetDay = startOfDay(n); st.greetAt = n; save(); }
  });
  useEffect(() => { syncOutfitFromState(); }, []);
  useEffect(() => { checkEvo(now); }, [now]);
  useEffect(() => { checkMile(now); }, [now]);

  const last = lastTs();
  const poke = getPoke();
  const caption = wispCaption({
    level, now, pokeText: poke.text, pokeUntil: poke.until, healAt: s.healAt || 0,
    celebration: s.cel,
    whisper: whisper({ log: s.log, tags: s.tags, craveEnd: s.craveEnd || 0, last, now }),
    ambient: ambient({
      setup: !!s.setup, greetAt: s.greetAt, now, last, level,
      hello: () => hello({
        td, hour: d.getHours(), yesterdayCount: yesterdayCount(liveIndex, now),
        yesterdayLimit: limFor(s, dayAdd(td, -1)),
      }),
    }),
  });

  function onPoke() {
    buzz('tap');
    const n = Date.now();
    const nd = new Date(n);
    const tdy = startOfDay(n);
    const st = getState();
    const m = st.mis;
    doPoke(pokeLines({
      now: n, hour: nd.getHours(), last: lastTs(), countToday: countSince(1), limit: lim(),
      healsToday: (st.heals || []).filter((h) => h >= tdy).length, stars: st.stars || 0,
      missionKnown: !!(m && MIS[m.id as keyof typeof MIS]),
      missionDone: !!(m && m.done),
    }), n);
    bump((x) => x + 1);
    setTimeout(() => bump((x) => x + 1), POKE_SHOW_MS + 100);
  }

  return (
    <section class="view" id="v-today">
      <div class="greet">
        <div id="date">{d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div id="gr">{greetingPrefix(d.getHours())}{s.name ? <>, <b>{s.name}</b></> : null}!</div>
      </div>
      <Wisp
        level={level} count={t} evo={s.evo || 0} caption={caption.text} healed={caption.healed}
        subline={wispSubline(t, L, heals, limitYesterday)} onPoke={onPoke}
      />
      <MissionCard now={now} onOpenWardrobe={() => setWardrobe(true)} />
      {wardrobe ? <OutfitWardrobe onClose={() => setWardrobe(false)} /> : null}
      <Hero
        count={t} limit={L} quitActive={quitActive} canUndo={canUndoLast()}
        last={last} gapMin={s.gap} gapBase={gapBase()} now={now}
        craving={!!s.craveEnd && s.craveEnd > now} onUndo={undoLast}
        onWait={() => { startCrave(); toast('10 minute wait started'); }}
      />
      <CravingCard now={now} />
      <TodayNudges now={now} />
      <ChallengeCard now={now} />
      <MoreAboutToday now={now} />
    </section>
  );
}
