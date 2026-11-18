import { useEffect } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { checkMission, ensureTodayMission, markMissionDone, swapMission } from '../actions/mission.ts';
import { liveIndex } from '../lib/current.ts';
import { missionCtx, missionView } from '../lib/missions.ts';

const STAR_SVG = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  </svg>
);

/**
 * Daily mission card + star count (legacy #mis / #stb).
 * Stars button and "Spend stars on Wisp" open the wardrobe (6c-3).
 */
export function MissionCard({ now, onOpenWardrobe }: { now: number; onOpenWardrobe?: () => void }) {
  useStore();
  const s = getState();

  useEffect(() => {
    ensureTodayMission(now);
    checkMission(now);
  }, [now]);

  const ctx = missionCtx(s, liveIndex, now);
  const view = missionView(s.mis, ctx);
  if (!view) return null;

  const stars = s.stars || 0;
  const open = () => { if (onOpenWardrobe) onOpenWardrobe(); };

  return (
    <div class={'card mis' + (view.done ? ' ok' : '')} id="mis">
      <div class="dh">
        <span class="bn">Today’s mission</span>
        <button
          class="stb"
          id="stb"
          type="button"
          aria-label="Your stars. Open Wisp’s wardrobe"
          onClick={open}
        >
          {STAR_SVG}
          <b id="stn">{stars}</b>
        </button>
      </div>
      <div class="mtx" id="mtx">{view.title}</div>
      <div class="k left" id="mst" role="status">{view.sub}</div>
      <div class="btnrow" id="mbr">
        {view.done ? (
          <button class="btn ter sm" type="button" onClick={open}>
            Spend stars on Wisp
          </button>
        ) : view.bad ? (
          view.canSwap ? (
            <button class="btn pri sm" type="button" onClick={() => swapMission(now)}>
              Try another
            </button>
          ) : null
        ) : (
          <>
            {view.canMark ? (
              <button class="btn pri sm" type="button" onClick={() => markMissionDone()}>
                Mark done
              </button>
            ) : null}
            {view.canSwap ? (
              <button class="btn sec sm" type="button" onClick={() => swapMission(now)}>
                Swap
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
