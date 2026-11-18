import { useEffect, useState } from 'preact/hooks';
import { Nav } from './components/Nav.tsx';
import { Header } from './components/Header.tsx';
import { MenuDrawer } from './components/MenuDrawer.tsx';
import { Toasts } from './components/Toasts.tsx';
import { Overlay } from './components/Overlay.tsx';
import { Onboarding } from './components/Onboarding.tsx';
import { AppLock } from './components/AppLock.tsx';
import { AccountDrawer } from './components/AccountDrawer.tsx';
import { Today } from './views/Today.tsx';
import { History } from './views/History.tsx';
import { Setup } from './views/Setup.tsx';
import { Plan } from './views/Plan.tsx';
import { Insights } from './views/Insights.tsx';
import { Summary } from './views/Summary.tsx';
import { Tips } from './views/Tips.tsx';
import { useCraveWatch } from './hooks/useCraveWatch.ts';
import { useGapRecord } from './hooks/useGapRecord.ts';
import { getState } from './state/index.ts';
import { applyFx, applyOutfitAttr, applyTheme, fxLevel, type Theme } from './lib/theme.ts';
import { startSync } from './sync/index.ts';

// Same routes as legacy. All main views are rebuilt (Today through Tips).
export const VIEWS = ['today', 'history', 'setup', 'plan', 'insights', 'summary', 'tips'] as const;
type View = (typeof VIEWS)[number];

function currentView(): View {
  const v = location.hash.replace('#', '');
  return (VIEWS as readonly string[]).includes(v) ? (v as View) : 'today';
}

function useView(): View {
  const [v, setV] = useState<View>(currentView);
  useEffect(() => {
    const on = () => { setV(currentView()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return v;
}

export function App() {
  const view = useView();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useCraveWatch();
  useGapRecord();

  // Theme / motion / outfit attrs + cloud sync on boot.
  useEffect(() => {
    const st = getState();
    applyTheme((st.theme as Theme) || 'auto');
    applyFx(fxLevel(st));
    applyOutfitAttr(st.outfit || 'none');
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onScheme = () => {
      const s2 = getState();
      if (s2.theme === 'auto') applyTheme('auto');
    };
    mq?.addEventListener?.('change', onScheme);
    void startSync();
    return () => mq?.removeEventListener?.('change', onScheme);
  }, []);

  // Close menu on route change (legacy route() closes the drawer).
  useEffect(() => { setMenuOpen(false); }, [view]);

  function openAccount() {
    setMenuOpen(false);
    setAccountOpen(true);
  }

  return (
    <>
      <main>
        <Header
          view={view}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenAccount={openAccount}
        />
        {view === 'today' ? <Today />
          : view === 'history' ? <History />
          : view === 'setup' ? <Setup />
          : view === 'plan' ? <Plan />
          : view === 'insights' ? <Insights />
          : view === 'summary' ? <Summary />
          : view === 'tips' ? <Tips />
          : (
          <section class="view">
            <div class="card empty"><b>Not rebuilt yet</b><div class="k">This screen is still in the old app.</div></div>
          </section>
        )}
      </main>
      <Nav current={view} />
      <div
        class={'scrim' + (menuOpen || accountOpen ? ' open' : '')}
        id="scrim"
        onClick={() => { setMenuOpen(false); setAccountOpen(false); }}
        aria-hidden={!(menuOpen || accountOpen)}
      />
      <MenuDrawer
        open={menuOpen}
        current={view}
        onClose={() => setMenuOpen(false)}
        onOpenAccount={() => { setMenuOpen(false); setAccountOpen(true); }}
      />
      <AccountDrawer
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onBack={() => { setAccountOpen(false); setMenuOpen(true); }}
      />
      <Toasts />
      <Overlay />
      <Onboarding />
      <AppLock />
    </>
  );
}
