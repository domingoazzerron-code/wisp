import { useRef } from 'preact/hooks';
import { heroStatus, lastLine, gapLine, paceProjection, progressPct } from '../lib/today.ts';

interface Props {
  count: number;
  limit: number;
  quitActive: boolean;
  canUndo: boolean;
  last: number;
  gapMin: number;
  gapBase: number;
  now: number;
  craving: boolean;
  onUndo: () => void;
  onWait: () => void;
}

/** The big number, status line, progress bar and the small facts under it. */
export function Hero({ count, limit, quitActive, canUndo, last, gapMin, gapBase, now, craving, onUndo, onWait }: Props) {
  const prev = useRef<number | null>(null);
  const dir = prev.current === null || prev.current === count ? '' : count > prev.current ? 'rup' : 'rdn';
  prev.current = count;

  const { cls, msg } = heroStatus(count, limit, quitActive);
  const pct = progressPct(count, limit);
  const d = new Date(now);
  const pace = paceProjection(count, limit, d.getHours(), d.getMinutes());
  const gap = gapLine(gapMin, gapBase, now);

  return (
    <div class={'card hero ' + cls} id="hero">
      <div class="hrow">
        {/* key restarts the CSS animation each time the number changes */}
        <div class={'n ' + dir} id="n" key={count}>{count}</div>
        <div class="hx">
          <div class="of">{limit > 0 ? 'of ' + limit + ' allowed' : 'no limit set'}</div>
          <div class="status" role="status" aria-live="polite">{msg}</div>
        </div>
        <button class="btn sec sm" type="button" disabled={!canUndo} onClick={onUndo}>Undo last</button>
      </div>
      <div
        class="pb" role="progressbar" aria-label="Cigarettes today against your limit" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(pct)} aria-valuetext={limit > 0 ? count + ' of ' + limit + ' allowed' : count + ' logged, no limit set'}
      >
        <i style={{ width: pct + '%' }} />
      </div>
      <div class="facts">
        <div class="last">{lastLine(last, now)}</div>
        <div class="last">{gap}</div>
        <div class="last" id="pace">
          {pace ? 'On pace for ' + pace.projected + ' today' + (pace.over ? ', over your limit of ' + limit : '') : ''}
          {pace && pace.over && (craving
            ? ' \u00b7 timer running'
            : <>{' '}<button class="btn ter sm" id="pw" type="button" onClick={onWait}>Wait it out</button></>)}
        </div>
      </div>
    </div>
  );
}
