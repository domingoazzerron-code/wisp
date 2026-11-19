import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
import { fxLevel, fxNote, type FxLevel, type Theme } from '../lib/theme.ts';
import {
  addCustomTrigger,
  copyBackupText,
  eraseAllData,
  exportCsv,
  patchField,
  removeCustomTrigger,
  restoreFromFile,
  restoreFromText,
  saveBackupFile,
  setFx,
  setTheme,
} from '../actions/setup.ts';

/**
 * Settings: a short hub, then one focused page per section.
 * Routes: #setup (hub), #setup/appearance, #setup/motion, #setup/limits, #setup/data.
 */

type Section = 'appearance' | 'motion' | 'limits' | 'data';

const SECTIONS: Section[] = ['appearance', 'motion', 'limits', 'data'];

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const FX: { id: FxLevel; label: string }[] = [
  { id: 1, label: 'Full' },
  { id: 2, label: 'Calm' },
  { id: 3, label: 'Off' },
];

const ICON: Record<Section, ComponentChildren> = {
  appearance: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" /></>,
  motion: <><rect x="8" y="3" width="8" height="18" rx="2.5" /><path d="M4 8v8M20 8v8" /></>,
  limits: <><circle cx="12" cy="12" r="9" /><path d="M14.6 9.3C14.2 8.5 13.2 8 12 8c-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.3 5 4 0 1.1-1.1 2-2.5 2-1.2 0-2.2-.5-2.7-1.4M12 6.5V8M12 16v1.5" /></>,
  data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
};

const TITLE: Record<Section, string> = {
  appearance: 'Appearance',
  motion: 'Motion & haptics',
  limits: 'Limits & cost',
  data: 'Data & more',
};

const LEAD: Record<Section, string> = {
  appearance: 'Choose how Wisp looks on this device.',
  motion: 'Control animations and vibration.',
  limits: 'Your daily limit, spacing between cigarettes and what a pack costs.',
  data: 'Back up your data, add triggers, or start over.',
};

function sectionFromHash(): Section | null {
  const part = location.hash.replace('#', '').split('/')[1] || '';
  return (SECTIONS as string[]).includes(part) ? (part as Section) : null;
}

function useSection(): Section | null {
  const [sec, setSec] = useState<Section | null>(sectionFromHash);
  useEffect(() => {
    const on = () => setSec(sectionFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return sec;
}

const Chev = () => (
  <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);

/** Group label above a card (kept outside the card for a calmer, grouped look). */
function Group({ title, children }: { title?: string; children: ComponentChildren }) {
  return (
    <section class="sgroup">
      {title ? <h3 class="sglabel">{title}</h3> : null}
      {children}
    </section>
  );
}

function Hub() {
  const s = getState();
  const theme = (s.theme as Theme) || 'auto';
  const level = fxLevel(s);
  const summary: Record<Section, string> = {
    appearance: THEMES.find((t) => t.id === theme)?.label || 'Auto',
    motion: FX.find((f) => f.id === level)?.label || 'Full',
    limits: 'Limit ' + s.limit + ' a day',
    data: 'Backup, triggers, reset',
  };
  return (
    <>
      <div class="sethead">
        <h2 class="settl">Settings</h2>
        <p class="setlead">Make Wisp fit the way you use it.</p>
      </div>
      <div class="card srows" role="group" aria-label="Settings sections">
        {SECTIONS.map((id) => (
          <a key={id} class="srow" href={'#setup/' + id}>
            <span class="sic" aria-hidden="true"><svg viewBox="0 0 24 24">{ICON[id]}</svg></span>
            <span class="stx">
              <span class="stl">{TITLE[id]}</span>
              <small>{summary[id]}</small>
            </span>
            <Chev />
          </a>
        ))}
      </div>
    </>
  );
}

function Page({ id, children }: { id: Section; children: ComponentChildren }) {
  return (
    <>
      <a class="sback" href="#setup">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Settings
      </a>
      <div class="sethead">
        <h2 class="settl">{TITLE[id]}</h2>
        <p class="setlead">{LEAD[id]}</p>
      </div>
      {children}
    </>
  );
}

function Appearance() {
  const s = getState();
  const theme = (s.theme as Theme) || 'auto';
  return (
    <Page id="appearance">
      <Group>
        <div class="thm" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              class={'thmb' + (theme === t.id ? ' on' : '')}
              onClick={() => setTheme(t.id)}
            >
              <span class={'thmp ' + t.id} aria-hidden="true"><i /><i /><i /></span>
              <span class="thml">{t.label}</span>
            </button>
          ))}
        </div>
        <p class="setnote">Auto follows your device. Light and Dark stay as they are.</p>
      </Group>
    </Page>
  );
}

function Motion() {
  const s = getState();
  const level = fxLevel(s);
  return (
    <Page id="motion">
      <Group>
        <div class="card opts" role="radiogroup" aria-label="Motion and haptics">
          {FX.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={level === f.id}
              class={'opt' + (level === f.id ? ' on' : '')}
              onClick={() => setFx(f.id)}
            >
              <span class="otx">
                <span class="otl">{f.label}</span>
                <small>{fxNote(f.id)}</small>
              </span>
              <span class="ock" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
            </button>
          ))}
        </div>
      </Group>
    </Page>
  );
}

