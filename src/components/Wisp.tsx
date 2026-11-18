import { useEffect, useRef } from 'preact/hooks';
import { GHOST_SVG } from './ghost.ts';
import { CIG_LIT_AT } from '../lib/today.ts';
import { formLabel } from '../lib/evolution.ts';
import { buzz } from '../lib/buzz.ts';

interface Props {
  level: number;        // 0..6, from wispLevel()
  count: number;        // cigarettes today
  evo: number;          // 0..5 evolution stage (S.evo)
  caption: string;      // chosen by Today (wispCaption)
  healed: boolean;      // glow class while a heal / celebration is recent
  subline: string;
  onPoke: () => void;
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

/** Wisp's banner: sprite at the left, speech bubble (form name, caption, small line) at the right. */
export function Wisp({ level, count, evo, caption, healed, subline, onPoke }: Props) {
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
      ref={ban} class={'ban' + (healed ? ' healed' : '')} id="masc"
      data-st={level} data-cig={count >= CIG_LIT_AT ? '1' : '0'} style={{ '--s': String(level) }}
    >
      <div
        ref={mas}
        id="mas" role="button" tabIndex={0} aria-label="Wisp. Tap to poke"
        onClick={poke}
        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } }}
        dangerouslySetInnerHTML={{ __html: GHOST_SVG }}
      />
      <div class="bub">
        <div class="bn" id="bn">{formLabel(evo)}</div>
        <div id="mcap">{caption}</div>
        <div class="k" id="msub">{subline}</div>
      </div>
    </div>
  );
}
