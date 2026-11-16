import { useState } from 'preact/hooks';
import type { Dimension, Settings } from '../lib/types';
import { db, saveWeekNote, useLive } from '../lib/db';
import { addWeeks, checkInDate, formatWeek, isoWeek, weekDays } from '../lib/dates';
import { NoteField, QuestionCard } from '../components/QuestionCard';
import { groupByCategory } from '../components/grouping';

interface Props {
  settings: Settings;
  dimensions: Dimension[];
  now: Date;
  initialWeek: string | null;
}

export function Week({ settings, dimensions, now, initialWeek }: Props) {
  const current = isoWeek(checkInDate(now, settings.morningMode, settings.morningCutoff));
  const [week, setWeek] = useState(initialWeek ?? current);
  const weekly = dimensions.filter((d) => d.active && d.frequency === 'weekly');
  const dailyIds = new Set(dimensions.filter((d) => d.frequency === 'daily').map((d) => d.id));
  const days = weekDays(week);

  const entries = useLive(() => db.entries.where('period').equals(week).toArray(), [week]);
  const note = useLive(() => db.weekNotes.get(week), [week]);
  const daysChecked = useLive(
    async () => {
      const es = await db.entries.where('period').anyOf(days).toArray();
      return new Set(es.filter((e) => dailyIds.has(e.dimensionId)).map((e) => e.period)).size;
    },
    [week],
  );

  if (!entries) return null;
  const byDim = new Map(entries.map((e) => [e.dimensionId, e]));
  const done = weekly.filter((d) => byDim.has(d.id)).length;

  return (
    <>
      <div class="header">
        <div>
          <h1>{week === current ? 'How was this week?' : week === addWeeks(current, -1) ? 'How was last week?' : 'How was that week?'}</h1>
          <div class="sub">{formatWeek(week)}</div>
        </div>
        <div class="progress">
          <strong>{done}</strong> / {weekly.length}
        </div>
      </div>
      <div class="progress-bar">
        <div style={{ width: `${weekly.length ? (done / weekly.length) * 100 : 0}%` }} />
      </div>

      <div class="date-switch">
        <button class="icon-btn" aria-label="Previous week" onClick={() => setWeek(addWeeks(week, -1))}>‹</button>
        <div class="date-label">{week === current ? 'This week' : week === addWeeks(current, -1) ? 'Last week' : week.replace('-W', ' · Week ')}</div>
        <button class="icon-btn" aria-label="Next week" disabled={week >= current} onClick={() => setWeek(addWeeks(week, 1))}>›</button>
      </div>

      {daysChecked !== undefined && (
        <div class="muted small" style={{ margin: '0 4px 4px' }}>
          Daily check-ins that week: {daysChecked} of 7 days
        </div>
      )}

      {weekly.length === 0 && <div class="empty">No weekly questions. Add some in Settings.</div>}

      {groupByCategory(weekly).map(([cat, dims]) => (
        <section key={cat}>
          <div class="group-title">{cat}</div>
          {dims.map((d) => (
            <QuestionCard key={d.id} dim={d} period={week} entry={byDim.get(d.id)} />
          ))}
        </section>
      ))}

      <div class="group-title">Reflection</div>
      <div class="card">
        <label class="field">
          <span>One thing that went well</span>
          <NoteField key={`w-${week}`} rows={2} value={note?.wentWell ?? ''} placeholder="(optional)" onSave={(t) => saveWeekNote(week, { wentWell: t })} />
        </label>
        <label class="field" style={{ marginBottom: 0 }}>
          <span>One thing to change</span>
          <NoteField key={`c-${week}`} rows={2} value={note?.toChange ?? ''} placeholder="(optional)" onSave={(t) => saveWeekNote(week, { toChange: t })} />
        </label>
      </div>
      {weekly.length > 0 && done === weekly.length && <div class="done-note">Weekly check-in done.</div>}
    </>
  );
}
