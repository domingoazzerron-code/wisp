import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getState, save } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { Wisp } from '../components/Wisp.tsx';
import { doPoke, getPoke, getWhyTs, setWhyTs } from '../components/pokeState.ts';
import { Hero } from '../components/Hero.tsx';
import { QuickActions } from '../components/QuickActions.tsx';
import { StatChips } from '../components/StatChips.tsx';
import { MissionCard } from '../components/MissionCard.tsx';
import { ChallengeCard } from '../components/ChallengeCard.tsx';
import { MoreAboutToday } from '../components/MoreAboutToday.tsx';
import { TodayNudges } from '../components/TodayNudges.tsx';
import { OutfitWardrobe } from '../components/OutfitWardrobe.tsx';
import { startCrave } from '../actions/craving.ts';
import { checkEvo, syncOutfitFromState } from '../actions/evolution.ts';
import { checkMile } from '../actions/milestones.ts';
import { toast } from '../components/Toasts.tsx';
import { TAGS } from '../components/Overlay.tsx';
import { buzz } from '../lib/buzz.ts';
import { canUndoLast, undoLast } from '../actions/log.ts';
import { calcSaved, countSince, gapBase, lastTs, lim, liveIndex, streak } from '../lib/current.ts';
import { per } from '../lib/streaks.ts';
import { flowerCount, sceneForTime, sceneMood, sceneOverride, villageTier } from '../lib/scene.ts';
import { limFor } from '../lib/limits.ts';
import { dayAdd, startOfDay } from '../lib/dates.ts';
import { POKE_SHOW_MS, ambient, hello, needsGreetStamp, pokeLines, whisper, wispCaption } from '../lib/reactions.ts';
import { greetingPrefix, healsToday, wispLevel, wispSubline, yesterdayCount } from '../lib/today.ts';
import { MIS } from '../lib/missions.ts';

/**
 * Today view: illustrated hero (day / dusk / night scene, greeting, Wisp + speech bubble), stat chips,
 * the count card, quick actions, nudges, and a row of Today cards (mission, challenge, spacing).
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

  // Hero artwork: lighting from the local clock, weather from how today is going, extras from your progress.
  const scene = sceneOverride(location.search) || sceneForTime(d.getHours(), d.getMinutes());
  const mood = sceneMood(t, L);
  const flowers = flowerCount(streak());
  const price = per(s);
  const saved = useMemo(() => calcSaved(), [s.log.length, td, s.base, s.pack, s.per]);
  const village = villageTier(price > 0 ? saved / price : 0);
  const calm = !!s.craveEnd && s.craveEnd > now;

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

  // "What set it off?" chips for the newest entry (legacy renderWhy), else a "Wait it out" button during a hard hour.
  const whyTs = getWhyTs();
  const whisperOn = !!whisper({ log: s.log, tags: s.tags, craveEnd: s.craveEnd || 0, last, now });
  let why: ComponentChildren = null;
  if (whyTs && s.log.indexOf(whyTs) > -1 && !s.tags[whyTs]) {
    why = (
      <div class="why" id="why">
        <span class="q">What set it off?</span>
        <div class="wr">
          {TAGS.concat(s.ctags || []).map((tg) => (
            <button key={tg} type="button" onClick={() => {
              const st = getState();
              st.tags = { ...st.tags, [whyTs]: tg };
              setWhyTs(0);
              save();
              toast('Wisp noted: ' + tg);
            }}>{tg}</button>
          ))}
        </div>
      </div>
    );
  } else if (whisperOn) {
    why = (
      <div class="why" id="why">
        <div class="wr">
          <button type="button" onClick={() => { if (!getState().craveEnd) startCrave(); toast('10 minute wait started'); }}>Wait it out · 10 min</button>
        </div>
      </div>
    );
  }

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
      <Wisp
        level={level} count={t} evo={s.evo || 0} caption={caption.text} healed={caption.healed}
        subline={wispSubline(t, L, heals, limitYesterday)} onPoke={onPoke} why={why}
        scene={scene} mood={mood} flowers={flowers} village={village} calm={calm}
        date={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        greeting={<>{greetingPrefix(d.getHours())}{s.name ? <>, <b>{s.name}</b></> : null}!</>}
        initial={(s.name || 'W').trim().charAt(0).toUpperCase() || 'W'}
        onAvatar={() => window.dispatchEvent(new Event('wisp:open-account'))}
      />
      {wardrobe ? <OutfitWardrobe onClose={() => setWardrobe(false)} /> : null}
      <StatChips
        now={now} count={t} limit={L} last={last} gapMin={s.gap} gapBase={gapBase()}
        spent={t * price} saved={saved} cur={s.cur || '₱'}
      />
      <Hero
        count={t} limit={L} quitActive={quitActive} canUndo={canUndoLast()}
        gapMin={s.gap} gapBase={gapBase()} now={now}
        craving={!!s.craveEnd && s.craveEnd > now} onUndo={undoLast}
        onWait={() => { startCrave(); toast('10 minute wait started'); }}
      />
      <h2 class="sec2">Quick actions</h2>
      <QuickActions now={now} />
      <TodayNudges now={now} />
      <h2 class="sec2">Today’s focus</h2>
      <div class="crow2">
        <MissionCard now={now} onOpenWardrobe={() => setWardrobe(true)} />
        <ChallengeCard now={now} />
        <MoreAboutToday now={now} />
      </div>
    </section>
  );
}
