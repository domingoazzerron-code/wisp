import { getState } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { countSince, liveIndex } from '../lib/current.ts';
import { backupView, restartView, weekNudgeView } from '../lib/nudges.ts';
import {
  dismissRestart, markRecapSeen, setFreshQuitDay, snoozeBackup,
} from '../actions/nudges.ts';
import { isSignedIn } from '../sync/index.ts';

/**
 * Restart after quit, backup reminder, and weekly recap nudge (legacy #rst, #bkrem, #wkn).
 */
export function TodayNudges({ now }: { now: number }) {
  useStore();
  useTick(1000);
  const s = getState();
  const t = countSince(1);

  const rst = restartView(s.plan.quit, t, s.rsDay || 0, now);
  const first = s.log.length ? liveIndex.first() : 0;
  const bk = backupView(
    s.log.length,
    s.lastBackup || 0,
    Number.isFinite(first) ? first : 0,
    s.bkSnooze || 0,
    isSignedIn(),
    now,
  );
  const wk = weekNudgeView(s, liveIndex, now);

  return (
    <>
      {wk ? (
        <a
          class="card nudge"
          id="wkn"
          href="#insights"
          onClick={() => markRecapSeen(wk.ws)}
        >
          <span>
            <b id="wkn-t">{wk.title}</b>
            <span class="k" style={{ display: 'block' }} id="wkn-s">{wk.sub}</span>
          </span>
          <span class="btn ter sm">See it</span>
        </a>
      ) : null}

      {rst ? (
        <div class="card" id="rst">
          <div class="k left" id="rstt">{rst.text}</div>
          <div class="btnrow">
            <button class="btn pri sm" type="button" id="rsgo" onClick={() => setFreshQuitDay(now)}>
              Set a fresh quit day for tomorrow
            </button>
            <button class="btn txt sm" type="button" id="rsno" onClick={() => dismissRestart(now)}>
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {bk ? (
        <div class="card" id="bkrem">
          <div class="k left">Back up your data</div>
          <div id="bkt">{bk.text}</div>
          <div class="btnrow">
            <button
              class="btn pri sm"
              type="button"
              id="bkgo"
              onClick={() => { location.hash = '#setup'; }}
            >
              Back up now
            </button>
            <button class="btn txt sm" type="button" id="bkskip" onClick={() => snoozeBackup(now)}>
              Later
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
