import type { Mood, SceneId } from '../lib/scene.ts';

interface Props {
  scene: SceneId;
  mood: Mood;
  flowers: number;   // 0..12 foreground flowers (smoke-free streak)
  village: number;   // 0..3 extra cottages (cigarettes avoided)
  calm: boolean;     // a craving wait is running: motion slows, pond ripples
}

// [x, y, r, bright-at-dusk]
const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [34, 24, 1.4, 1], [76, 52, 1, 0], [126, 20, 1.6, 1], [178, 62, 1, 0], [214, 28, 1.3, 1], [254, 52, 1, 0],
  [336, 22, 1.5, 1], [374, 60, 1.1, 0], [52, 98, 1, 0], [156, 96, 1.2, 0], [284, 100, 1, 0], [356, 112, 1.3, 0],
  [104, 124, 1, 0], [232, 110, 1.1, 0], [16, 138, 1, 0], [392, 138, 1, 0], [196, 12, 1, 1], [304, 8, 1.2, 1],
  [62, 12, 1.2, 1], [268, 20, 1, 0],
];

const FLOWERS: ReadonlyArray<readonly [number, number, string]> = [
  [46, 292, '#FF7AA8'], [170, 298, '#FFD54A'], [94, 290, '#FFFFFF'], [250, 290, '#FF9A4D'],
  [120, 298, '#B48CFF'], [344, 294, '#FF7AA8'], [62, 286, '#FFD54A'], [196, 291, '#FFFFFF'],
  [70, 298, '#FF9A4D'], [146, 292, '#B48CFF'], [234, 298, '#FF7AA8'], [354, 288, '#FFD54A'],
];

const FIREFLIES: ReadonlyArray<readonly [number, number]> = [
  [64, 150], [104, 128], [180, 136], [250, 150], [300, 196], [350, 170], [330, 250], [214, 262], [90, 262],
];

/** Grass tufts along the top edge of the foreground. */
function grassPath(): string {
  let d = 'M-10 298';
  for (let x = -10; x <= 410; x += 14) {
    d += ' L' + (x + 4) + ' ' + (292 - ((x / 14) % 3) * 2) + ' L' + (x + 8) + ' 298';
  }
  return d + ' L410 340 L-10 340Z';
}
const GRASS = grassPath();

function Cloud({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ') scale(' + s + ')'}>
      <g class={'scl scl' + i}>
        <path class="cld" d="M0 22Q-3 10 11 9Q15 -3 30 3Q41 -6 53 5Q70 3 67 18Q72 26 59 26L9 26Q-2 28 0 22Z" />
      </g>
    </g>
  );
}

function Tree({ x, y, s, i }: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ') scale(' + s + ')'}>
      <g class={'sway sw' + i}>
        <rect class="trk" x="-3" y="-30" width="6" height="30" rx="2" />
        <circle class="tre" cx="0" cy="-44" r="19" />
        <circle class="tre" cx="-14" cy="-33" r="13" />
        <circle class="tre" cx="14" cy="-34" r="14" />
        <circle class="tre2" cx="-5" cy="-50" r="9" />
      </g>
    </g>
  );
}

function House({ x, y, s, cls }: { x: number; y: number; s: number; cls: string }) {
  return (
    <g class={cls} transform={'translate(' + x + ' ' + y + ') scale(' + s + ')'}>
      <g class="vh">
        <rect class="wall" x="-14" y="-14" width="28" height="14" />
        <polygon class="roof" points="-18,-14 0,-28 18,-14" />
        <rect class="door" x="-2.5" y="-8" width="5" height="8" />
        <circle class="glow" cx="-8" cy="-8" r="8" />
        <rect class="win" x="-11.5" y="-11" width="6" height="6" rx="1" />
        <rect class="win" x="5.5" y="-11" width="6" height="6" rx="1" />
      </g>
    </g>
  );
}

/**
 * The Today hero artwork. One SVG: shapes take their colors from CSS variables set per
 * [data-scene], so day / dusk / night cross-fade instead of swapping. Motion is CSS-only
 * (transform + opacity) and is switched off by prefers-reduced-motion.
 */
