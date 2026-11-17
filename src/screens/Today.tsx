import { useEffect, useState } from 'preact/hooks';
import type { Dimension, Settings } from '../lib/types';
import { db, saveDayNote, useLive } from '../lib/db';
import { addDays, checkInDate, diffDays, formatLong, formatWeek, relativeTitle, todayKey } from '../lib/dates';
import { NoteField, QuestionCard } from '../components/QuestionCard';
import { groupByCategory, splitHeadline } from '../components/grouping';
import { ArrowRight, ChevronLeft, ChevronRight } from '../components/Icons';

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

  const [head1, head2] = splitHeadline(relativeTitle(date, now));
  const backupAge = settings.lastBackupAt
    ? diffDays(today, settings.lastBackupAt.slice(0, 10))
    : diffDays(today, settings.seededAt.slice(0, 10));
  const backupDue = !!hasAnyEntry && backupAge >= 7;

  return (
    <>
      {weeklyDue && (
        <button class="announce" onClick={() => onOpenWeek(weeklyDue)}>
          Weekly check-in · {formatWeek(weeklyDue)} <ArrowRight />
        </button>
      )}

      <div class="hero">
        <div class="eyebrow">Daily check-in</div>
        <h1 class="display">
          {head1}
          <span class="indent">{head2}</span>
        </h1>
        <div class="meta-row">
          <button class="circle-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}><ChevronLeft /></button>
          <label class="key key-date">
            {formatLong(date)}
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
          <button class="circle-btn" aria-label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}><ChevronRight /></button>
          <span class="spacer" />
          <span class="key-num" aria-label={`${done} of ${daily.length} answered`}>
            {done}<span>/{daily.length}</span>
          </span>
        </div>
        <div class="progress-line">
          <div style={{ width: `${daily.length ? (done / daily.length) * 100 : 0}%` }} />
        </div>
        {pinned && date !== defaultDate && (
          <div class="back-link">
            <button class="link-btn" onClick={() => { setPinned(false); setDate(defaultDate); }}>
              Back to {defaultDate === today ? 'today' : 'yesterday'} →
            </button>
          </div>
        )}
      </div>
      {backupDue && (
        <div class="banner warn" style={{ marginTop: 24 }}>
          <span class="grow small">
            {settings.lastBackupAt ? `Last backup ${backupAge} days ago.` : 'No backup yet.'} Your data only lives on this phone.
          </span>
          <button class="btn" onClick={onOpenSettings}>Back up</button>
        </div>
      )}

      {daily.length === 0 && <div class="empty">No daily questions. Add some in Settings.</div>}

      {groupByCategory(daily).map(([cat, dims], i) => (
        <section key={cat}>
          <div class="group-title"><span class="idx">{String(i + 1).padStart(2, '0')}</span>{cat}</div>
          {dims.map((d) => (
            <QuestionCard key={d.id} dim={d} period={date} entry={byDim.get(d.id)} />
          ))}
        </section>
      ))}

      <div class="group-title"><span class="idx">✎</span>Note</div>
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
