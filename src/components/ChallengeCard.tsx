import { useEffect, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { checkChallenge, startChallenge, stopChallenge } from '../actions/challenge.ts';
import { liveIndex } from '../lib/current.ts';
import {
  CHT, CHK, activeChalView, chalCtx, type ChallengeId,
} from '../lib/challenges.ts';

/**
 * Challenge card on Today (legacy #chc).
 * Active challenge: progress dots + stop.
 * Idle: last result (cres) + choose 3/7 day options.
 * checkChallenge runs on mount and with the parent tick.
 */
export function ChallengeCard({ now }: { now: number }) {
  useStore();
  const [open, setOpen] = useState(false);
  const s = getState();

  useEffect(() => {
    checkChallenge(now);
  }, [now]);

  const c = s.chal;
  const active = !!(c && c.id && CHT[c.id as ChallengeId]);
  const ctx = chalCtx(s, liveIndex, now);
  const view = active ? activeChalView(c, ctx) : null;
  const r = s.cres;

  if (active && view) {
    return (
      <div class="card" id="chc">
        <div class="dh">
          <span class="bn">Challenge</span>
          <small>{view.dayLabel}</small>
        </div>
        <div class="mtx">{view.name}</div>
        <div class="cdots" role="img" aria-label={view.okCount + ' of ' + c.days + ' days done'}>
          {view.dots.map((x, i) => (
            <i key={i} class={'cdd' + (x === 'ok' ? ' ok' : x === 'fail' ? ' bad' : x === 'pend' ? ' now' : '')} />
          ))}
        </div>
        <div class="k left">{view.desc}{view.graceNote}</div>
        <div class="btnrow">
          <button class="btn txt sm" type="button" onClick={() => stopChallenge()}>
            Stop challenge
          </button>
        </div>
      </div>
    );
  }

  // Idle: picker + last result
  let resultBlock = null as any;
  if (r && r.k) {
    const p = r.k.split('-');
    const T2 = CHT[p[0] as ChallengeId];
    if (T2) {
      resultBlock = r.ok ? (
        <div class="cres">
          <b>Badge earned: {T2.n}</b>
          <span>{p[1]} days done. +{r.s} stars. Wisp is so proud.</span>
        </div>
      ) : (
        <div class="cres bad">
          <b>Not this time</b>
          <span>{T2.n} ended early, and that’s okay. Try it again whenever you like.</span>
        </div>
      );
    }
  }

  return (
    <div class="card" id="chc">
      <div class="dh"><span class="bn">Challenges</span></div>
      {resultBlock}
      <div class="k left">Pick a 3 or 7 day goal. Finish it for a badge and stars.</div>
      {open ? (
        <>
          {CHK.map((id) => (
            <div class="chx" key={id}>
              <b>{CHT[id].n}</b>
              <span>{CHT[id].d}</span>
              <div class="chxb">
                <button class="btn ter sm" type="button" onClick={() => { startChallenge(id, 3, now); setOpen(false); }}>
                  3 days
                </button>
                <button class="btn ter sm" type="button" onClick={() => { startChallenge(id, 7, now); setOpen(false); }}>
                  7 days
                </button>
              </div>
            </div>
          ))}
          <div class="btnrow">
            <button class="btn txt sm" type="button" onClick={() => setOpen(false)}>Close</button>
          </div>
        </>
      ) : (
        <div class="btnrow">
          <button class="btn ter sm blk" type="button" onClick={() => setOpen(true)}>
            Choose a challenge
          </button>
        </div>
      )}
    </div>
  );
}
