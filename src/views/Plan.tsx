import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { dayAdd, startOfDay } from '../lib/dates.ts';
import { dur, durS, money } from '../lib/format.ts';
import { lim, liveIndex, calcSaved, streak, bestStreak, lastTs } from '../lib/current.ts';
import { planSched } from '../lib/limits.ts';
import { evoInfo, FORM, EVT } from '../lib/evolution.ts';
import { mileDefs } from '../lib/milestones.ts';
import { CHT, type ChallengeId } from '../lib/challenges.ts';
import { cntBetween } from '../lib/streaks.ts';
import { GHOST_SVG } from '../components/ghost.ts';
import {
  clearQuitDay,
  holdPlanStep,
  setGoalAmt,
  setGoalName,
  setPlanField,
  setPlanOn,
  setQuitDay,
  setReasons,
} from '../actions/plan.ts';

type Tab = 'progress' | 'quit' | 'miles';

const HEALTH: [number, string, string][] = [
  [0.33, '20 minutes', 'Heart rate and blood pressure start to drop'],
  [8, '8 hours', 'Oxygen in your blood rises toward normal'],
  [12, '12 hours', 'Carbon monoxide in your blood returns to normal'],
  [24, '1 day', 'Heart attack risk begins to fall'],
  [48, '2 days', 'Smell and taste start to improve'],
  [72, '3 days', 'Breathing gets easier'],
  [336, '2 weeks', 'Circulation and walking get easier'],
  [720, '1 month', 'Coughing and shortness of breath ease'],
  [8760, '1 year', 'Heart disease risk about half that of a smoker'],
];

