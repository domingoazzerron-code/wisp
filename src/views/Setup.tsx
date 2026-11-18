import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getState } from '../state/index.ts';
import { useStore } from '../hooks/useStore.ts';
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
} from '../actions/setup.ts';

/**
 * Settings view (step 7b): Limits & cost + Data & more.
 * First-run onboarding overlay stays separate; theme/haptics live in the account drawer.
 */
export function Setup() {
  useStore();
  const s = getState();
  const [tab, setTab] = useState<'lim' | 'data'>('lim');
  const [ctin, setCtin] = useState('');
  const [bkText, setBkText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const segRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = segRef.current;
    if (!root) return;
    const on = root.querySelector('button.on') as HTMLElement | null;
    if (!on) return;
    root.style.setProperty('--w', on.offsetWidth + 'px');
    root.style.setProperty('--x', on.offsetLeft + 'px');
  }, [tab]);

  function numInput(key: 'limit' | 'base' | 'gap' | 'pack' | 'per' | 'nic' | 'tar', value: string) {
    patchField(key, value);
  }

  return (
    <section class="view" id="v-setup">
      <div class="seg top-seg" data-tabs="set" role="group" aria-label="Settings sections" ref={segRef}>
        <button type="button" class={tab === 'lim' ? 'on' : ''} data-k="lim" onClick={() => setTab('lim')}>
          Limits &amp; cost
        </button>
        <button type="button" class={tab === 'data' ? 'on' : ''} data-k="data" onClick={() => setTab('data')}>
          Data &amp; more
        </button>
      </div>

      {tab === 'lim' && (
        <div data-tab="set" data-k="lim">
          <div class="card">
            <div class="eyebrow">Profile</div>
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

          <div class="card">
            <div class="eyebrow">Limits</div>
            <label>
              Daily limit
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={s.limit}
                onInput={(e) => numInput('limit', (e.target as HTMLInputElement).value)}
              />
            </label>
            <div class="k" style={{ padding: '0 0 10px' }}>
              A new limit applies from today. Earlier days keep the limit you had then.
            </div>
            <label>
              <span>
                Usual per day<small>Before you cut down</small>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={s.base}
                onInput={(e) => numInput('base', (e.target as HTMLInputElement).value)}
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
                onInput={(e) => numInput('gap', (e.target as HTMLInputElement).value)}
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

          <div class="card">
            <div class="eyebrow">Cost</div>
            <label>
              Price per pack
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={s.pack}
                onInput={(e) => numInput('pack', (e.target as HTMLInputElement).value)}
              />
            </label>
            <label>
              Cigarettes per pack
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={s.per}
                onInput={(e) => numInput('per', (e.target as HTMLInputElement).value)}
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
                onInput={(e) => numInput('nic', (e.target as HTMLInputElement).value)}
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
                onInput={(e) => numInput('tar', (e.target as HTMLInputElement).value)}
              />
            </label>
          </details>
        </div>
      )}

      {tab === 'data' && (
        <div data-tab="set" data-k="data">
          <div class="card" id="bkcard">
            <div class="eyebrow">Backup</div>
            <div class="k left">
              Save a backup file to keep your data safe, or restore one from a file. Your data lives only in this browser, so back up now and then.
            </div>
            <textarea
              rows={3}
              aria-label="Backup text"
              value={bkText}
              onInput={(e) => setBkText((e.target as HTMLTextAreaElement).value)}
            />
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
              <button class="btn ter sm" type="button" onClick={() => exportCsv()}>
                Export CSV
              </button>
            </div>
            <div class="k left u-mt6">CSV opens in a spreadsheet. It is for reading, not for restoring.</div>
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
            <div class="k left u-mt14">Or copy and paste the text instead.</div>
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
          </div>

          <div class="card">
            <div class="eyebrow">Custom triggers</div>
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
          </div>

          <div class="card">
            <div class="eyebrow">Add to your home screen</div>
            <div class="k left">
              Android Chrome: menu, then Add to Home screen. iPhone Safari: Share, then Add to Home Screen. It opens full screen like an app.
            </div>
          </div>

          <div class="card dz">
            <div class="eyebrow">Danger zone</div>
            <div class="k left u-mb12">Deletes every logged cigarette and all settings.</div>
            <button class="btn dng blk" type="button" onClick={() => eraseAllData()}>
              Erase all data
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
