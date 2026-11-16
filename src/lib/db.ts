import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type { BackupFile, DayNote, Dimension, Entry, EntryValue, Settings, WeekNote } from './types';
import { seedDimensions } from './seed';

export const SCHEMA_VERSION = 1;

export class TrackerDB extends Dexie {
  dimensions!: Table<Dimension, string>;
  entries!: Table<Entry, string>;
  dayNotes!: Table<DayNote, string>;
  weekNotes!: Table<WeekNote, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'good-life-tracker') {
    super(name);
    // Add new versions below (never edit an old one) so data migrates in place.
    this.version(1).stores({
      dimensions: 'id, order, frequency, active, category',
      entries: 'id, dimensionId, period, [dimensionId+period]',
      dayNotes: 'date',
      weekNotes: 'week',
      settings: 'id',
    });
  }
}

const demo = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
export let db = new TrackerDB(demo ? 'good-life-tracker-demo' : 'good-life-tracker');

/** For tests. */
export function useDatabase(instance: TrackerDB) {
  db = instance;
}

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    weekStartsOn: 1,
    weeklyCheckInDay: 0,
    morningCutoff: '12:00',
    morningMode: true,
    theme: 'system',
    lastBackupAt: null,
    schemaVersion: SCHEMA_VERSION,
    seededAt: new Date().toISOString(),
  };
}

/** First run: write the seed questions and default settings. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.dimensions, async () => {
    if (await db.settings.get('settings')) return;
    await db.settings.put(defaultSettings());
    if ((await db.dimensions.count()) === 0) await db.dimensions.bulkPut(seedDimensions());
  });
}

export async function updateSettings(patch: Partial<Settings>) {
  await db.settings.update('settings', patch);
}

export const entryId = (dimensionId: string, period: string) => `${dimensionId}|${period}`;

export async function setEntry(dimensionId: string, period: string, value: EntryValue, auto = false) {
  await db.entries.put({
    id: entryId(dimensionId, period),
    dimensionId,
    period,
    value,
    auto: auto || undefined,
    updatedAt: new Date().toISOString(),
  });
}

/** Back to "not answered yet". */
export async function clearEntry(dimensionId: string, period: string) {
  await db.entries.delete(entryId(dimensionId, period));
}

const SENTENCE_RE = /[^.!?]+[.!?]+/g;

/** "A few sentences": at least two sentences, or 120+ characters. */
export function noteCountsAsJournal(text: string): boolean {
  const t = text.trim();
  if (t.length >= 120) return true;
  const sentences = (t.match(SENTENCE_RE) || []).filter((s) => s.trim().split(/\s+/).length >= 3);
  return sentences.length >= 2;
}

export async function saveDayNote(date: string, text: string) {
  const now = new Date().toISOString();
  await db.transaction('rw', db.dayNotes, db.entries, db.dimensions, async () => {
    if (text.trim()) await db.dayNotes.put({ date, text, updatedAt: now });
    else await db.dayNotes.delete(date);

    // Auto-tick yes/no questions marked autoFromNote, unless answered by hand.
    const autoDims = (await db.dimensions.toArray()).filter(
      (d) => d.active && d.autoFromNote && d.scale === 'yesno' && d.frequency === 'daily',
    );
    const counts = noteCountsAsJournal(text);
    for (const d of autoDims) {
      const existing = await db.entries.get(entryId(d.id, date));
      if (counts && !existing) await setEntry(d.id, date, true, true);
      else if (!counts && existing?.auto) await db.entries.delete(existing.id);
    }
  });
}

export async function saveWeekNote(week: string, patch: Partial<Pick<WeekNote, 'wentWell' | 'toChange'>>) {
  const prev = (await db.weekNotes.get(week)) ?? { week, wentWell: '', toChange: '', updatedAt: '' };
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  if (!next.wentWell.trim() && !next.toChange.trim()) await db.weekNotes.delete(week);
  else await db.weekNotes.put(next);
}

export async function buildBackup(): Promise<BackupFile> {
  return db.transaction('r', [db.settings, db.dimensions, db.entries, db.dayNotes, db.weekNotes], async () => ({
    app: 'good-life-tracker' as const,
    format: 1 as const,
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: (await db.settings.get('settings')) ?? defaultSettings(),
    dimensions: await db.dimensions.toArray(),
    entries: await db.entries.toArray(),
    dayNotes: await db.dayNotes.toArray(),
    weekNotes: await db.weekNotes.toArray(),
  }));
}

export function validateBackup(data: unknown): BackupFile {
  const b = data as BackupFile;
  if (!b || typeof b !== 'object' || b.app !== 'good-life-tracker') {
    throw new Error('This file is not a Good Life Tracker backup.');
  }
  if (b.format !== 1) throw new Error(`Unsupported backup format: ${String(b.format)}`);
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup comes from a newer version of the app. Update the app first.');
  }
  for (const key of ['dimensions', 'entries', 'dayNotes', 'weekNotes'] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Backup is missing "${key}".`);
  }
  for (const d of b.dimensions) {
    if (!d.id || !d.question || !d.frequency || !d.scale) throw new Error('Backup has a malformed question.');
  }
  for (const e of b.entries) {
    if (!e.id || !e.dimensionId || !e.period) throw new Error('Backup has a malformed entry.');
  }
  return b;
}

/** Replaces everything on this device with the backup's contents. */
export async function restoreBackup(b: BackupFile) {
  await db.transaction('rw', [db.settings, db.dimensions, db.entries, db.dayNotes, db.weekNotes], async () => {
    await Promise.all([db.dimensions.clear(), db.entries.clear(), db.dayNotes.clear(), db.weekNotes.clear()]);
    await db.dimensions.bulkPut(b.dimensions);
    await db.entries.bulkPut(b.entries);
    await db.dayNotes.bulkPut(b.dayNotes);
    await db.weekNotes.bulkPut(b.weekNotes);
    await db.settings.put({ ...defaultSettings(), ...b.settings, id: 'settings', schemaVersion: SCHEMA_VERSION });
  });
}

/** Preact hook around Dexie's liveQuery: re-renders whenever the queried data changes. */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Ask the browser not to evict our storage. */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage?.persist?.();
  } catch {
    return undefined;
  }
}
