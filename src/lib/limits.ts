// Daily limit and quit-plan math (legacy limFor, limitOn, setLimit, lim, planE, planSched).
// Pure: state is a parameter, "now" is a parameter. Only setLimit mutates (like legacy, it edits the state in place).

import type { Plan, State } from '../state/types.ts';
import { dayAdd, startOfDay, DAY_MS } from './dates.ts';

/** Plan day number for `day`: days since plan start minus the days paused by holds. */
export function planE(plan: Plan, day: number): number {
  let e = Math.round((day - plan.start) / DAY_MS);
  for (const x of plan.holds || []) {
    e -= Math.min(x[1], Math.max(0, Math.round((day - x[0]) / DAY_MS)));
  }
  return e;
}

/** The manual limit in force on `day`, from the limit history (falls back to the current limit). */
export function limitOn(s: Pick<State, 'limH' | 'limit'>, day: number): number {
  const h = s.limH;
  let v: number | null = null;
  for (let i = 0; i < h.length; i++) {
    if (h[i][0] <= day) v = h[i][1]; else break;
  }
  return v === null ? s.limit : v;
}

/** The limit for `day`: 0 from the quit day, the plan step while a plan runs, else the manual limit. */
export function limFor(s: Pick<State, 'limH' | 'limit' | 'plan'>, day: number): number {
  const P = s.plan;
  if (P && P.quit && day >= P.quit) return 0;
  if (P && P.on && P.start && day >= P.start) {
    const st = Math.floor(planE(P, day) / Math.max(1, P.every)) * Math.max(1, P.by);
    return Math.max(P.to, P.from - st);
  }
  return limitOn(s, day);
}

/** Today's limit. */
export function lim(s: Pick<State, 'limH' | 'limit' | 'plan'>, now: number): number {
  return limFor(s, startOfDay(now));
}

/** Changes the manual limit and records it in the limit history (MUTATES s). */
export function setLimit(s: Pick<State, 'limH' | 'limit' | 'log'>, v: number, now: number): void {
  const td = startOfDay(now);
  const h = s.limH;
  if (v === s.limit) return;
  if (s.log.length) {
    if (!h.length) h.push([0, s.limit]);
    if (h.length && h[h.length - 1][0] === td) h[h.length - 1][1] = v;
    else h.push([td, v]);
  }
  s.limit = v;
}

export interface PlanStep { d: number; l: number }

/** The plan's step-down schedule: the first day of each step and its limit. null when no plan is running. */
export function planSched(s: Pick<State, 'plan'>): PlanStep[] | null {
  const P = s.plan;
  if (!P.on || !P.start) return null;
  const ev = Math.max(1, P.every);
  const by = Math.max(1, P.by);
  const n = Math.ceil(Math.max(0, P.from - P.to) / by);
  const a: PlanStep[] = [];
  let i = 0;
  let d = P.start;
  let g = 0;
  while (i <= n && g++ < 3000) {
    if (Math.floor(planE(P, d) / ev) >= i) {
      a.push({ d, l: Math.max(P.to, P.from - i * by) });
      i++;
      continue;
    }
    d = dayAdd(d, 1);
  }
  return a;
}
