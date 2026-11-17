import { useState } from 'preact/hooks';
import type { Dimension, Frequency, Settings } from '../lib/types';
import { buildBackup, db, restoreBackup, updateSettings, useLive, validateBackup } from '../lib/db';
import { buildCsv } from '../lib/stats';
import { dayName, diffDays, formatLong, todayKey } from '../lib/dates';
import { pickFile, shareOrDownload } from '../lib/files';
import { QuestionEditor } from './QuestionEditor';
import { ArrowDown, ArrowUp } from '../components/Icons';

interface Props {
  settings: Settings;
  dimensions: Dimension[];
}

const SCALE_LABEL: Record<string, string> = { rating5: '1–5', yesno: 'Yes/no', hours: 'Hours', number: 'Number', text: 'Text' };

export function SettingsScreen({ settings, dimensions }: Props) {
  const [freq, setFreq] = useState<Frequency>('daily');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Dimension | null | 'new'>(null);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const counts = useLive(async () => {
    const m = new Map<string, number>();
    await db.entries.each((e) => m.set(e.dimensionId, (m.get(e.dimensionId) ?? 0) + 1));
    return m;
  }, []);
  const persisted = useLive(async () => (navigator.storage?.persisted ? navigator.storage.persisted() : undefined), []);

  const list = dimensions.filter((d) => d.frequency === freq && d.active).sort((a, b) => a.order - b.order);
  const archived = dimensions.filter((d) => d.frequency === freq && !d.active);
  const categories = [...new Set(dimensions.map((d) => d.category))];

  const move = async (i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    await db.transaction('rw', db.dimensions, async () => {
      await db.dimensions.update(a.id, { order: b.order });
      await db.dimensions.update(b.id, { order: a.order });
    });
  };

  const stamp = () => new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');

  const exportJson = async () => {
    const backup = await buildBackup();
    const res = await shareOrDownload(`good-life-backup_${stamp()}.json`, JSON.stringify(backup, null, 1), 'application/json');
    if (res === 'cancelled') return;
    await updateSettings({ lastBackupAt: new Date().toISOString() });
    setMsg({ text: `Backup created with ${backup.entries.length} answers. Keep it in iCloud Drive → "Good Life Tracker Backups".` });
  };

  const exportCsv = async () => {
    const [entries, notes] = await Promise.all([db.entries.toArray(), db.dayNotes.toArray()]);
    const csv = buildCsv(dimensions, entries, notes, todayKey());
    await shareOrDownload(`good-life-${todayKey()}.csv`, csv, 'text/csv');
  };

  const importJson = async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      const current = await db.entries.count();
      const ok = confirm(
        `Restore backup from ${formatLong(backup.exportedAt.slice(0, 10))}?\n\n` +
          `It has ${backup.entries.length} answers and ${backup.dimensions.length} questions.\n` +
          `This REPLACES everything on this phone (${current} answers now).`,
      );
      if (!ok) return;
      await restoreBackup(backup);
      setMsg({ text: `Restored ${backup.entries.length} answers.` });
    } catch (e) {
      setMsg({ text: `Import failed: ${(e as Error).message}`, warn: true });
    }
  };

  const backupAge = settings.lastBackupAt ? diffDays(todayKey(), settings.lastBackupAt.slice(0, 10)) : null;

  return (
    <>
      <div class="header">
        <div class="eyebrow">Good Life Tracker</div>
        <h1>Settings</h1>
      </div>

      {msg && <div class={`banner${msg.warn ? ' warn' : ''}`}><span class="grow small">{msg.text}</span><button class="link-btn" onClick={() => setMsg(null)}>OK</button></div>}

      <div class="group-title">Questions</div>
      <div class="seg">
        {(['daily', 'weekly'] as Frequency[]).map((f) => (
          <button key={f} class={freq === f ? 'on' : ''} onClick={() => setFreq(f)}>
            {f === 'daily' ? 'Daily' : 'Weekly'} ({dimensions.filter((d) => d.frequency === f && d.active).length})
          </button>
        ))}
      </div>
      <div class="list">
        {list.map((d, i) => (
          <div class="list-item" key={d.id}>
            <div class="grow" onClick={() => setEditing(d)} role="button">
              <div class="title">{d.question}</div>
              <div class="meta">{d.category} · {SCALE_LABEL[d.scale]}{d.higherIsBetter ? '' : ' · lower is better'}</div>
            </div>
            <div class="order-btns">
              <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
              <button aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div class="list-item muted">No {freq} questions.</div>}
      </div>
      <div class="btn-row" style={{ marginBottom: 8 }}>
        <button class="btn primary" onClick={() => setEditing('new')}>Add question</button>
        {archived.length > 0 && <button class="btn" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</button>}
      </div>
      {showArchived && archived.length > 0 && (
        <div class="list">
          {archived.map((d) => (
            <div class="list-item archived" key={d.id} onClick={() => setEditing(d)} role="button">
              <div class="grow">
                <div class="title">{d.question}</div>
                <div class="meta">{d.category} · {counts?.get(d.id) ?? 0} answers kept</div>
              </div>
              <button class="link-btn" onClick={(e) => { e.stopPropagation(); db.dimensions.update(d.id, { active: true }); }}>Restore</button>
            </div>
          ))}
        </div>
      )}

      <div class="group-title">Check-in</div>
      <div class="card">
        <label class="check">
          <input type="checkbox" checked={settings.morningMode} onChange={(e) => updateSettings({ morningMode: (e.target as HTMLInputElement).checked })} />
          Morning mode: rate the previous day
        </label>
        {settings.morningMode && (
          <label class="field">
            <span>Open on yesterday until</span>
            <input type="time" value={settings.morningCutoff} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) updateSettings({ morningCutoff: v }); }} />
          </label>
        )}
        <label class="field" style={{ marginBottom: 0 }}>
          <span>Weekly check-in day</span>
          <select value={settings.weeklyCheckInDay} onChange={(e) => updateSettings({ weeklyCheckInDay: Number((e.target as HTMLSelectElement).value) })}>
            {[1, 2, 3, 4, 5, 6, 0].map((i) => <option key={i} value={i}>{dayName(i)}</option>)}
          </select>
        </label>
      </div>

      <div class="group-title">Backup</div>
      <div class="card">
        <div class="small muted" style={{ marginBottom: 10 }}>
          {backupAge === null ? 'No backup yet.' : `Last backup: ${backupAge === 0 ? 'today' : `${backupAge} day${backupAge === 1 ? '' : 's'} ago`}.`}{' '}
          Your data lives only on this phone. Export weekly and save it to iCloud Drive.
        </div>
        <button class="btn primary block" onClick={exportJson}>Export backup (JSON)</button>
        <div class="btn-row" style={{ marginTop: 8 }}>
          <button class="btn" onClick={exportCsv}>Export CSV for Excel</button>
          <button class="btn" onClick={importJson}>Restore backup…</button>
        </div>
        <div class="small muted" style={{ marginTop: 10 }}>
          Storage: {persisted === true ? 'protected from automatic clean-up' : persisted === false ? 'not marked persistent (open the app from the Home Screen icon)' : 'unknown'}.
        </div>
      </div>

      <div class="group-title">Reminders</div>
      <div class="card small">
        This web app can't send its own notifications. Set up two repeating reminders in the iOS <strong>Reminders</strong> app:
        <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
          <li>"Good Life check-in", every day at 07:30</li>
          <li>"Weekly check-in", every {dayName(settings.weeklyCheckInDay)}</li>
        </ul>
      </div>

      <div class="group-title">About</div>
      <div class="card small muted">
        Good Life Tracker · v{__APP_VERSION__}
        <br />
        No account, no server, no analytics. All answers are stored on this device only. Always open the app from its Home Screen icon: data in a Safari tab is stored separately.
      </div>

      {editing && (
        <QuestionEditor
          dim={editing === 'new' ? null : editing}
          categories={categories}
          nextOrder={Math.max(0, ...dimensions.map((d) => d.order)) + 10}
          answerCount={editing === 'new' ? 0 : counts?.get(editing.id) ?? 0}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
