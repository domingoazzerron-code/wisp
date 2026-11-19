import { getState } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { countSince, liveIndex } from '../lib/current.ts';
import { gapData, spacingView } from '../lib/gaps.ts';
import { startOfDay } from '../lib/dates.ts';
import { money } from '../lib/format.ts';
import { per } from '../lib/streaks.ts';
import { CardArt } from './CardArt.tsx';

/**
 * "More about today" card: spacing challenge + spent today (legacy #more). Always open now, one of the Today cards.
 * Gap celebration side-effect is owned by useGapRecord (already in the app shell).
 */
export function MoreAboutToday({ now }: { now: number }) {
  useStore();
  useTick(1000);
  const s = getState();
  const gd = gapData(liveIndex, now);
  const td = startOfDay(now);
  const hasToday = s.log.some((t) => t >= td);
  const sp = spacingView(gd, s.log.length, hasToday);
  const t = countSince(1);
  const p = per(s);
  const spent = t * p;

  return (
    <div class="card tcard" id="more">
      <CardArt kind="spacing" pill={t + (t === 1 ? ' stick' : ' sticks')} />
      <div class="tbody">
      <div class="dh"><span class="bn">Spacing &amp; spending</span></div>
      <div id="spc">
        <div class="k lbl">Spacing challenge</div>
        <div class="big" id="spb">{sp.big}</div>
        <div class="k left" id="sps">{sp.sub}</div>
      </div>
      <div class="spent mt-d">
        <div>
          <div class="k lbl">Spent today</div>
          <div class="big" id="c1">{money(s.cur || '₱', spent)}</div>
        </div>
        <div class="sub" id="s1">{t + (t === 1 ? ' stick' : ' sticks')}</div>
      </div>
      </div>
    </div>
  );
}
