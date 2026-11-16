import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TrackerDB, buildBackup, db, ensureSeeded, entryId, noteCountsAsJournal, restoreBackup, saveDayNote, setEntry, useDatabase, validateBackup,
} from '../src/lib/db';
import { buildCsv, compareBy, streaks } from '../src/lib/stats';

let n = 0;
beforeEach(async () => {
  useDatabase(new TrackerDB(`test-${n++}`));
  await ensureSeeded();
});

describe('seed', () => {
  it('ships 18 daily and 6 weekly questions', async () => {
    const dims = await db.dimensions.toArray();
    expect(dims.filter((d) => d.frequency === 'daily')).toHaveLength(18);
    expect(dims.filter((d) => d.frequency === 'weekly')).toHaveLength(6);
    expect(dims.find((d) => d.id === 'd4-stress')?.higherIsBetter).toBe(false);
  });

  it('seeding twice does not duplicate', async () => {
    await ensureSeeded();
    expect(await db.dimensions.count()).toBe(24);
  });
});

describe('journal auto-tick', () => {
  it('detects a few sentences', () => {
    expect(noteCountsAsJournal('ok')).toBe(false);
    expect(noteCountsAsJournal('Had a good talk with Sam. Felt calmer after the walk.')).toBe(true);
  });

  it('ticks and unticks, but never overrides a manual answer', async () => {
    const id = entryId('d5-journal', '2026-11-15');
    await saveDayNote('2026-11-15', 'Long day at work today. But the evening was really nice.');
    expect((await db.entries.get(id))?.value).toBe(true);
    await saveDayNote('2026-11-15', 'meh');
    expect(await db.entries.get(id)).toBeUndefined();

    await setEntry('d5-journal', '2026-11-15', false);
    await saveDayNote('2026-11-15', 'Long day at work today. But the evening was really nice.');
    expect((await db.entries.get(id))?.value).toBe(false);
  });
});

describe('backup', () => {
  it('round-trips through JSON', async () => {
    await setEntry('d1-wellbeing', '2026-11-15', 4);
    await setEntry('d11-work-enjoy', '2026-11-15', null);
    await setEntry('w1-family', '2026-W46', 5);
    await saveDayNote('2026-11-15', 'A note.');
    const json = JSON.stringify(await buildBackup());

    useDatabase(new TrackerDB(`test-restore-${n++}`));
    await ensureSeeded();
    await restoreBackup(validateBackup(JSON.parse(json)));
    expect((await db.entries.get(entryId('d1-wellbeing', '2026-11-15')))?.value).toBe(4);
    expect((await db.entries.get(entryId('d11-work-enjoy', '2026-11-15')))?.value).toBeNull();
    expect((await db.dayNotes.get('2026-11-15'))?.text).toBe('A note.');
    expect(await db.dimensions.count()).toBe(24);
  });

  it('rejects foreign files', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow();
  });

  it('builds a wide CSV', async () => {
    await setEntry('d1-wellbeing', '2026-11-14', 3);
    await setEntry('d10-workout', '2026-11-15', true);
    const csv = buildCsv(await db.dimensions.toArray(), await db.entries.toArray(), [], '2026-11-15');
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('2026-11-14,2026-11-15');
    expect(lines.find((l) => l.includes('overall wellbeing'))).toMatch(/,3,$/);
    expect(lines.find((l) => l.includes('work out'))).toMatch(/,yes$/);
  });
});

describe('stats', () => {
  it('streaks', async () => {
    for (const d of ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-14', '2026-11-15']) await setEntry('d10-workout', d, true);
    const m = new Map((await db.entries.toArray()).map((e) => [e.period, e]));
    expect(streaks(m, '2026-11-16')).toEqual({ current: 2, best: 3 });
  });

  it('compareBy splits on a threshold', async () => {
    const dims = await db.dimensions.toArray();
    const sleep = dims.find((d) => d.id === 'd7-sleep-hours')!;
    const wb = dims.find((d) => d.id === 'd1-wellbeing')!;
    const data: [string, number, number][] = [['2026-11-01', 8, 5], ['2026-11-02', 6, 2], ['2026-11-03', 7, 4], ['2026-11-04', 5, 3]];
    for (const [d, s, w] of data) { await setEntry(sleep.id, d, s); await setEntry(wb.id, d, w); }
    const all = await db.entries.toArray();
    const by = (id: string) => new Map(all.filter((e) => e.dimensionId === id).map((e) => [e.period, e]));
    const [hi, lo] = compareBy(sleep, by(sleep.id), wb, by(wb.id), 7);
    expect(hi).toMatchObject({ avg: 4.5, days: 2 });
    expect(lo).toMatchObject({ avg: 2.5, days: 2 });
  });
});