function fd(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function quitValue(q: number | undefined): string {
  if (!q) return '';
  return new Date(q - new Date(q).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function MileRow(props: { on: boolean; title: string; body: string; right?: string }) {
  return (
    <div class={'ml' + (props.on ? ' on' : '')}>
      <span class="mi" aria-hidden="true">{props.on ? '✓' : ''}</span>
      <div class="mt">
        <b>{props.title}</b>
        <span>{props.body}</span>
      </div>
      <span class="md">{props.right || ''}</span>
    </div>
  );
}

/**
 * Plan view (step 7c): Progress, Quit plan, Milestones.
 */
export function Plan() {
  const fwmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = fwmRef.current;
    if (!root) return;
    // Future form: fully evolved Wisp (legacy renderFuture uses evSet(fm, 5)).
    root.querySelectorAll('.ev').forEach((el) => {
      const need = +((el as HTMLElement).getAttribute('data-ev') || 0);
      (el as HTMLElement).style.opacity = need <= 5 ? '1' : '0';
    });
  }, []);
  useStore();
  useTick(1000);
  const s = getState();
  const now = Date.now();
  const [tab, setTab] = useState<Tab>('progress');
  const segRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = segRef.current;
    if (!root) return;
    const on = root.querySelector('button.on') as HTMLElement | null;
    if (!on) return;
    root.style.setProperty('--w', on.offsetWidth + 'px');
    root.style.setProperty('--x', on.offsetLeft + 'px');
  }, [tab]);

  const hasLog = s.log.length > 0;
  const L = lim();
  const td = startOfDay(now);
  const P = s.plan;
  const q = P.quit || 0;
  const sc = planSched(s);
  const savedAmt = calcSaved();
  const sk = streak();
  const bs = bestStreak();
  const last = lastTs();
  const sorted = liveIndex.sorted();
  const first = sorted.length ? startOfDay(sorted[0]) : 0;

  // Smoke-free stretch
  let bestGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > bestGap) bestGap = sorted[i] - sorted[i - 1];
  }
  const curGap = sorted.length ? now - sorted[sorted.length - 1] : 0;
  if (curGap > bestGap) bestGap = curGap;

  // Quit plan summary
  let curStep = -1;
  if (sc) for (let i = 0; i < sc.length; i++) if (sc[i].d <= td) curStep = i;
  const nxt = sc ? sc[curStep + 1] : null;
  let qnext = '';
  if (q && q <= td) qnext = 'Your quit day has started. Every smoke-free day counts.';
  else if (q && (!nxt || nxt.d >= q)) qnext = 'Next: quit day on ' + fd(q) + ', when your limit drops to 0.';
  else if (nxt) qnext = 'Next step: ' + nxt.l + ' a day from ' + fd(nxt.d) + '.';
  else if (sc) qnext = 'You’ve reached your goal of ' + P.to + ' a day.';
  else qnext = 'No plan yet. Turn on step 1, pick a quit day in step 2, or just keep your limit from Settings.';

  const dl = q ? Math.round((q - td) / 864e5) : 0;
  const qinfo = q
    ? dl > 0
      ? 'Quit day is in ' + dl + ' day' + (dl > 1 ? 's' : '') + '. Until then your normal limit applies.'
      : 'Quit day has started. Your limit is 0 and every smoke-free day counts.'
    : 'Optional. From this date your limit becomes 0.';

  // Schedule rows + hold state
  let planInfo = '';
  let planRows: { d?: number; l?: number; now?: boolean; q?: boolean; mu?: boolean }[] = [];
  let pwarn = '';
  let activeHold: [number, number] | null = null;
  if (sc) {
    const ev = Math.max(1, P.every);
    planInfo =
      'Start at ' +
      P.from +
      ' a day. Every ' +
      ev +
      ' day' +
      (ev > 1 ? 's' : '') +
      ', lower by ' +
      Math.max(1, P.by) +
      ', until ' +
      P.to +
      (P.to === 0 ? ' (quit)' : '') +
      '. About ' +
      Math.round((sc[sc.length - 1].d - P.start) / 864e5) +
      ' days in all.';
    planRows = sc
      .map((x, k) => ({ d: x.d, l: x.l, now: k === curStep }))
      .filter((x) => !(q && x.d! >= q));
    if (q && q > td) planRows.push({ d: q, l: 0, q: true });
    if (planRows.length > 6) {
      planRows = planRows.slice(0, 3).concat([{ mu: true }], planRows.slice(-2));
    }
    let wl = -1;
    for (let i = 0; i < sc.length; i++) if (q && sc[i].d < q) wl = i;
    if (q && q > td && wl > -1 && sc[wl].l > 0) {
      pwarn =
        'Heads up: your quit day comes before the step-down reaches ' +
        P.to +
        '. On ' +
        fd(q) +
        ' your limit drops from ' +
        sc[wl].l +
        ' straight to 0.';
    }
    (P.holds || []).forEach((x) => {
      if (td >= x[0] && td < dayAdd(x[0], x[1])) activeHold = x;
    });
  }

  // Future Wisp
  const goal = P.on ? P.to : 0;
  const e = evoInfo(liveIndex, s.base, now);
  const es = s.evo || 0;
  let fwd = 'After 2 weeks of logs';
  let fws = 'Wisp needs two full weeks to see your pace. This is who he becomes when you get there.';
  if (first && first <= dayAdd(td, -14)) {
    const cur = cntBetween(liveIndex, dayAdd(td, -7), td) / 7;
    const prv = cntBetween(liveIndex, dayAdd(td, -14), dayAdd(td, -7)) / 7;
    const drop = prv - cur;
    if (cur <= goal) {
      fwd = 'Already there';
      fws = 'Your 7 day average is ' + cur.toFixed(1) + ' a day, at or under your goal of ' + goal + '.';
    } else if (drop > 0) {
      const wk = (cur - goal) / drop;
      if (wk > 104) {
        fwd = 'Not in sight yet';
        fws =
          'Down ' +
          drop.toFixed(1) +
          ' a day per week, but that is a long way to ' +
          goal +
          ' a day. Each week counts.';
      } else {
        const dt = new Date(td + Math.ceil(wk * 7) * 864e5);
        fwd = dt.toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: wk > 40 ? 'numeric' : undefined,
        });
        fws =
          'At your current pace (down ' +
          drop.toFixed(1) +
          ' a day each week) you reach ' +
          goal +
          ' a day here. This is how Wisp looks then.';
      }
    } else {
      fwd = 'Pace is flat';
      fws =
        'Your 7 day average is ' +
        cur.toFixed(1) +
        ' a day, no lower than the week before. Cut a little and Wisp shows you a date.';
    }
  } else if (P.on) {
    const steps = Math.ceil(Math.max(0, P.from - P.to) / Math.max(P.by, 1));
    const total = steps * Math.max(1, P.every);
    const el = Math.round((td - P.start) / 864e5);
    const rem = Math.max(0, total - el);
    if (rem === 0) {
      fwd = 'Already there';
      fws = 'You have reached your quit plan goal of ' + P.to + ' a day.';
    } else {
      fwd = new Date(td + rem * 864e5).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: rem > 300 ? 'numeric' : undefined,
      });
      fws = 'Following your quit plan. After two weeks of logs, Wisp switches to your real pace.';
    }
  }
  let fwn = '';
  if (e.avg === null) fwn = 'Wisp can evolve after a full week of tracking. Now: ' + FORM[es] + '.';
  else if (es >= 5) fwn = 'Now: ' + FORM[es] + '. Fully evolved.';
  else {
    fwn =
      'Now: ' +
      FORM[es] +
      '. Next, ' +
      FORM[es + 1] +
      ': 7 day average ' +
      (es + 1 === 5
        ? 'of 0'
        : es + 1 === 1
          ? 'under ' + s.base
          : 'at or under ' + +(s.base * EVT[es + 1]).toFixed(1)) +
      ' a day (currently ' +
      e.avg.toFixed(1) +
      ').';
  }

  // Goal bar
  const g = s.goal;
  const gp = g.amt > 0 ? Math.min(1, savedAmt / g.amt) : 0;

  // Miles
  const miles = mileDefs({
    now,
    lastTs: last,
    streak: sk,
    savedAmt,
    goalAmt: g.amt,
    goalName: g.name || 'your goal',
    hasLog,
  });
  const hrs = curGap / 36e5;
  const badgeKeys = Object.keys(s.badges || {}).sort(
    (a, b) => (s.badges[b] || 0) - (s.badges[a] || 0),
  );

  return (
    <section class="view" id="v-plan">
      <div class="seg top-seg" data-tabs="plan" role="group" aria-label="Plan sections" ref={segRef}>
        <button type="button" class={tab === 'progress' ? 'on' : ''} onClick={() => setTab('progress')}>
          Progress
        </button>
        <button type="button" class={tab === 'quit' ? 'on' : ''} onClick={() => setTab('quit')}>
          Quit plan
        </button>
        <button type="button" class={tab === 'miles' ? 'on' : ''} onClick={() => setTab('miles')}>
          Milestones
        </button>
      </div>

      {tab === 'progress' && (
        <div data-tab="plan" data-k="progress">
          {!hasLog && (
            <div class="card empty emp">
              <b>Your progress starts with your first log</b>
              <div class="k">
                Smoke-free time and streaks appear after your first entry. You can set a savings goal below any time.
              </div>
            </div>
          )}

          <div class="card">
            <div class="k">Future Wisp</div>
            <div class="fwrow">
              <div class="fwp">
                <div
                  id="fwm"
                  ref={fwmRef}
                  style={{ '--s': '0' } as any}
                  data-stage={5}
                  dangerouslySetInnerHTML={{ __html: GHOST_SVG }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div class="big">{fwd}</div>
                <div class="k left">{fws}</div>
                <div class="k left u-mt6">{fwn}</div>
              </div>
            </div>
          </div>

          <div class="card dat">
            <div class="k">Smoke-free stretch</div>
            <div class="big">{hasLog ? durS(curGap) : 'None logged yet'}</div>
            <div class="k left">
              {hasLog ? 'Longest stretch: ' + dur(bestGap) : 'Log your first one to start the timer.'}
            </div>
          </div>

          <div class="card dat">
            <div class="k">Days under your limit in a row</div>
            <div class="big">{sk + (sk === 1 ? ' day' : ' days')}</div>
            <div class="k left">
              {(bs > sk ? 'Best so far: ' + bs + (bs === 1 ? ' day' : ' days') + '. ' : '') +
                'A slip happens. Log it honestly and keep going.'}
            </div>
          </div>

          <div class="card">
            <div class="k">Savings goal</div>
            <label>
              Saving for
              <input
                type="text"
                placeholder="e.g. Shoes"
                value={g.name}
                onInput={(e) => setGoalName((e.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              Cost
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={g.amt || ''}
                onInput={(e) => setGoalAmt((e.target as HTMLInputElement).value)}
              />
            </label>
            <div class="tr">
              <div class="t">
                <span>
                  {g.amt > 0
                    ? money(s.cur, Math.min(savedAmt, g.amt)) +
                      ' of ' +
                      money(s.cur, g.amt) +
                      (g.name ? ' for ' + g.name : '')
                    : 'Set a goal to see progress'}
                </span>
                <span>{g.amt > 0 ? Math.round(gp * 100) + '%' : ''}</span>
              </div>
              <div
                class="b"
                role="progressbar"
                aria-label="Savings goal"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(gp * 100)}
              >
                <i style={{ width: gp * 100 + '%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'quit' && (
        <div data-tab="plan" data-k="quit">
          <div class="card" id="qsum">
            <div class="k">Today’s limit</div>
            <div class="big">{L > 0 ? L + ' a day' : '0. Smoke-free'}</div>
            <div class="k left">{qnext}</div>
          </div>

          <div class="card">
            <div class="k">1. Cut down gradually</div>
            <div class="k left u-mb4">
              Your limit steps down on its own, so you ease off instead of stopping all at once.
            </div>
            <label>
              Turn on
              <input
                type="checkbox"
                role="switch"
                checked={!!P.on}
                onChange={(e) => setPlanOn((e.target as HTMLInputElement).checked)}
              />
            </label>
            {P.on && (
              <div id="pf">
                <label>
                  <span>
                    Start at<small>Cigarettes a day</small>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={P.from}
                    onInput={(e) => setPlanField('from', (e.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>
                    Lower by<small>Cigarettes each step</small>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={P.by}
                    onInput={(e) => setPlanField('by', (e.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>
                    Every<small>Days between steps</small>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={P.every}
                    onInput={(e) => setPlanField('every', (e.target as HTMLInputElement).value)}
                  />
                </label>
                <label>
                  <span>
                    Until you reach<small>Cigarettes a day, 0 means quit</small>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={P.to}
                    onInput={(e) => setPlanField('to', (e.target as HTMLInputElement).value)}
                  />
                </label>
                <div class="k left u-mt8">{planInfo}</div>
                <div class="ppv">
                  {planRows.map((x, i) =>
                    x.mu ? (
                      <div class="mu" key={'mu' + i}>
                        …
                      </div>
                    ) : (
                      <div class={x.now ? 'now' : ''} key={(x.d || 0) + '-' + i}>
                        <span>
                          {x.now ? 'Now' : x.q ? 'Quit day, ' + fd(x.d!) : 'From ' + fd(x.d!)}
                        </span>
                        <span>{x.l} a day</span>
                      </div>
                    ),
                  )}
                </div>
                <div class="btnrow">
                  {!activeHold && nxt && !(q && q <= td) && (
                    <button class="btn ter sm" type="button" onClick={() => holdPlanStep()}>
                      Hold at {L} a day for {Math.max(1, P.every)} more days
                    </button>
                  )}
                </div>
                {activeHold && (
                  <div class="k left u-mt6">
                    On hold until {fd(dayAdd(activeHold[0], activeHold[1]))}. Your next step moves back by the
                    same amount.
                  </div>
                )}
              </div>
            )}
          </div>

          <div class="card">
            <div class="k">2. Pick a quit day (optional)</div>
            <label>
              Quit on
              <input
                type="date"
                value={quitValue(q)}
                onChange={(e) => setQuitDay((e.target as HTMLInputElement).value)}
              />
            </label>
            <div class="k left">{qinfo}</div>
            {pwarn && (
              <div class="k left" style={{ color: 'var(--warn)', marginTop: 6 }}>
                {pwarn}
              </div>
            )}
            {!!q && (
              <div class="btnrow">
                <button class="btn txt sm" type="button" onClick={() => clearQuitDay()}>
                  Remove quit day
                </button>
              </div>
            )}
          </div>

          <div class="card">
            <div class="k">My reasons for quitting</div>
            <textarea
              rows={2}
              maxlength={200}
              placeholder="Why are you doing this?"
              value={s.reasons || ''}
              onInput={(e) => setReasons((e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>
      )}

      {tab === 'miles' && (
        <div data-tab="plan" data-k="miles">
          <div class="card list">
            <div class="eyebrow">Health milestones</div>
            {HEALTH.map((m) => (
              <MileRow key={m[1]} on={hasLog && hrs >= m[0]} title={m[1]} body={m[2]} />
            ))}
            <div class="k note" style={{ padding: '4px 0 14px' }}>
              General guidance, not medical advice.
            </div>
          </div>

          <div class="card list">
            <div class="eyebrow">Achievements</div>
            <div class="k note" style={{ padding: '0 0 4px' }}>
              {Object.keys(s.mile || {}).length} of {miles.length} reached
            </div>
            {miles.map((m) => {
              const d = s.mile[m.id];
              const on = !!d;
              return (
                <MileRow
                  key={m.id}
                  on={on}
                  title={m.title}
                  body={m.body}
                  right={
                    on && d > 1
                      ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : ''
                  }
                />
              );
            })}
          </div>

          <div class="card list">
            <div class="eyebrow">Challenge badges</div>
            {badgeKeys.length === 0 ? (
              <div class="k note" style={{ padding: '0 0 14px' }}>
                Finish a 3 or 7 day challenge from Today to earn your first badge.
              </div>
            ) : (
              badgeKeys.map((k) => {
                const p = k.split('-');
                const T = CHT[p[0] as ChallengeId];
                if (!T) return null;
                return (
                  <MileRow
                    key={k}
                    on
                    title={T.n}
                    body={p[1] + ' day challenge'}
                    right={new Date(s.badges[k]).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
