import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { getSyncUser } from '../sync/index.ts';
import type { ComponentChildren } from 'preact';

type LinkDef = { view: string; label: string; sub: string; icon: ComponentChildren };

// Only pages that are NOT in the bottom bar (Today, History, Insights and Plan live there).
const LINKS: LinkDef[] = [
  {
    view: 'summary', label: 'Quit summary', sub: 'Your progress, ready to share',
    icon: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  },
  {
    view: 'tips', label: 'Craving tips', sub: 'Ideas for when it hits',
    icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  },
  {
    view: 'setup', label: 'Settings', sub: 'Appearance, limits and your data',
    icon: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />,
  },
];

function NavLink({ l, current, onClose }: { l: LinkDef; current: string; onClose: () => void }) {
  return (
    <a href={'#' + l.view} data-v={l.view} aria-current={current === l.view ? 'page' : undefined} onClick={onClose}>
      <span class="ic"><svg viewBox="0 0 24 24">{l.icon}</svg></span>
      <span class="tx">
        <span class="tl">{l.label}</span>
        <small>{l.sub}</small>
      </span>
    </a>
  );
}

/**
 * Menu drawer: your profile card (opens account and style), then only the pages the bottom bar does not have.
 * Colours come from the app tokens, so it follows light and dark automatically.
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
  useStore();
  const s = getState();
  const user = getSyncUser();
  const name = s.name || 'Account';
  const sub = user && user.email ? user.email : 'Style & preferences';

  const who = (
    <>
      <span class="sbav" id="dpav" aria-hidden="true">{(name[0] || 'W').toUpperCase()}</span>
      <span class="tx">
        <span class="tl" id="dpn">{name}</span>
        <small>{sub}</small>
      </span>
      {onOpenAccount ? <svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg> : null}
    </>
  );

  return (
    <aside class={'drawer' + (open ? ' open' : '')} id="drawer" aria-hidden={!open} aria-label="Menu">
      <div class="sbtop">
        <span class="sbbrand">
          <span class="sblogo" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2c.6 3.4 5.4 5.6 5.4 11A5.4 5.4 0 0 1 6.6 13c0-2 1-3.4 2.2-4.4.1 2 .9 3 2 3.2C10.4 8.6 10.6 5.2 12 2z" /></svg>
          </span>
          Wisp
        </span>
        <button type="button" class="dclose" id="dclose" aria-label="Close menu" onClick={onClose}>
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {onOpenAccount ? (
        <button type="button" class="sbprofile" id="dprof" aria-label="Open account and style" onClick={onOpenAccount}>{who}</button>
      ) : (
        <div class="sbprofile">{who}</div>
      )}

      <div class="sblabel">Explore</div>
      <div class="sbnav" role="navigation" aria-label="More pages">
        {LINKS.map((l) => (
          <NavLink key={l.view} l={l} current={current} onClose={onClose} />
        ))}
      </div>

      <div class="sbgap" />
      <p class="sbfoot">Today, History, Insights and Plan are in the bar at the bottom.</p>
    </aside>
  );
}
