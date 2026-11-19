import { getState } from '../state/index.ts';
import { CTIPS, cravClock, cravSubline, cravTipIndex, CRAVE_MS } from '../lib/craving.ts';
import { logCraving, toggleCrave } from '../actions/craving.ts';

const ICON = {
  timer: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7" /><path d="M12 9.5v4l2.6 1.6M9.5 3h5" /></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.4-2.9 7.6-7 9.5-4.1-1.9-7-5.1-7-9.5V6z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.6" /></svg>,
  bulb: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></svg>,
};

/**
 * "Quick actions" card: wait it out (live countdown + tip), log a craving I got through, craving tips.
 * Same behaviour as the old craving card; the parent re-renders it every second (useTick) and on every save.
 * Expiry is handled by useCraveWatch in the app shell, not here.
 */
export function QuickActions({ now }: { now: number }) {
  const s = getState();
  const end = s.craveEnd || 0;
  const r = end - now;
  const active = end > 0 && r > 0;
  const tip = active ? CTIPS[cravTipIndex(r)] : null;

  return (
    <div class="card qa" id="crave">
      <button class={'qrow' + (active ? ' on' : '')} id="cgo" type="button" onClick={toggleCrave}>
        <span class="qi q1">{ICON.timer}</span>
        <span class="qt">
          <b>{active ? 'Waiting it out' : 'Wait it out'}</b>
          <span class="k left" id="cvs">{cravSubline(active, s.reasons, s.waited)}</span>
        </span>
        <span class="qp" id="cv">{active ? cravClock(r) : cravClock(CRAVE_MS)}</span>
      </button>
      {tip && (
        <div id="cvt" class="cvt">
          <b>{tip[0]}.</b> {tip[1]}
          <div class="cl">
            <button type="button" onClick={() => { location.hash = '#tips'; }}>More tips</button>
            {!s.reasons && <button type="button" onClick={() => { location.hash = '#plan'; }}>Add your reasons for quitting</button>}
          </div>
        </div>
      )}
      <button class="qrow" id="clg" type="button" onClick={logCraving}>
        <span class="qi q2">{ICON.shield}</span>
        <span class="qt">
          <b>Log a craving I got through</b>
          <span class="k left">Counts as a win, no cigarette needed</span>
        </span>
        <span class="qp">{(s.waited || 0) + ' won'}</span>
      </button>
      <button class="qrow" id="tipsgo" type="button" onClick={() => { location.hash = '#tips'; }}>
        <span class="qi q3">{ICON.bulb}</span>
        <span class="qt">
          <b>Craving tips</b>
          <span class="k left">Quick ideas for when it hits</span>
        </span>
        <span class="qp">Open</span>
      </button>
    </div>
  );
}
