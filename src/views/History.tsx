import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { dayKey, startOfDay } from '../lib/dates.ts';
import { dur, money, tm } from '../lib/format.ts';
import { gapData } from '../lib/gaps.ts';
import { liveIndex } from '../lib/current.ts';
import { per } from '../lib/streaks.ts';
import { limFor } from '../lib/limits.ts';
import { TAGS, pickTrigger } from '../components/Overlay.tsx';
import { deleteLogEntry, savePastEntry } from '../actions/log.ts';
import { deleteCraving } from '../actions/craving.ts';

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

const ChevSvg = () => (
  <svg class="rchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
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
  // One tap on a row opens this sheet (trigger / edit / delete) instead of three buttons on every row.
  const [sheet, setSheet] = useState<{ ts: number; kind: 'cig' | 'crav' } | null>(null);

  useEffect(() => {
    if (!sheet) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [sheet]);

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
                const dl = limFor(s, sd);
                const n = items.length;
                const cur = s.cur || '\u20b1';
                return (
                  <div key={key}>
                    <div class="day">
                      <div class="dl">
                        <b>{dayLabel(key, items[0], now)}</b>
                        <span class="dm">
                          {money(cur, n * price)}
                          {gv >= 6e4 ? ' \u00b7 Best gap ' + dur(gv) : ''}
                        </span>
                      </div>
                      <span class={'dc' + (dl > 0 ? (n > dl ? ' over' : ' ok') : '')}>
                        {dl > 0 ? n + ' of ' + dl : n + (n === 1 ? ' stick' : ' sticks')}
                      </span>
                    </div>
                    <div class="card list">
                      {items.map((ts, i) => {
                        const tag = s.tags[ts];
                        const nn = s.notes[ts];
                        const prev = items[i + 1];
                        const gapTxt = prev ? dur(ts - prev) + ' after the previous' : 'First of the day';
                        const extra = nn && (nn.m || nn.n) ? [nn.m, nn.n].filter(Boolean).join(' ') : '';
                        return (
                          <button
                            type="button"
                            class="rowb"
                            key={ts}
                            aria-haspopup="dialog"
                            aria-label={'Entry at ' + tm(ts) + (tag ? ', ' + tag : '') + '. Open options'}
                            onClick={() => setSheet({ ts, kind: 'cig' })}
                          >
                            <span class="rt">
                              <b>{tm(ts)}</b>
                              <span class="k">{gapTxt}{extra ? ' \u00b7 ' + extra : ''}</span>
                            </span>
                            {tag ? <span class="rtag">{tag}</span> : null}
                            <ChevSvg />
                          </button>
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
                    <div class="dl">
                      <b>{dayLabel(key, items[0], now)}</b>
                    </div>
                    <span class="dc ok">
                      {items.length} {items.length === 1 ? 'craving' : 'cravings'}
                    </span>
                  </div>
                  <div class="card list">
                    {items.map((ts) => {
                      const tag = s.crt[ts];
                      return (
                        <button
                          type="button"
                          class="rowb"
                          key={ts}
                          aria-haspopup="dialog"
                          aria-label={'Craving at ' + tm(ts) + (tag ? ', ' + tag : '') + '. Open options'}
                          onClick={() => setSheet({ ts, kind: 'crav' })}
                        >
                          <span class="rt"><b>{tm(ts)}</b></span>
                          {tag ? <span class="rtag">{tag}</span> : null}
                          <ChevSvg />
                        </button>
                      );
                    })}
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
      {sheet && (() => {
        const isCig = sheet.kind === 'cig';
        const tag = isCig ? s.tags[sheet.ts] : s.crt[sheet.ts];
        const close = () => setSheet(null);
        return (
          <div class="ov" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div class="box" role="dialog" aria-modal="true" aria-label={(isCig ? 'Entry' : 'Craving') + ' at ' + tm(sheet.ts)}>
              <h3>{tm(sheet.ts)}</h3>
              <p>{dayLabel(dayKey(sheet.ts), sheet.ts, now)}{tag ? ' \u00b7 ' + tag : ''}</p>
              <div class="sheetbtns">
                <button class="btn ter blk" type="button" onClick={() => { const t = sheet.ts; close(); pickTrigger(t, isCig ? 'tags' : 'crt'); }}>
                  {tag ? 'Change trigger' : 'Set trigger'}
                </button>
                {isCig && (
                  <button class="btn sec blk" type="button" onClick={() => { const t = sheet.ts; close(); startEdit(t); }}>
                    Edit time or note
                  </button>
                )}
                <button class="btn dng blk" type="button" onClick={() => { const t = sheet.ts; close(); if (isCig) deleteLogEntry(t); else deleteCraving(t); }}>
                  Delete
                </button>
                <button class="btn txt blk" type="button" onClick={close}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
