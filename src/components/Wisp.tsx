import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { GHOST_SVG } from './ghost.ts';
import { CIG_LIT_AT } from '../lib/today.ts';
import { formLabel } from '../lib/evolution.ts';
import { buzz } from '../lib/buzz.ts';
import { Scene } from './Scene.tsx';
import type { Mood, SceneId } from '../lib/scene.ts';

interface Props {
  level: number;        // 0..6, from wispLevel()
  count: number;        // cigarettes today
  evo: number;          // 0..5 evolution stage (S.evo)
  caption: string;      // chosen by Today (wispCaption)
  healed: boolean;      // glow class while a heal / celebration is recent
  subline: string;
  onPoke: () => void;
  why?: ComponentChildren; // trigger chips / wait button under the caption
  scene: SceneId;       // day / dusk / night artwork
  mood: Mood;           // weather: clear while on track, drizzle when over the limit
  flowers: number;      // foreground flowers (streak)
  village: number;      // cottages (cigarettes avoided)
  calm: boolean;        // craving wait running
  date: string;         // 'Thursday, 19 November'
  greeting: ComponentChildren; // 'Good evening, <b>Name</b>!'
  initial: string;      // avatar letter
  onAvatar: () => void; // opens the account drawer
}

/** Set .ev opacity from data-ev (legacy evSet). */
function applyEvoVisual(root: HTMLElement | null, st: number): void {
  if (!root) return;
  const els = root.querySelectorAll('.ev');
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const need = +(el.getAttribute('data-ev') || 0);
    el.style.opacity = need <= st ? '1' : '0';
  }
}

/** Today hero: the day / dusk / night scene with the greeting on top, Wisp standing in it and a speech bubble beside him. */
export function Wisp({
  level, count, evo, caption, healed, subline, onPoke, why,
  scene, mood, flowers, village, calm, date, greeting, initial, onAvatar,
}: Props) {
  const ban = useRef<HTMLDivElement>(null);
  const mas = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);

  // Legacy renderMascot: a buzz when the level RISES (never on the first render).
  useEffect(() => {
    if (prev.current !== null && level > prev.current) buzz(level);
    prev.current = level;
  }, [level]);

  // Evolution stage visuals (sprout / wings / halo / sparkles on the SVG).
  useEffect(() => {
    applyEvoVisual(mas.current, evo || 0);
  }, [evo]);

  function poke() {
    onPoke();
    const el = ban.current;
    if (el) { el.classList.remove('poke'); void el.offsetWidth; el.classList.add('poke'); }
  }

  return (
    <div
      ref={ban} class={'hero2' + (healed ? ' healed' : '')} id="masc"
      data-st={level} data-cig={count >= CIG_LIT_AT ? '1' : '0'} data-scene={scene} style={{ '--s': String(level) }}
    >
      <Scene scene={scene} mood={mood} flowers={flowers} village={village} calm={calm} />
      <div class="hscrim" aria-hidden="true" />
      <div class="hgr">
        <button class="avt" id="avt" type="button" aria-label="Open account and style" onClick={onAvatar}>{initial}</button>
        <div class="hgt">
          <div id="date">{date}</div>
          <div id="gr">{greeting}</div>
        </div>
      </div>
      <div class="hstage">
        <div class="bub">
          <div class="bn" id="bn">{formLabel(evo)}</div>
          <div id="mcap">{caption}</div>
          <div class="k" id="msub">{subline}</div>
          {why}
        </div>
        <div class="mwrap">
          <div class="aura" aria-hidden="true" />
          <div
            ref={mas}
            id="mas" role="button" tabIndex={0} aria-label="Wisp. Tap to poke"
            onClick={poke}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } }}
            dangerouslySetInnerHTML={{ __html: GHOST_SVG }}
          />
        </div>
      </div>
    </div>
  );
}