export function Scene({ scene, mood, flowers, village, calm }: Props) {
  return (
    <div class={'scn' + (calm ? ' calm' : '')} data-scene={scene} data-mood={mood} data-v={village} aria-hidden="true">
      <div class="sky sky-day" />
      <div class="sky sky-dusk" />
      <div class="sky sky-night" />
      <svg viewBox="0 0 400 340" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <linearGradient id="scn-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity=".42" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
          <radialGradient id="scn-fire">
            <stop offset="0" stop-color="#FFB347" stop-opacity=".75" />
            <stop offset="1" stop-color="#FFB347" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="scn-glow">
            <stop offset="0" stop-color="#FFD36B" stop-opacity=".9" />
            <stop offset="1" stop-color="#FFD36B" stop-opacity="0" />
          </radialGradient>
        </defs>

        {/* sky bodies */}
        <g class="stars">
          {STARS.map((st, i) => (
            <circle
              key={i} class={'star' + (st[3] ? ' hi' : '')} cx={st[0]} cy={st[1]} r={st[2]}
              style={{ animationDelay: -((i * 0.73) % 4).toFixed(2) + 's' }}
            />
          ))}
        </g>
        <g class="shoot"><path d="M0 0L-26 8" /></g>

        <g transform="translate(310 120)">
          <g class="sun">
            <circle r="46" class="sun0" />
            <circle r="32" class="sun1" />
            <circle r="21" class="sun2" />
          </g>
          <g class="moon">
            <circle r="32" class="mn0" />
            <circle r="18" class="mn1" />
            <circle cx="-5" cy="-4" r="3.2" class="mn2" />
            <circle cx="6" cy="6" r="4" class="mn2" />
            <circle cx="6" cy="-9" r="2.1" class="mn2" />
          </g>
        </g>

        <g class="rays">
          <polygon points="310,120 196,270 252,270" fill="url(#scn-ray)" />
          <polygon points="310,120 262,270 318,270" fill="url(#scn-ray)" />
          <polygon points="310,120 330,270 384,270" fill="url(#scn-ray)" />
        </g>

        {/* rainbow: clear days when you're on track */}
        <g class="rainbow" fill="none" stroke-width="4.5">
          <path d="M60 176A98 58 0 0 1 256 176" stroke="#FF6B6B" />
          <path d="M68 176A90 51 0 0 1 248 176" stroke="#FFB86B" />
          <path d="M76 176A82 44 0 0 1 240 176" stroke="#FFE66B" />
          <path d="M84 176A74 37 0 0 1 232 176" stroke="#6BD68A" />
          <path d="M92 176A66 30 0 0 1 224 176" stroke="#6BB6FF" />
        </g>

        <Cloud x={238} y={128} s={0.7} i={2} />
        <Cloud x={58} y={122} s={0.9} i={3} />

        {/* birds by day, dark silhouettes at dusk */}
        <g class="birds">
          <g transform="translate(0 116)"><g class="bird b1"><path d="M0 0q4-5 8 0q4-5 8 0" /></g></g>
          <g transform="translate(0 104)"><g class="bird b2"><path d="M0 0q3-4 6 0q3-4 6 0" /></g></g>
          <g transform="translate(0 128)"><g class="bird b3"><path d="M0 0q3-4 6 0q3-4 6 0" /></g></g>
        </g>

        {/* landscape */}
        <path class="m1" d="M-10 196L-10 150L40 120L78 144L128 98L182 150L226 124L284 166L336 112L410 152L410 220L-10 220Z" />
        <g class="snow">
          <path d="M128 98L116 112L123 109L128 115L134 108L141 112Z" />
          <path d="M40 120L31 131L36 129L41 133L46 128L51 131Z" />
          <path d="M336 112L326 124L332 122L337 126L343 121L348 124Z" />
        </g>
        <ellipse class="mist" cx="200" cy="178" rx="230" ry="10" />
        <path class="m2" d="M-10 188Q60 160 140 174T270 168Q340 160 410 176L410 250L-10 250Z" />

        {/* windmill */}
        <g transform="translate(70 166)">
          <path class="wmb" d="M-6 6L-3 -20L3 -20L6 6Z" />
          <polygon class="roof" points="-4,-20 0,-27 4,-20" />
          <g transform="translate(0 -21)">
            <g class="spin">
              <rect class="bl" x="-1.2" y="-24" width="2.4" height="24" />
              <rect class="bl" x="-1.2" y="0" width="2.4" height="24" />
              <rect class="bl" x="-24" y="-1.2" width="24" height="2.4" />
              <rect class="bl" x="0" y="-1.2" width="24" height="2.4" />
              <rect class="sail" x="1.6" y="-23" width="7" height="10" />
              <rect class="sail" x="-8.6" y="13" width="7" height="10" />
              <rect class="sail" x="-23" y="-8.6" width="10" height="7" />
              <rect class="sail" x="13" y="1.6" width="10" height="7" />
            </g>
            <circle r="2.4" class="roof" />
          </g>
        </g>

        {/* owl tree */}
        <Tree x={112} y={174} s={0.8} i={1} />
        <g class="owl" transform="translate(134 150)">
          <line class="brn" x1="-18" y1="2" x2="6" y2="2" />
          <ellipse class="owlb" cx="0" cy="-5" rx="5" ry="7" />
          <polygon class="owlb" points="-4,-11 -5,-16 -1,-12" />
          <polygon class="owlb" points="4,-11 5,-16 1,-12" />
          <g class="oe"><circle cx="-2" cy="-8" r="1.7" /><circle cx="2" cy="-8" r="1.7" /></g>
        </g>

        {/* cottage + chimney smoke */}
        <g transform="translate(182 172)">
          <rect class="wall" x="-15" y="-16" width="30" height="16" />
          <rect class="wall" x="7" y="-27" width="5" height="10" />
          <polygon class="roof" points="-19,-16 0,-32 19,-16" />
          <rect class="door" x="-2.5" y="-9" width="5" height="9" />
          <circle class="glow" cx="-9" cy="-9" r="9" />
          <rect class="win" x="-12" y="-12" width="6.4" height="6.4" rx="1" />
          <rect class="win" x="6" y="-12" width="6.4" height="6.4" rx="1" />
          <g class="smoke">
            <circle cx="9.5" cy="-30" r="2.6" />
            <circle cx="11" cy="-30" r="2.2" />
            <circle cx="8.5" cy="-30" r="1.8" />
          </g>
        </g>
        <House x={228} y={172} s={0.8} cls="v1" />
        <House x={336} y={172} s={0.85} cls="v2" />
        <House x={148} y={177} s={0.6} cls="v3" />

        <path class="m3" d="M-10 238Q90 222 200 236T410 230L410 340L-10 340Z" />

        {/* pond */}
        <ellipse class="pond" cx="118" cy="282" rx="66" ry="9" />
        <ellipse class="pondhi" cx="108" cy="279.5" rx="42" ry="2.4" />
        <ellipse class="refl" cx="138" cy="282" rx="10" ry="2" />
        <ellipse class="rip r1" cx="118" cy="282" rx="28" ry="4" />
        <ellipse class="rip r2" cx="118" cy="282" rx="28" ry="4" />

        {/* foreground */}
        <path class="fg" d={GRASS} />
        {FLOWERS.map((f, i) => (
          <g key={i} class={'fl' + (i < flowers ? ' on' : '')} transform={'translate(' + f[0] + ' ' + f[1] + ')'}>
            <line class="stem" x1="0" y1="0" x2="0" y2="12" />
            <circle cx="-3" cy="-1" r="3" fill={f[2]} /><circle cx="3" cy="-1" r="3" fill={f[2]} />
            <circle cx="0" cy="-4" r="3" fill={f[2]} /><circle cx="0" cy="2" r="3" fill={f[2]} />
            <circle cx="0" cy="-1" r="2" class="sfc" />
          </g>
        ))}

        {/* campfire (night) */}
        <g class="fire" transform="translate(212 302)">
          <circle class="fglow" r="40" cy="-8" fill="url(#scn-fire)" />
          <rect class="log" x="-9" y="-1" width="18" height="3.4" rx="1.6" transform="rotate(-14)" />
          <rect class="log" x="-9" y="-1" width="18" height="3.4" rx="1.6" transform="rotate(14)" />
          <g class="flame">
            <path d="M0 0Q-8-8-3-18Q0-11 3.5-15Q10-6 0 0Z" fill="#FF9A2E" />
            <path d="M0 0Q-4-5-1.4-10Q0-6 2-8Q5-3 0 0Z" fill="#FFE27A" />
          </g>
        </g>

        {/* fireflies */}
        <g class="flies">
          {FIREFLIES.map((f, i) => (
            <g key={i} transform={'translate(' + f[0] + ' ' + f[1] + ')'}>
              <g class={'fw f' + (i % 4)} style={{ animationDelay: -(i * 1.3).toFixed(1) + 's' }}>
                <circle r="6" fill="url(#scn-glow)" />
                <circle r="1.6" fill="#FFF3A8" />
              </g>
            </g>
          ))}
        </g>

        {/* paper lanterns drifting up at dusk */}
        <g class="lanterns">
          {[70, 160, 250, 340].map((x, i) => (
            <g key={x} transform={'translate(' + x + ' 0)'}>
              <g class={'lan l' + i}>
                <circle r="12" cy="0" fill="url(#scn-glow)" />
                <rect x="-4" y="-5.5" width="8" height="11" rx="3" fill="#FF9A4D" />
                <rect x="-2.2" y="-3" width="4.4" height="6" rx="2" fill="#FFE0A0" />
              </g>
            </g>
          ))}
        </g>

        {/* drizzle when over the limit */}
        <g class="rain">
          {Array.from({ length: 16 }, (_, i) => (
            <line key={i} x1={i * 26 + 4} y1="-20" x2={i * 26 - 1} y2="-6" style={{ animationDelay: -((i * 0.37) % 1.4).toFixed(2) + 's' }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
