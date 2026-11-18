import { getState } from '../state/index.ts';
import { CTIPS, cravClock, cravSubline, cravTipIndex, CRAVE_MS } from '../lib/craving.ts';
import { logCraving, toggleCrave } from '../actions/craving.ts';

/**
 * "Craving? Wait it out" card (legacy markup line ~622, `crv()`, `cravTip()`).
 * The parent re-renders it every second (useTick) and on every save (useStore).
 * Expiry is handled by useCraveWatch in the app shell, not here.
 */
export function CravingCard({ now }: { now: number }) {
  const s = getState();
  const end = s.craveEnd || 0;
  const r = end - now;
  const active = end > 0 && r > 0;
  const tip = active ? CTIPS[cravTipIndex(r)] : null;

  return (
    <div class="card" id="crave">
      <div class="k">Craving? Wait it out</div>
      <div class="crow">
        <div>
          <div class="big" id="cv">{active ? cravClock(r) : cravClock(CRAVE_MS)}</div>
          <div class="k left" id="cvs">{cravSubline(active, s.reasons, s.waited)}</div>
        </div>
        <button class={'btn ' + (active ? 'sec' : 'pri')} id="cgo" type="button" onClick={toggleCrave}>
          {active ? 'Cancel' : 'Start wait'}
        </button>
      </div>
      {tip && (
        <div id="cvt" class="cvt">
          <b>{tip[0]}.</b> {tip[1]}
          <div class="cl">
            <button type="button" onClick={() => { location.hash = '#tips'; }}>More tips</button>
            {/* legacy then clicks the "quit" tab of the plan view (step 7); for now it only opens #plan */}
            {!s.reasons && <button type="button" onClick={() => { location.hash = '#plan'; }}>Add your reasons for quitting</button>}
          </div>
        </div>
      )}
      <button class="btn ter sm blk" id="clg" type="button" onClick={logCraving}>Log a craving I got through</button>
    </div>
  );
}
