import { getState, save } from '../state/index.ts';
import { startOfDay } from '../lib/dates.ts';
import { lim } from '../lib/current.ts';
import { toast } from '../components/Toasts.tsx';

/** Turn the quit plan on or off (legacy pon). When turning on, seed start/from/holds. */
export function setPlanOn(on: boolean): void {
  const s = getState();
  s.plan.on = on;
  if (on) {
    s.plan.start = startOfDay(Date.now());
    s.plan.holds = [];
    s.plan.from = s.limit || s.plan.from || 10;
  }
  save();
}

/** Patch a numeric plan field (from / to / by / every). */
export function setPlanField(key: 'from' | 'to' | 'by' | 'every', raw: string): void {
  const s = getState();
  let v = parseFloat(raw);
  if (isNaN(v) || v < 0) v = 0;
  if ((key === 'by' || key === 'every') && v < 1) v = 1;
  s.plan[key] = v;
  save();
}

/** Set or clear quit day from a YYYY-MM-DD string (legacy pquit). */
export function setQuitDay(ymd: string): void {
  const s = getState();
  if (!ymd) {
    s.plan.quit = 0;
  } else {
    const p = ymd.split('-');
    s.plan.quit = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  save();
}

export function clearQuitDay(): void {
  getState().plan.quit = 0;
  save();
}

/** Hold the current limit for one more plan step (legacy phold). */
export function holdPlanStep(): void {
  const s = getState();
  const td = startOfDay(Date.now());
  const ev = Math.max(1, s.plan.every);
  const h: [number, number] = [td, ev];
  s.plan.holds = (s.plan.holds || []).concat([h]);
  save();
  toast(
    'Holding at ' + lim() + ' a day for ' + ev + ' days',
    'Undo',
    () => {
      const i = s.plan.holds.indexOf(h);
      if (i > -1) s.plan.holds.splice(i, 1);
      save();
    },
  );
}

export function setGoalName(name: string): void {
  getState().goal.name = name;
  save();
}

export function setGoalAmt(raw: string): void {
  const s = getState();
  const v = parseFloat(raw);
  s.goal.amt = isNaN(v) || v < 0 ? 0 : v;
  save();
}

export function setReasons(text: string): void {
  getState().reasons = text.slice(0, 200);
  save();
}
