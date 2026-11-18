import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { dayKey, startOfDay } from '../lib/dates.ts';
import { dur, money, tm } from '../lib/format.ts';
import { gapData } from '../lib/gaps.ts';
import { liveIndex } from '../lib/current.ts';
import { per } from '../lib/streaks.ts';
import { TAGS, pickTrigger } from '../components/Overlay.tsx';
import { deleteLogEntry, savePastEntry } from '../actions/log.ts';
import { deleteCraving, setCravingTrigger } from '../actions/craving.ts';

const PAGE = 30;

/** Local datetime-local value for an input (legacy loc). */
function loc(ts: number): string {
  return new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function dayLabel(key: string, firstTs: number, now: number): string {
  const td = dayKey(now);
  const yd = dayKey(now - 864e5);
  if (key === td) return 'Today';
  if (key === yd) return 'Yesterday';
  return new Date(firstTs).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/** Group timestamps by dayKey, newest days first. */
function groupByDay(timestamps: number[]): { key: string; items: number[] }[] {
  const by: Record<string, number[]> = {};
  const keys: string[] = [];
  for (let i = timestamps.length - 1; i >= 0; i--) {
    const ts = timestamps[i];
    const k = dayKey(ts);
    if (!by[k]) {
      by[k] = [];
      keys.push(k);
    }
    by[k].push(ts);
  }
  return keys.map((key) => ({
    key,
    items: by[key].slice().sort((a, b) => b - a),
  }));
}

const EditSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
);
const TrashSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);

/**
 * History view (step 7 first slice): cigarettes + cravings lists, past-entry form, edit/delete/trigger.
 */
