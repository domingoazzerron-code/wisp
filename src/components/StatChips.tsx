import { dur } from '../lib/format.ts';
import { money } from '../lib/format.ts';
import { paceProjection } from '../lib/today.ts';

interface Props {
  now: number;
  count: number;
  limit: number;
  last: number;      // ts of newest log, 0 when none
  gapMin: number;
  gapBase: number;
  spent: number;
  saved: number;
  cur: string;
}

const ICON = {
  clock: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  pace: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></svg>,
  coin: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.5c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.5-2.7-1.4M12 6.8v1.5m0 7.4v1.5" /></svg>,
  leaf: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 4-13 14-14 0 9-4 14-12 14" /><path d="M5 19c2-4 5-7 9-9" /></svg>,
};

/** Pastel stat chips that overlap the bottom of the hero and scroll sideways. */
export function StatChips({ now, count, limit, last, gapMin, gapBase, spent, saved, cur }: Props) {
  const d = new Date(now);
  const pace = paceProjection(count, limit, d.getHours(), d.getMinutes());
  const gapLeft = gapMin > 0 && gapBase ? gapBase + gapMin * 6e4 - now : 0;

  let c2l = limit > 0 ? 'Limit today' : 'Limit';
  let c2v = limit > 0 ? limit + ' allowed' : 'Not set';
  if (gapMin > 0 && gapBase) {
    c2l = gapLeft > 0 ? 'Next one in' : 'Gap';
    c2v = gapLeft > 0 ? dur(gapLeft) : 'Reached';
  } else if (pace) {
    c2l = 'On pace for';
    c2v = pace.projected + ' today';
  }

  return (
    <div class="statrow" id="statrow" role="list">
      <div class="stat st1" role="listitem">
        <span class="sti">{ICON.clock}</span>
        <span><small>Last one</small><b id="stat-last">{last ? dur(now - last) + ' ago' : 'None yet'}</b></span>
      </div>
      <div class="stat st2" role="listitem">
        <span class="sti">{ICON.pace}</span>
        <span><small>{c2l}</small><b>{c2v}</b></span>
      </div>
      <div class="stat st3" role="listitem">
        <span class="sti">{ICON.coin}</span>
        <span><small>Spent today</small><b>{money(cur, spent)}</b></span>
      </div>
      <div class="stat st4" role="listitem">
        <span class="sti">{ICON.leaf}</span>
        <span><small>Saved so far</small><b>{money(cur, Math.max(0, saved))}</b></span>
      </div>
    </div>
  );
}
