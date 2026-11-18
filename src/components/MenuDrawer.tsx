import { VIEW_TITLE } from './Header.tsx';

const LINKS: { view: string; label: string; note: string }[] = [
  { view: 'today', label: 'Today', note: 'Log, missions, challenges' },
  { view: 'history', label: 'History', note: 'Past entries' },
  { view: 'insights', label: 'Insights', note: 'Patterns and wins' },
  { view: 'plan', label: 'Plan', note: 'Limit, quit day, streak' },
  { view: 'summary', label: 'Quit summary', note: 'Totals and savings' },
  { view: 'tips', label: 'Craving tips', note: 'Ideas when it hits' },
  { view: 'setup', label: 'Setup', note: 'Profile and preferences' },
];

/**
 * Right-side menu drawer with route links (legacy #drawer).
 * Profile row opens the account drawer.
 */
export function MenuDrawer({
  open,
  current,
  onClose,
  onOpenAccount,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onOpenAccount?: () => void;
}) {
  return (
    <aside
      class={'drawer' + (open ? ' open' : '')}
      id="drawer"
      aria-hidden={!open}
      aria-label="Menu"
    >
      <div class="dh">
        <span>Menu</span>
        <button type="button" class="btn txt sm" id="dclose" aria-label="Close menu" onClick={onClose}>
          Close
        </button>
      </div>
      {onOpenAccount && (
        <>
          <button class="sbp" id="dprof" type="button" aria-label="Open account and style" onClick={onOpenAccount}>
            <span class="sbav" id="dpav">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
              </svg>
            </span>
            <span class="tx">
              <span class="tl" id="dpn">
                Account
              </span>
              <small>Style &amp; preferences</small>
            </span>
            <svg class="chev" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div class="sbsep" />
        </>
      )}
      <div class="dg">Go to</div>
      {LINKS.map((l) => (
        <a
          key={l.view}
          href={'#' + l.view}
          data-v={l.view}
          aria-current={current === l.view ? 'page' : undefined}
          onClick={onClose}
        >
          {l.label || VIEW_TITLE[l.view]}
          <small>{l.note}</small>
        </a>
      ))}
    </aside>
  );
}
