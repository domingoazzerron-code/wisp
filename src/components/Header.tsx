import { getState } from '../state/index.ts';
import { useStore, useTick } from '../hooks/useStore.ts';
import { streak as streakLive } from '../lib/current.ts';
import { startCrave } from '../actions/craving.ts';
import { toast } from './Toasts.tsx';

/** View titles when not on Today (legacy TTL). Today leaves the title empty. */
export const VIEW_TITLE: Record<string, string> = {
  today: '',
  history: 'History',
  setup: 'Setup',
  plan: 'Plan',
  insights: 'Insights',
  summary: 'Quit summary',
  tips: 'Craving tips',
};

/** mm:ss countdown for the craving pill (legacy crv → #bct). */
function craveClock(craveEnd: number, now: number): string {
  const r = Math.max(0, craveEnd - now);
  const m = Math.floor(r / 60000);
  const s = Math.floor((r % 60000) / 1000);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/**
 * App header: streak flame → #plan, centered title, craving pill, account, menu.
 * Full account drawer is step 7; account button opens the wardrobe callback when provided.
 */
export function Header({
  view,
  onOpenMenu,
  onOpenAccount,
}: {
  view: string;
  onOpenMenu: () => void;
  onOpenAccount: () => void;
}) {
  useStore();
  useTick(1000);
  const s = getState();
  const now = Date.now();
  const sk = streakLive();
  const running = !!(s.craveEnd && s.craveEnd > now);
  const clock = running ? craveClock(s.craveEnd, now) : '';

  function onCrave() {
    if (location.hash !== '#today' && location.hash !== '') {
      location.hash = '#today';
    }
    if (!s.craveEnd) {
      startCrave();
      toast('10 minute wait started');
    }
    // scroll to craving card after route settles
    setTimeout(() => {
      const el = document.getElementById('cgo') || document.querySelector('.card .crow');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  return (
    <header class="top">
      <a class="flm" id="flm" href="#plan" aria-label="Streak and achievements">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2c.6 3.4 5.4 5.6 5.4 11A5.4 5.4 0 0 1 6.6 13c0-2 1-3.4 2.2-4.4.1 2 .9 3 2 3.2C10.4 8.6 10.6 5.2 12 2z" />
        </svg>
        <b id="fl">{sk}</b>
      </a>
      <div id="ttl">{VIEW_TITLE[view] || ''}</div>
      <div class="pill">
        <button
          id="bcrv"
          type="button"
          class={running ? 'on' : undefined}
          aria-label={running ? 'Craving timer running' : 'Start 10 minute craving timer'}
          onClick={onCrave}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="7" />
            <path d="M12 9v4l2.5 1.5M9.5 3h5" />
          </svg>
          <span id="bct">{clock}</span>
        </button>
        <button
          id="acctbtn"
          type="button"
          aria-label="Open account and style"
          aria-expanded="false"
          onClick={onOpenAccount}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
          </svg>
        </button>
        <button
          id="menu"
          type="button"
          aria-label="Open menu"
          aria-expanded="false"
          onClick={onOpenMenu}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
