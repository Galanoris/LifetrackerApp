import { useEffect, useState } from 'preact/hooks';
import type { Dimension, Settings } from '../lib/types';
import { db, saveDayNote, useLive } from '../lib/db';
import { addDays, checkInDate, diffDays, formatLong, formatWeek, relativeTitle, todayKey } from '../lib/dates';
import { NoteField, QuestionCard } from '../components/QuestionCard';
import { groupByCategory } from '../components/grouping';

interface Props {
  settings: Settings;
  dimensions: Dimension[];
  now: Date;
  weeklyDue: string | null;
  onOpenWeek: (week: string) => void;
  onOpenSettings: () => void;
}

export function Today({ settings, dimensions, now, weeklyDue, onOpenWeek, onOpenSettings }: Props) {
  const defaultDate = checkInDate(now, settings.morningMode, settings.morningCutoff);
  const [date, setDate] = useState(defaultDate);
  const [pinned, setPinned] = useState(false); // user picked a date by hand

  // Follow the default date (e.g. app resumed the next morning) unless the user navigated.
  useEffect(() => {
    if (!pinned) setDate(defaultDate);
  }, [defaultDate, pinned]);

  const today = todayKey(now);
  const daily = dimensions.filter((d) => d.active && d.frequency === 'daily');
  const entries = useLive(() => db.entries.where('period').equals(date).toArray(), [date]);
  const note = useLive(() => db.dayNotes.get(date), [date]);
  const hasAnyEntry = useLive(() => db.entries.limit(1).count(), []);

  if (!entries) return null;
  const byDim = new Map(entries.map((e) => [e.dimensionId, e]));
  const done = daily.filter((d) => byDim.has(d.id)).length;

  const go = (d: string) => {
    if (d > today) return;
    setPinned(d !== defaultDate);
    setDate(d);
  };

  const backupAge = settings.lastBackupAt
    ? diffDays(today, settings.lastBackupAt.slice(0, 10))
    : diffDays(today, settings.seededAt.slice(0, 10));
  const backupDue = !!hasAnyEntry && backupAge >= 7;

  return (
    <>
      <div class="header">
        <div>
          <h1>{relativeTitle(date, now)}</h1>
          <div class="sub">{formatLong(date)}</div>
        </div>
        <div class="progress" aria-label={`${done} of ${daily.length} answered`}>
          <strong>{done}</strong> / {daily.length}
        </div>
      </div>
      <div class="progress-bar">
        <div style={{ width: `${daily.length ? (done / daily.length) * 100 : 0}%` }} />
      </div>

      <div class="date-switch">
        <button class="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>‹</button>
        <label class="date-label">
          {date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : formatLong(date)}
          <input
            type="date"
            value={date}
            max={today}
            aria-label="Pick a date"
            onChange={(e) => {
              const v = (e.target as HTMLInputElement).value;
              if (v) go(v);
            }}
          />
        </label>
        <button class="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}>›</button>
      </div>
      {pinned && date !== defaultDate && (
        <div style={{ textAlign: 'center', marginTop: -6, marginBottom: 6 }}>
          <button class="link-btn" onClick={() => { setPinned(false); setDate(defaultDate); }}>
            Back to {defaultDate === today ? 'today' : 'yesterday'}
          </button>
        </div>
      )}

      {weeklyDue && (
        <div class="banner">
          <span class="grow">
            <strong>Weekly check-in</strong>
            <br />
            <span class="small">{formatWeek(weeklyDue)}</span>
          </span>
          <button class="btn primary" onClick={() => onOpenWeek(weeklyDue)}>Start</button>
        </div>
      )}
      {backupDue && (
        <div class="banner warn">
          <span class="grow small">
            {settings.lastBackupAt ? `Last backup ${backupAge} days ago.` : 'No backup yet.'} Your data only lives on this phone.
          </span>
          <button class="btn" onClick={onOpenSettings}>Back up</button>
        </div>
      )}

      {daily.length === 0 && <div class="empty">No daily questions. Add some in Settings.</div>}

      {groupByCategory(daily).map(([cat, dims]) => (
        <section key={cat}>
          <div class="group-title">{cat}</div>
          {dims.map((d) => (
            <QuestionCard key={d.id} dim={d} period={date} entry={byDim.get(d.id)} />
          ))}
        </section>
      ))}

      <div class="group-title">Note</div>
      <div class="card">
        <NoteField
          key={date}
          value={note?.text ?? ''}
          placeholder="Anything worth remembering about this day? (optional)"
          onSave={(t) => saveDayNote(date, t)}
        />
      </div>

      {daily.length > 0 && done === daily.length && <div class="done-note">All done for {date === today ? 'today' : formatLong(date)}. Nice.</div>}
    </>
  );
}
