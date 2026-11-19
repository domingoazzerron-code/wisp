import { useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { getSyncUser } from '../sync/index.ts';
import { countSince } from '../lib/current.ts';
import type { ComponentChildren } from 'preact';

type LinkDef = { view: string; label: string; icon: ComponentChildren };

const MAIN: LinkDef[] = [
  { view: 'today', label: 'Today', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  { view: 'history', label: 'History', icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /> },
  { view: 'insights', label: 'Insights', icon: <path d="M5 20V12M12 20V5M19 20v-5" /> },
  { view: 'plan', label: 'Plan', icon: <path d="M5 21V4M5 4h11l-2 4 2 4H5" /> },
];

const MORE: LinkDef[] = [
  { view: 'summary', label: 'Quit summary', icon: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></> },
  { view: 'tips', label: 'Craving tips', icon: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /> },
  { view: 'setup', label: 'Setup', icon: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" /> },
];

function NavLink({ l, current, onClose, badge }: { l: LinkDef; current: string; onClose: () => void; badge?: number }) {
  return (
    <a href={'#' + l.view} data-v={l.view} aria-current={current === l.view ? 'page' : undefined} onClick={onClose}>
      <svg viewBox="0 0 24 24">{l.icon}</svg>
      <span class="tl">{l.label}</span>
      {badge ? <span class="sbbadge">{badge}</span> : null}
    </a>
  );
}

/**
 * Menu drawer: brand row, route links (with a collapsible "More" group), Light/Dark switch and the account row.
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
  const inMore = MORE.some((l) => l.view === current);
  const [moreOpen, setMoreOpen] = useState(true);
  const showMore = moreOpen || inMore;
  const name = s.name || 'Account';
  const sub = user && user.email ? user.email : 'Style & preferences';

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

      <div class="sbnav" role="navigation" aria-label="Pages">
        {MAIN.map((l) => (
          <NavLink key={l.view} l={l} current={current} onClose={onClose} badge={l.view === 'today' ? countSince(1) : 0} />
        ))}
        <button type="button" class="sbgrp" aria-expanded={showMore} onClick={() => setMoreOpen(!moreOpen)}>
          <svg class="ic" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          <span class="tl" style={{ flex: 1, textAlign: 'left' }}>More</span>
          <svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <div class={'sbsub' + (showMore ? ' open' : '')}>
          <div>
            {MORE.map((l) => (
              <NavLink key={l.view} l={l} current={current} onClose={onClose} />
            ))}
          </div>
        </div>
      </div>

      <div class="sbgap" />

      <div class="sbme">
        <span class="sbav" id="dpav" aria-hidden="true">{(name[0] || 'W').toUpperCase()}</span>
        <span class="tx">
          <span class="tl" id="dpn">{name}</span>
          <small>{sub}</small>
        </span>
        {onOpenAccount && (
          <button type="button" class="sbdots" id="dprof" aria-label="Open account and style" onClick={onOpenAccount}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        )}
      </div>
    </aside>
  );
}
