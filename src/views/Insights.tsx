import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState, save, dayCounts } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { lim, liveIndex } from '../lib/current.ts';
import { per } from '../lib/streaks.ts';
import { dur } from '../lib/format.ts';
import {
  diaryLabel,
  ensureDiary,
  recapInfo,
  weekCard,
} from '../lib/diary.ts';
import {
  avgGapMs,
  cravingCompare,
  dayBars,
  dayChartSvg,
  heatDays,
  moneyTiles,
  peakHours,
  tagCounts,
  weekCompare,
  type Rng,
} from '../lib/insights.ts';

type Tab = 'over' | 'pat' | 'money';

const ICON = {
  clock: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5.5c0 4.4-2.9 7.6-7 9.5-4.1-1.9-7-5.1-7-9.5V6z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.6" /></svg>,
};

/**
 * Insights view (step 7d): Overview, Patterns, Money & health.
 * Includes diary, last-week card, and weekly recap (share opens Summary share).
 */
export function Insights() {
  useStore();
  const s = getState();
  const now = Date.now();
  const rng = (s.rng === 30 || s.rng === 90 ? s.rng : 7) as Rng;
  const [tab, setTab] = useState<Tab>('over');
  const segRef = useRef<HTMLDivElement>(null);
  const rngRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    for (const root of [segRef.current, rngRef.current]) {
      if (!root) continue;
      const on = root.querySelector('button.on') as HTMLElement | null;
      if (!on) continue;
      root.style.setProperty('--w', on.offsetWidth + 'px');
      root.style.setProperty('--x', on.offsetLeft + 'px');
    }
  }, [tab, rng]);

  function setRng(r: Rng) {
    getState().rng = r;
    save();
  }

  // The 7 / 30 / 90 switch lives inside the chart card on Overview and at the top of the other tabs.
  const rangeSeg = (cls: string) => (
    <div class={'seg ' + cls} id="rng" role="group" aria-label="Time range" ref={rngRef}>
      {([7, 30, 90] as Rng[]).map((r) => (
        <button type="button" key={r} data-r={r} class={rng === r ? 'on' : ''} aria-pressed={rng === r} onClick={() => setRng(r)}>
          {r} days
        </button>
      ))}
    </div>
  );

  const hasData = s.log.length > 0 || (s.cravs && s.cravs.length > 0);
  const L = lim();
  const counts = dayCounts();
  const bars = dayBars(s, counts, rng, now);
  const chartSvg = dayChartSvg(bars, L);
  const avg = avgGapMs(s.log, rng, now);
  const wk = weekCompare(liveIndex, rng, now, s.cur, per(s));
  const crv = cravingCompare(s.cravs || [], rng, now);
  const peak = peakHours(s.log, rng, now);
  const trig = tagCounts(s.log, s.tags || {}, rng, now);
  const crTrig = tagCounts(s.cravs || [], s.crt || {}, rng, now);
  const heat = heatDays(counts, L, now);
  const money = moneyTiles(liveIndex, s, rng, now);
  const maxTrig = trig.length ? trig[0][1] : 1;
  const maxCr = crTrig.length ? crTrig[0][1] : 1;

  const diary = ensureDiary(s, now);
  const week = weekCard(s, liveIndex, counts, now);
  const recap = recapInfo(s, liveIndex, counts, now);

  useEffect(() => {
    if (!diary.dirty) return;
    const st = getState();
    const next: Record<string, string[]> = { ...(st.diary as Record<string, string[]>) };
    for (const k of diary.keys) next[String(k)] = diary.entries[k];
    st.diary = next;
    save();
  }, [diary.dirty, diary.keys.join(',')]);

  useEffect(() => {
    if (!recap || s.recapSeen === recap.ws) return;
    getState().recapSeen = recap.ws;
    save();
  }, [recap?.ws, s.recapSeen]);

  function shareWeek() {
    location.hash = '#summary';
    setTimeout(() => {
      const btn = document.querySelector('#v-summary .btn.pri') as HTMLButtonElement | null;
      btn?.click();
    }, 80);
  }

  return (
    <section class={'view' + (hasData ? '' : ' nodata')} id="v-insights">
      <div class="seg top-seg" data-tabs="ins" role="group" aria-label="Insight sections" ref={segRef}>
        <button type="button" class={tab === 'over' ? 'on' : ''} onClick={() => setTab('over')}>
          Overview
        </button>
        <button type="button" class={tab === 'pat' ? 'on' : ''} onClick={() => setTab('pat')}>
          Patterns
        </button>
        <button type="button" class={tab === 'money' ? 'on' : ''} onClick={() => setTab('money')}>
          Money &amp; health
        </button>
      </div>

      {tab !== 'over' && rangeSeg('u-mb12')}

      {tab === 'over' && (
        <div data-tab="ins" data-k="over">
          {!hasData && (
            <div class="card empty emp">
              <b>Your progress will show up here</b>
              <div class="k">
                Log a cigarette or a craving you got through, and this page fills in with your trend, a daily chart and
                your patterns.
              </div>
            </div>
          )}

          <div class="card ovh" id="ovh">
            <div class="dh">
              <span class="bn">Cigarettes per day</span>
            </div>
            {rangeSeg('rngin')}
            <div class="ovn">
              <span class="big">{wk.w1}</span>
              <span class="k">
                {wk.w1 === 1 ? 'cigarette' : 'cigarettes'} in the last {rng} days
              </span>
            </div>
            <div class={wk.verdictClass}>{wk.verdict}</div>
            <svg
              class="chart"
              viewBox="0 0 300 130"
              role="img"
              aria-label="Cigarettes per day chart"
              dangerouslySetInnerHTML={{ __html: chartSvg }}
            />
            <div class="lgs" aria-hidden="true">
              <span class="lg"><i />Within limit</span>
              <span class="lg"><i class="over" />Over limit</span>
              <span class="lg"><i class="dash" />Your limit</span>
            </div>
            <div class="k left">{wk.sub}</div>
          </div>

          <div class="ichips">
            <div class="stat st3" title={'Last ' + rng + ' days, overnight gaps left out'}>
              <span class="sti">{ICON.clock}</span>
              <span>
                <small>Average gap</small>
                <b>{avg != null ? dur(avg) : '\u2014'}</b>
                <em>{avg != null ? 'Overnight left out' : 'Not enough data yet'}</em>
              </span>
            </div>
            <div class="stat st1" title={crv.sub}>
              <span class="sti">{ICON.shield}</span>
              <span>
                <small>Cravings beaten</small>
                <b>{crv.c1}</b>
                <em>
                  {crv.c1 === 0 && crv.c2 === 0
                    ? 'Log one with the + button'
                    : crv.c1 > crv.c2
                      ? crv.c1 - crv.c2 + ' more than before'
                      : crv.c1 < crv.c2
                        ? crv.c2 - crv.c1 + ' fewer than before'
                        : 'Same as before'}
                </em>
              </span>
            </div>
          </div>

          {(recap || diary.keys.length > 0) && (
            <div class="card ws" id="rcc">
              <div class="dh">
                <span class="bn">Wisp says</span>
                <small>{diary.keys.length > 0 ? diaryLabel(diary.keys[0], now) : recap ? recap.range : ''}</small>
              </div>
              {diary.keys.length > 0 && (
                <div class="dia" id="dt">
                  {(diary.entries[diary.keys[0]] || []).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}
              {recap && (
                <div class="wsr">
                  <div class="k lbl">
                    {(recap.cur ? 'Your week' : 'Last week') + ' \u00b7 ' + recap.range}
                  </div>
                  <div class="rch">
                    <span class="big">{recap.hl.v}</span>
                    <span class="k">{recap.hl.u}</span>
                  </div>
                  <div class="rcs">
                    {recap.story.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  <div class="btnrow">
                    <button class="btn ter sm" type="button" onClick={shareWeek}>
                      Share this week
                    </button>
                  </div>
                </div>
              )}
              {week && (
                <details class="wsn" id="wkc">
                  <summary>{'Last week in numbers \u00b7 ' + week.range}</summary>
                  <div class="big">{week.tot} cigarettes</div>
                  <div class="k left" style={{ marginTop: 6, lineHeight: 1.6 }}>
                    {week.lines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </details>
              )}
              {diary.keys.length > 1 && (
                <details id="dp">
                  <summary>Earlier diary entries</summary>
                  <div id="dl">
                    {diary.keys.slice(1, 8).map((d) => (
                      <p key={d}>
                        <b>{diaryLabel(d, now)}</b>
                        <br />
                        {(diary.entries[d] || []).join(' ')}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'pat' && (
        <div data-tab="ins" data-k="pat">
          {!hasData && (
            <div class="card empty emp">
              <b>Patterns need a few days</b>
              <div class="k">
                After you have logged for a few days you will see your peak hours, your triggers and a 5 week calendar.
              </div>
            </div>
          )}

          <div class="card">
            <div class="k">Peak hours, last {rng} days</div>
            <div class="big" style={{ fontSize: 18, marginBottom: 8 }}>
              {peak.peakLabel}
            </div>
            <div class="k left" style={{ margin: '-4px 0 8px' }}>
              {peak.count
                ? 'Based on ' +
                  peak.count +
                  (peak.count === 1 ? ' entry' : ' entries') +
                  (peak.count < 10 ? '. More entries make this more accurate.' : '.')
                : ''}
            </div>
            {peak.tip && (
              <div class="k left" style={{ margin: '-2px 0 8px', color: 'var(--gt)' }}>
                {peak.tip}
              </div>
            )}
            <svg
              class="chart"
              viewBox="0 0 288 84"
              role="img"
              aria-label={peak.aria}
              dangerouslySetInnerHTML={{ __html: peak.hoursSvg }}
            />
          </div>

          <div class="card">
            <div class="k">Triggers, last {rng} days</div>
            {trig.length === 0 ? (
              <div class="k" style={{ marginTop: 6 }}>
                No triggers yet. When Wisp asks why you had one, your answer shows up here.
              </div>
            ) : (
              trig.map(([k, n]) => (
                <div class="tr" key={k}>
                  <div class="t">
                    <span>{k}</span>
                    <span>{n}</span>
                  </div>
                  <div class="b">
                    <i style={{ width: (n / maxTrig) * 100 + '%' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div class="card">
            <div class="k">Craving triggers, last {rng} days</div>
            {crTrig.length === 0 ? (
              <div class="k" style={{ marginTop: 6 }}>
                No craving triggers yet. After you wait one out, pick what set it off, or add one in History &gt;
                Cravings.
              </div>
            ) : (
              crTrig.map(([k, n]) => (
                <div class="tr" key={k}>
                  <div class="t">
                    <span>{k}</span>
                    <span>{n}</span>
                  </div>
                  <div class="b">
                    <i style={{ width: (n / maxCr) * 100 + '%' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div class="card">
            <div class="k">Last 5 weeks</div>
            <div class="heat" role="img" aria-label={heat.aria}>
              {heat.days.map((d) =>
                d.count ? (
                  <i
                    key={d.ts}
                    class="d"
                    style={{ opacity: d.opacity }}
                    title={d.title}
                  />
                ) : (
                  <i key={d.ts} title={d.title} />
                ),
              )}
            </div>
            <div class="legend">
              <span>Fewer</span>
              <i />
              <i style={{ opacity: 0.3 }} />
              <i style={{ opacity: 0.65 }} />
              <i />
              <span>More</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'money' && (
        <div data-tab="ins" data-k="money">
          {!s.conf && (
            <div class="card">
              <div class="k left">
                These savings and spending figures use example numbers ({s.base} a day, {s.cur}
                {s.pack} a pack, {s.per} to a pack). Enter yours so they are accurate.
              </div>
              <div class="btnrow">
                <a class="btn ter sm" href="#setup/limits">
                  Enter my numbers
                </a>
              </div>
            </div>
          )}
          {!s.log.length && (
            <div class="card empty emp">
              <b>Your savings start here</b>
              <div class="k">
                Set your pack price in Settings, then log honestly. This page tracks what you spend, what you save, and
                your nicotine and tar.
              </div>
              <a class="btn ter sm u-mt12" href="#setup/limits">
                Open settings
              </a>
            </div>
          )}

          <div class="tiles">
            <div class="tile">
              <div class="k">Today</div>
              <div class="v">{money.todayM}</div>
              <div class="sub">{money.todayC} sticks</div>
            </div>
            <div class="tile">
              <div class="k">Last {rng} days</div>
              <div class="v">{money.rangeM}</div>
              <div class="sub">{money.rangeC} sticks</div>
            </div>
            <div class="tile">
              <div class="k">This month</div>
              <div class="v">{money.monthM}</div>
              <div class="sub">{money.monthC} sticks</div>
            </div>
          </div>

          <div class="card">
            <div class="k">Saved compared with your usual</div>
            <div class="big">{money.savedLabel}</div>
            <div class="k left">{money.savedSub}</div>
          </div>

          <div class="card">
            <div class="k">Rough nicotine and tar estimate</div>
            <div class="big" style={{ fontSize: 24 }}>
              {money.nt}
            </div>
            <div class="k left">{money.ntSub}</div>
          </div>
        </div>
      )}
    </section>
  );
}
