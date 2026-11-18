import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { GHOST_SVG } from './ghost.ts';
import { unlockOutfit, wearOutfit } from '../actions/evolution.ts';
import {
  FORM, hasOutfit, OUTFIT_NAME, OUTFIT_PRICE, OUTFIT_MIN_STAGE, OUTFIT_TEXT, OUTFITS,
} from '../lib/evolution.ts';
import type { Outfit } from '../state/types.ts';

/**
 * Compact wardrobe panel (legacy #ofs buttons inside account drawer).
 * Opened from the stars button on the mission card. Full account drawer is step 7.
 */
export function OutfitWardrobe({ onClose }: { onClose: () => void }) {
  useStore();
  const s = getState();
  const evo = s.evo || 0;
  const owned = s.owned || [];
  const stars = s.stars || 0;
  const current = s.outfit || 'none';

  function pick(id: Outfit) {
    if (hasOutfit(id, owned, evo)) wearOutfit(id);
    else unlockOutfit(id);
  }

  return (
    <div class="card" id="wardrobe" style={{ marginTop: 8 }}>
      <div class="dh">
        <span class="bn">Wisp’s wardrobe</span>
        <button class="btn txt sm" type="button" onClick={onClose}>Close</button>
      </div>
      <div class="dgs">
        <span class="k">Stage: {FORM[evo] || 'Wisp'}</span>
        <span id="dstars">★ {stars}</span>
      </div>
      <div class="ofs" id="ofs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {OUTFITS.map((id) => {
          const locked = !hasOutfit(id, owned, evo);
          const pr = OUTFIT_PRICE[id] || 0;
          const min = OUTFIT_MIN_STAGE[id];
          const label = locked
            ? '★ ' + pr + (min != null ? ' or ' + FORM[min] : '')
            : '';
          return (
            <button
              key={id}
              type="button"
              class={'otb' + (id === current ? ' on' : '') + (locked ? ' lk' : '')}
              aria-pressed={id === current}
              aria-label={OUTFIT_NAME[id] + (locked ? ', ' + pr + ' stars' + (min != null ? ', or reach ' + FORM[min] : '') : '')}
              onClick={() => pick(id)}
            >
              <span class="ot" dangerouslySetInnerHTML={{ __html: GHOST_SVG }} data-outfit={id} />
              <em>{OUTFIT_NAME[id]}</em>
              <i>{label}</i>
            </button>
          );
        })}
      </div>
      <p class="k left" id="ofn" style={{ marginTop: 8 }}>{OUTFIT_TEXT[current]}</p>
    </div>
  );
}