export function History() {
  useStore();
  const s = getState();
  const now = Date.now();
  const [tab, setTab] = useState<'cig' | 'crav'>('cig');
  const [page, setPage] = useState(PAGE);
  const [editTs, setEditTs] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [when, setWhen] = useState(loc(now));
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');
  const segRef = useRef<HTMLDivElement>(null);

  // Nav "Add a past entry" dispatches this.
  useEffect(() => {
    const on = () => {
      setTab('cig');
      setEditTs(null);
      setWhen(loc(Date.now()));
      setMood('');
      setNote('');
      setFormOpen(true);
      setTimeout(() => {
        const el = document.getElementById('pform');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
    window.addEventListener('wisp:open-past', on);
    return () => window.removeEventListener('wisp:open-past', on);
  }, []);

  // Sliding seg indicator (same idea as Nav placeDot).
  useLayoutEffect(() => {
    const root = segRef.current;
    if (!root) return;
    const on = root.querySelector('button.on') as HTMLElement | null;
    if (!on) return;
    root.style.setProperty('--w', on.offsetWidth + 'px');
    root.style.setProperty('--x', on.offsetLeft + 'px');
  }, [tab]);

  function startEdit(ts: number) {
    setEditTs(ts);
    setWhen(loc(ts));
    const nn = s.notes[ts] || {};
    setMood(nn.m || '');
    setNote(nn.n || '');
    setFormOpen(true);
    setTab('cig');
    window.scrollTo(0, 0);
  }

  function endEdit() {
    setEditTs(null);
    setWhen(loc(Date.now()));
    setMood('');
    setNote('');
    setFormOpen(false);
  }

  function onSave() {
    const t = new Date(when).getTime();
    const wasEdit = editTs;
    const ok = savePastEntry(t, mood, note, editTs);
    if (!ok) return;
    endEdit();
    if (!wasEdit && !getState().tags[t]) pickTrigger(t);
  }

  const logDays = groupByDay(s.log);
  const cravDays = groupByDay(s.cravs || []);
  const gd = gapData(liveIndex, now);
  const price = per(s);

  return (
    <section class="view" id="v-history">
      <div class="seg top-seg" data-tabs="hist" role="group" aria-label="History sections" ref={segRef}>
        <button type="button" class={tab === 'cig' ? 'on' : ''} data-k="cig" onClick={() => { setTab('cig'); setPage(PAGE); }}>
          Cigarettes
        </button>
        <button type="button" class={tab === 'crav' ? 'on' : ''} data-k="crav" onClick={() => { setTab('crav'); setPage(PAGE); }}>
          Cravings
        </button>
      </div>

      {tab === 'cig' && (
        <div data-tab="hist" data-k="cig">
          <details class="card" id="pform" open={formOpen} onToggle={(e) => {
            const open = (e.target as HTMLDetailsElement).open;
            setFormOpen(open);
            if (open && !editTs) setWhen(loc(Date.now()));
          }}>
            <summary>Add a past entry</summary>
            <label>
              When
              <input type="datetime-local" id="pdt" value={when} onInput={(e) => setWhen((e.target as HTMLInputElement).value)} />
            </label>
            <label>
              Mood
              <select id="pmood" value={mood} onChange={(e) => setMood((e.target as HTMLSelectElement).value)}>
                <option value="">None</option>
                <option value="😊">😊 Good</option>
                <option value="😐">😐 Okay</option>
                <option value="😣">😣 Rough</option>
              </select>
            </label>
            <label class="stack">
              Note
              <input id="pnote" type="text" maxlength={80} placeholder="Optional" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
            </label>
            <div class="btnrow">
              <button class="btn pri blk" id="padd" type="button" onClick={onSave}>
                {editTs ? 'Save change' : 'Add entry'}
              </button>
              {editTs != null && (
                <button class="btn sec blk" id="pcancel" type="button" onClick={endEdit}>
                  Cancel edit
                </button>
              )}
            </div>
          </details>

          {!logDays.length ? (
            <div class="card empty">
              <b>Nothing logged yet</b>
              <div class="k">Tap the + button to log your first one.</div>
            </div>
          ) : (
            <>
              {logDays.slice(0, page).map(({ key, items }) => {
                const sd = startOfDay(items[0]);
                let gv = gd.m[sd] || 0;
                if (sd === startOfDay(now)) gv = Math.max(gv, gd.cur);
                return (
                  <div key={key}>
                    <div class="day">
                      {dayLabel(key, items[0], now)}
                      <span>
                        {items.length} sticks, {money(s.cur, items.length * price)}
                      </span>
                      {gv >= 6e4 && <span class="g">Best gap {dur(gv)}</span>}
                    </div>
                    <div class="card list">
                      {items.map((ts) => {
                        const tag = s.tags[ts];
                        const nn = s.notes[ts];
                        return (
                          <div class="row" key={ts}>
                            <span>
                              {tm(ts)}
                              {nn && (nn.m || nn.n) ? (
                                <br /><span class="k">{[nn.m, nn.n].filter(Boolean).join(' ')}</span>
                              ) : null}
                            </span>
                            <span class="acts">
                              <button
                                type="button"
                                class={'tagbtn' + (tag ? ' on' : '')}
                                aria-label="Set trigger"
                                onClick={() => pickTrigger(ts)}
                              >
                                {tag || '+ Trigger'}
                              </button>
                              <button
                                type="button"
                                class="del ib"
                                aria-label="Edit entry"
                                title="Edit"
                                onClick={() => startEdit(ts)}
                              >
                                <EditSvg />
                              </button>
                              <button
                                type="button"
                                class="del ib"
                                aria-label={'Delete entry at ' + tm(ts)}
                                onClick={() => deleteLogEntry(ts)}
                              >
                                <TrashSvg />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {logDays.length > page && (
                <button
                  class="btn sec blk"
                  type="button"
                  style={{ marginTop: '16px' }}
                  onClick={() => setPage((n) => n + PAGE)}
                >
                  Show more days ({logDays.length - page} left)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'crav' && (
        <div data-tab="hist" data-k="crav">
          {!cravDays.length ? (
            <div class="card empty">
              <b>No cravings logged yet</b>
              <div class="k">Hold the + button, or use the Today screen, to log one you got through.</div>
            </div>
          ) : (
            <>
              {cravDays.slice(0, page).map(({ key, items }) => (
                <div key={key}>
                  <div class="day">
                    {dayLabel(key, items[0], now)}
                    <span>
                      {items.length} {items.length === 1 ? 'craving' : 'cravings'}
                    </span>
                  </div>
                  <div class="card list">
                    {items.map((ts) => (
                      <div class="row" key={ts}>
                        <span>{tm(ts)}</span>
                        <span class="acts">
                          <select
                            class="ctg"
                            aria-label={'Trigger for the craving at ' + tm(ts)}
                            value={s.crt[ts] || ''}
                            onChange={(e) => setCravingTrigger(ts, (e.target as HTMLSelectElement).value)}
                          >
                            <option value="">Trigger</option>
                            {TAGS.concat(s.ctags || []).map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            class="del ib"
                            aria-label={'Delete craving at ' + tm(ts)}
                            onClick={() => deleteCraving(ts)}
                          >
                            <TrashSvg />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {cravDays.length > page && (
                <button
                  class="btn sec blk"
                  type="button"
                  style={{ marginTop: '16px' }}
                  onClick={() => setPage((n) => n + PAGE)}
                >
                  Show more days ({cravDays.length - page} left)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
