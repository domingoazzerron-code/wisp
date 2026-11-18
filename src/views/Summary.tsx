import { useEffect, useRef, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { lim, liveIndex } from '../lib/current.ts';
import { toast } from '../components/Toasts.tsx';
import { ymdNow } from '../actions/setup.ts';
import {
  drawShareCard,
  shareStats,
  summaryData,
  type ShareKind,
} from '../lib/summary.ts';

const KINDS: { id: ShareKind; label: string }[] = [
  { id: 'streak', label: 'Streak' },
  { id: 'free', label: 'Smoke-free' },
  { id: 'saved', label: 'Saved' },
  { id: 'avoid', label: 'Avoided' },
];

/**
 * Summary view (step 7e): quit stats + share card (simplified canvas).
 */
export function Summary() {
  useStore();
  useTick(1000);
  const s = getState();
  const now = Date.now();
  const data = summaryData(s, liveIndex, now);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ShareKind>('streak');
  const [blob, setBlob] = useState<Blob | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const st = shareStats(s, liveIndex, Date.now(), lim());
    drawShareCard(canvasRef.current, kind, st, s.name || '');
    canvasRef.current.toBlob((b) => setBlob(b), 'image/png');
  }, [open, kind, s.log.length, s.waited, s.base, s.pack, s.per, s.cur, s.name, s.evo]);

  function openShare() {
    if (!s.log.length) {
      toast('Log something first, then share your progress');
      return;
    }
    setOpen(true);
  }

  function closeShare() {
    setOpen(false);
    setBlob(null);
  }

  function saveImage() {
    if (!blob) {
      toast('Still drawing, try again');
      return;
    }
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'wisp-progress-' + ymdNow() + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(u);
    }, 800);
    toast('Image saved');
  }

  async function shareImage() {
    if (!blob) {
      toast('Still drawing, try again');
      return;
    }
    try {
      const f = new File([blob], 'wisp-progress.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: 'My progress' });
        return;
      }
    } catch {
      /* fall through to save */
    }
    saveImage();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeShare();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <section class="view" id="v-summary">
        <div class="card list" id="sumc">
          <div class="shero">
            <div class="k">Smoke-free now</div>
            <div class="big">{data.hero}</div>
          </div>
          <div class="stiles">
            <div class="stile">
              <div class="k">Money saved</div>
              <b>{data.tileSaved}</b>
            </div>
            <div class="stile">
              <div class="k">Avoided vs usual</div>
              <b>{data.tileAvoided}</b>
            </div>
          </div>
          {data.rows.map((r) => (
            <div class="row" key={r.label}>
              <span>{r.label}</span>
              <b>{r.value}</b>
            </div>
          ))}
        </div>
        <div class="btnrow" style={{ marginTop: 12 }}>
          <button class="btn pri blk" type="button" onClick={openShare}>
            Share my progress
          </button>
        </div>
      </section>

      {open && (
        <div
          id="shr"
          role="dialog"
          aria-modal="true"
          aria-label="Share your progress"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeShare();
          }}
        >
          <div class="shb">
            <div class="sht">Share your progress</div>
            <canvas
              ref={canvasRef}
              width={1080}
              height={1350}
              aria-label="Preview of your progress card"
            />
            <div class="shs" role="group" aria-label="Headline number">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  data-s={k.id}
                  class={kind === k.id ? 'on' : ''}
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div class="shr2">
              <button type="button" class="btn pri" onClick={shareImage}>
                Share
              </button>
              <button type="button" class="btn sec" onClick={saveImage}>
                Save image
              </button>
            </div>
            <button
              type="button"
              class="btn txt blk"
              style={{ marginTop: 4 }}
              onClick={closeShare}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