function Limits() {
  const s = getState();
  type NumKey = 'limit' | 'base' | 'gap' | 'pack' | 'per' | 'nic' | 'tar';
  const num = (key: NumKey, value: string) => patchField(key, value);
  return (
    <Page id="limits">
      <Group title="You">
        <div class="card">
          <label>
            Your name
            <input
              type="text"
              maxlength={20}
              placeholder="Optional"
              value={s.name || ''}
              onInput={(e) => patchField('name', (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      </Group>

      <Group title="Limits">
        <div class="card">
          <label>
            Daily limit
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={s.limit}
              onInput={(e) => num('limit', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            <span>
              Usual per day<small>Before you cut down</small>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={s.base}
              onInput={(e) => num('base', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            <span>
              Minimum gap<small>Minutes between cigarettes, 0 is off</small>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={s.gap}
              onInput={(e) => num('gap', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            <span>
              Gap warning<small>Ask before logging inside your gap</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={s.gapWarn !== 0}
              onChange={(e) => patchField('gapWarn', (e.target as HTMLInputElement).checked)}
            />
          </label>
        </div>
        <p class="setnote">A new limit applies from today. Earlier days keep the limit you had then.</p>
      </Group>

      <Group title="Cost">
        <div class="card">
          <label>
            Price per pack
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={s.pack}
              onInput={(e) => num('pack', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Cigarettes per pack
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={s.per}
              onInput={(e) => num('per', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Currency symbol
            <input
              type="text"
              maxlength={4}
              value={s.cur}
              onInput={(e) => patchField('cur', (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      </Group>

      <Group>
        <details class="card">
          <summary>Health estimates</summary>
          <label>
            <span>
              Nicotine per cigarette<small>In mg</small>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={s.nic}
              onInput={(e) => num('nic', (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            <span>
              Tar per cigarette<small>In mg</small>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={s.tar}
              onInput={(e) => num('tar', (e.target as HTMLInputElement).value)}
            />
          </label>
        </details>
      </Group>
    </Page>
  );
}

function Data() {
  const s = getState();
  const [ctin, setCtin] = useState('');
  const [bkText, setBkText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Page id="data">
      <Group title="Backup">
        <div class="card" id="bkcard">
          <div class="k left">
            Your data lives only in this browser. Save a backup file now and then, and restore it any time.
          </div>
          <div class="btnrow">
            <button class="btn pri sm" type="button" onClick={() => saveBackupFile()}>
              Save backup file
            </button>
            <button
              class="btn sec sm"
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.value = '';
                  fileRef.current.click();
                }
              }}
            >
              Restore from file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) restoreFromFile(f);
            }}
          />
        </div>
        <details class="card">
          <summary>More ways to back up</summary>
          <div class="k left">Copy your data as text, or paste text here to restore it.</div>
          <textarea
            rows={3}
            aria-label="Backup text"
            value={bkText}
            onInput={(e) => setBkText((e.target as HTMLTextAreaElement).value)}
          />
          <div class="btnrow">
            <button
              class="btn ter sm"
              type="button"
              onClick={async () => {
                setBkText(JSON.stringify(getState()));
                await copyBackupText();
              }}
            >
              Copy backup text
            </button>
            <button class="btn sec sm" type="button" onClick={() => restoreFromText(bkText)}>
              Restore from text
            </button>
          </div>
          <div class="k left u-mt14">CSV opens in a spreadsheet. It is for reading, not for restoring.</div>
          <div class="btnrow">
            <button class="btn ter sm" type="button" onClick={() => exportCsv()}>
              Export CSV
            </button>
          </div>
        </details>
      </Group>

      <Group title="Custom triggers">
        <div class="card">
          <label>
            New trigger
            <input
              type="text"
              maxlength={20}
              placeholder="e.g. Driving"
              value={ctin}
              onInput={(e) => setCtin((e.target as HTMLInputElement).value)}
            />
          </label>
          <div class="btnrow">
            <button
              class="btn ter sm"
              type="button"
              onClick={() => {
                if (addCustomTrigger(ctin)) setCtin('');
              }}
            >
              Add trigger
            </button>
          </div>
          {(s.ctags || []).length ? (
            <div class="chips u-mt12">
              {(s.ctags || []).map((t, i) => (
                <span class="chip" key={t + i}>
                  {t}
                  <button
                    class="del"
                    type="button"
                    aria-label={'Remove ' + t}
                    onClick={() => removeCustomTrigger(i)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Group>

      <Group title="Add to your home screen">
        <div class="card">
          <div class="k left">
            Android Chrome: menu, then Add to Home screen. iPhone Safari: Share, then Add to Home Screen. It opens full
            screen like an app.
          </div>
        </div>
      </Group>

      <Group title="Danger zone">
        <div class="card dz">
          <div class="k left u-mb12">Deletes every logged cigarette and all settings.</div>
          <button class="btn dng blk" type="button" onClick={() => eraseAllData()}>
            Erase all data
          </button>
        </div>
      </Group>
    </Page>
  );
}

export function Setup() {
  useStore();
  const sec = useSection();
  return (
    <section class="view" id="v-setup" key={sec || 'hub'}>
      {sec === 'appearance' ? <Appearance />
        : sec === 'motion' ? <Motion />
        : sec === 'limits' ? <Limits />
        : sec === 'data' ? <Data />
        : <Hub />}
    </section>
  );
}
