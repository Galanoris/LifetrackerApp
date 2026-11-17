import { useState } from 'preact/hooks';
import type { Dimension, Settings } from '../lib/types';
import { db, saveWeekNote, useLive } from '../lib/db';
import { addWeeks, checkInDate, formatWeek, isoWeek, weekDays } from '../lib/dates';
import { NoteField, QuestionCard } from '../components/QuestionCard';
import { groupByCategory, splitHeadline } from '../components/grouping';
import { ChevronLeft, ChevronRight } from '../components/Icons';

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
  const [head1, head2] = splitHeadline(week === current ? 'How was this week?' : week === addWeeks(current, -1) ? 'How was last week?' : 'How was that week?');
  const byDim = new Map(entries.map((e) => [e.dimensionId, e]));
  const done = weekly.filter((d) => byDim.has(d.id)).length;

  return (
    <>
      <div class="hero">
        <div class="eyebrow">Weekly check-in · Week {week.split('-W')[1]}</div>
        <h1 class="display">
          {head1}
          <span class="indent">{head2}</span>
        </h1>
        <div class="meta-row">
          <button class="circle-btn" aria-label="Previous week" onClick={() => setWeek(addWeeks(week, -1))}><ChevronLeft /></button>
          <span class="key key-date">{formatWeek(week)}</span>
          <button class="circle-btn" aria-label="Next week" disabled={week >= current} onClick={() => setWeek(addWeeks(week, 1))}><ChevronRight /></button>
          <span class="spacer" />
          <span class="key-num">{done}<span>/{weekly.length}</span></span>
        </div>
        <div class="progress-line">
          <div style={{ width: `${weekly.length ? (done / weekly.length) * 100 : 0}%` }} />
        </div>
        {daysChecked !== undefined && (
          <div class="muted small" style={{ marginTop: 12 }}>
            Daily check-ins that week: {daysChecked} of 7 days
          </div>
        )}
      </div>

      {weekly.length === 0 && <div class="empty">No weekly questions. Add some in Settings.</div>}

      {groupByCategory(weekly).map(([cat, dims], i) => (
        <section key={cat}>
          <div class="group-title"><span class="idx">{String(i + 1).padStart(2, '0')}</span>{cat}</div>
          {dims.map((d) => (
            <QuestionCard key={d.id} dim={d} period={week} entry={byDim.get(d.id)} />
          ))}
        </section>
      ))}

      <div class="group-title"><span class="idx">✎</span>Reflection</div>
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
