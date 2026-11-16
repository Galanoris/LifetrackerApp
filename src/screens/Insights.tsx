import { useMemo, useState } from 'preact/hooks';
import type { Dimension, Entry, Settings } from '../lib/types';
import { db, useLive } from '../lib/db';
import { addDays, addWeeks, checkInDate, formatLong, formatShort, isoWeek, weekDays, weekStart } from '../lib/dates';
import { categoryScore, compareBy, dailySeries, goodScore, numeric, questionStats, rangeAverage, streaks } from '../lib/stats';
import { Heatmap, LineChart, type HeatCell, type LinePoint } from '../components/Charts';
import { groupByCategory } from '../components/grouping';

const RANGES = [
  { days: 28, label: '4 weeks' },
  { days: 91, label: '3 months' },
  { days: 182, label: '6 months' },
  { days: 365, label: '1 year' },
];

const f1 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v.toFixed(1));

interface Props {
  settings: Settings;
  dimensions: Dimension[];
  now: Date;
}

export function Insights({ settings, dimensions, now }: Props) {
  const [rangeDays, setRangeDays] = useState(28);
  const end = checkInDate(now, settings.morningMode, settings.morningCutoff);
  const start = addDays(end, -(rangeDays - 1));
  const entries = useLive(() => db.entries.toArray(), []);

  const active = dimensions.filter((d) => d.active);
  const firstRating = active.find((d) => d.frequency === 'daily' && d.scale === 'rating5');
  const [focus, setFocus] = useState<string>(() => (firstRating ? `q:${firstRating.id}` : ''));

  const days = useMemo(() => Array.from({ length: rangeDays }, (_, i) => addDays(start, i)), [start, rangeDays]);
  const byDim = useMemo(() => {
    const m = new Map<string, Map<string, Entry>>();
    for (const d of dimensions) m.set(d.id, new Map());
    for (const e of entries ?? []) m.get(e.dimensionId)?.set(e.period, e);
    return m;
  }, [entries, dimensions]);

  if (!entries) return null;

  const dailyIds = new Set(dimensions.filter((d) => d.frequency === 'daily').map((d) => d.id));
  const dayset = new Set(days);
  const checked = new Set(entries.filter((e) => dailyIds.has(e.dimensionId) && dayset.has(e.period)).map((e) => e.period));

  if (entries.length === 0) {
    return (
      <>
        <Header />
        <div class="empty card">
          Check in for a few days and your patterns will show up here: a calendar per question, trends, and how your categories compare week to week.
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div class="seg" role="tablist">
        {RANGES.map((r) => (
          <button key={r.days} class={rangeDays === r.days ? 'on' : ''} onClick={() => setRangeDays(r.days)}>{r.label}</button>
        ))}
      </div>

      <div class="stat-row">
        <div class="stat">
          <div class="num">{checked.size}<span class="muted" style={{ fontSize: 15, fontWeight: 500 }}> / {rangeDays}</span></div>
          <div class="lbl">days checked in</div>
        </div>
        <div class="stat">
          <div class="num">{firstRating ? f1(rangeAverage(firstRating, byDim.get(firstRating.id)!, start, end)) : '–'}</div>
          <div class="lbl">avg {firstRating?.shortLabel.toLowerCase() ?? 'rating'}</div>
        </div>
        <div class="stat">
          <div class="num">{f1(categoryScore(active, entries, days))}</div>
          <div class="lbl">overall score (1–5)</div>
        </div>
      </div>

      <WeekCompare dimensions={active} entries={entries} end={end} />

      <div class="card">
        <label class="field" style={{ marginBottom: 10 }}>
          <span>Trend for</span>
          <select value={focus} onChange={(e) => setFocus((e.target as HTMLSelectElement).value)}>
            <optgroup label="Categories (weekly score)">
              {groupByCategory(active).map(([c]) => <option key={c} value={`c:${c}`}>{c}</option>)}
            </optgroup>
            <optgroup label="Daily questions">
              {active.filter((d) => d.frequency === 'daily' && d.scale !== 'text').map((d) => <option key={d.id} value={`q:${d.id}`}>{d.shortLabel}</option>)}
            </optgroup>
            <optgroup label="Weekly questions">
              {active.filter((d) => d.frequency === 'weekly' && d.scale !== 'text').map((d) => <option key={d.id} value={`q:${d.id}`}>{d.shortLabel}</option>)}
            </optgroup>
            {dimensions.some((d) => !d.active) && (
              <optgroup label="Archived">
                {dimensions.filter((d) => !d.active && d.scale !== 'text').map((d) => <option key={d.id} value={`q:${d.id}`}>{d.shortLabel}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <Focus focus={focus} dimensions={dimensions} entries={entries} byDim={byDim} days={days} start={start} end={end} />
      </div>

      <Streaks dimensions={active} byDim={byDim} end={end} />
      <Compare dimensions={active} byDim={byDim} />
      <AnswerRates dimensions={active} byDim={byDim} days={days} />
    </>
  );
}

function Header() {
  return (
    <div class="header">
      <div>
        <h1>Insights</h1>
        <div class="sub">Everything is computed on this phone.</div>
      </div>
    </div>
  );
}

/** Category scores: last 7 days vs the 7 days before (weekly answers count for the weeks touched). */
function WeekCompare({ dimensions, entries, end }: { dimensions: Dimension[]; entries: Entry[]; end: string }) {
  const thisDays = Array.from({ length: 7 }, (_, i) => addDays(end, -i));
  const lastDays = Array.from({ length: 7 }, (_, i) => addDays(end, -7 - i));
  const rows = groupByCategory(dimensions.filter((d) => d.scale === 'rating5'))
    .map(([cat, dims]) => ({
      cat,
      now: categoryScore(dims, entries, thisDays),
      prev: categoryScore(dims, entries, lastDays),
    }))
    .filter((r) => r.now !== null || r.prev !== null);
  if (!rows.length) return null;
  const pct = (v: number) => `${((v - 1) / 4) * 100}%`;
  return (
    <div class="card">
      <div class="chart-title">Your week by category</div>
      <div class="chart-sub">Last 7 days, average 1–5 score (stress counted inverted). Tick = the 7 days before.</div>
      {rows.map((r) => {
        const delta = r.now !== null && r.prev !== null ? r.now - r.prev : null;
        return (
          <div class="cat-row" key={r.cat}>
            <span>{r.cat}</span>
            <div class="bar-track">
              {r.now !== null && <div class="bar" style={{ width: pct(r.now) }} />}
              {r.prev !== null && <div class="bar-prev" style={{ left: `calc(${pct(r.prev)} - 1px)` }} title={`7 days before: ${f1(r.prev)}`} />}
            </div>
            <span class="val">
              {f1(r.now)}
              {delta !== null && Math.abs(delta) >= 0.05 && <span class="delta">{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</span>}
            </span>
          </div>
        );
      })}
      <details>
        <summary>Show as table</summary>
        <table class="data">
          <thead><tr><th>Category</th><th>Last 7 days</th><th>7 days before</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.cat}><td>{r.cat}</td><td>{f1(r.now)}</td><td>{f1(r.prev)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

interface FocusProps {
  focus: string;
  dimensions: Dimension[];
  entries: Entry[];
  byDim: Map<string, Map<string, Entry>>;
  days: string[];
  start: string;
  end: string;
}

function weeksIn(start: string, end: string): string[] {
  const out: string[] = [];
  for (let w = isoWeek(start); w <= isoWeek(end); w = addWeeks(w, 1)) out.push(w);
  return out;
}

function Focus({ focus, dimensions, entries, byDim, days, start, end }: FocusProps) {
  if (focus.startsWith('c:')) {
    const cat = focus.slice(2);
    const dims = dimensions.filter((d) => d.category === cat && d.scale === 'rating5');
    const points: LinePoint[] = weeksIn(start, end).map((w) => {
      const wd = weekDays(w).filter((d) => d >= start && d <= end);
      return { key: w, label: formatShort(weekStart(w)), value: categoryScore(dims, entries, wd) };
    });
    if (!dims.length) return <div class="muted small">This category has no 1–5 questions to score.</div>;
    return (
      <>
        <div class="chart-title">{cat}</div>
        <div class="chart-sub">Weekly average of {dims.map((d) => d.shortLabel).join(', ')}</div>
        <LineChart points={points} yMin={1} yMax={5} yTicks={[1, 2, 3, 4, 5]} format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))} />
      </>
    );
  }

  const dim = dimensions.find((d) => `q:${d.id}` === focus);
  if (!dim) return null;
  const map = byDim.get(dim.id)!;
  const fmt = (v: number) =>
    dim.scale === 'yesno' ? `${Math.round(v * 100)}%` : dim.scale === 'hours' ? `${Number.isInteger(v) ? v : v.toFixed(1)}h` : Number.isInteger(v) ? String(v) : v.toFixed(1);

  if (dim.frequency === 'weekly') {
    const points: LinePoint[] = weeksIn(start, end).map((w) => ({ key: w, label: formatShort(weekStart(w)), value: numeric(dim, map.get(w)?.value) }));
    const yMin = dim.scale === 'rating5' ? 1 : 0;
    const yMax = dim.scale === 'rating5' ? 5 : dim.scale === 'yesno' ? 1 : Math.max(dim.max ?? 1, ...points.map((p) => p.value ?? 0));
    return (
      <>
        <div class="chart-title">{dim.question}</div>
        <div class="chart-sub">Weekly answers{dim.higherIsBetter ? '' : ' · lower is better'}</div>
        <LineChart points={points} yMin={yMin} yMax={yMax} yTicks={ticks(yMin, yMax, dim)} format={fmt} />
      </>
    );
  }

  const series = dailySeries(dim, map, start, end);
  const points: LinePoint[] = series.map((p) => ({ key: p.date, label: formatShort(p.date), value: p.value, avg: p.avg }));
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  const yMin = dim.scale === 'rating5' ? 1 : 0;
  const yMax = dim.scale === 'rating5' ? 5 : dim.scale === 'yesno' ? 1 : Math.max(dim.max ?? 0, ...values, 1);
  const last4 = rangeAverage(dim, map, addDays(end, -27), end);
  const prev4 = rangeAverage(dim, map, addDays(end, -55), addDays(end, -28));
  const st = questionStats(map, days);

  const cells: HeatCell[] = days.map((d) => {
    const e = map.get(d);
    let step: HeatCell['step'] = null;
    if (e && e.value === null) step = 'skip';
    else if (e && dim.scale === 'rating5') step = goodScore(dim, e.value);
    else if (e && dim.scale === 'yesno') step = e.value ? 5 : 3;
    else if (e && typeof e.value === 'number') {
      const lo = dim.min ?? 0, hi = dim.max ?? Math.max(...values, 1);
      step = 1 + Math.round(((e.value - lo) / (hi - lo || 1)) * 4);
      step = Math.max(1, Math.min(5, step));
    }
    const shown = !e ? 'no answer' : e.value === null ? (dim.naLabel ?? 'skipped') : dim.scale === 'yesno' ? (e.value ? 'yes' : 'no') : fmt(e.value as number);
    return { date: d, step, label: `${formatLong(d)}: ${shown}` };
  });
  const heatLegend =
    dim.scale === 'yesno'
      ? [{ cls: 'r5', label: 'Yes' }, { cls: 'r3', label: 'No' }, { cls: 'empty', label: 'No answer' }]
      : dim.scale === 'rating5'
        ? [{ cls: 'r1', label: dim.higherIsBetter ? '1' : '5' }, { cls: 'r3', label: '3' }, { cls: 'r5', label: dim.higherIsBetter ? '5 (best)' : '1 (best)' }, { cls: 'empty', label: 'No answer' }]
        : [{ cls: 'r1', label: 'Low' }, { cls: 'r5', label: 'High' }, { cls: 'empty', label: 'No answer' }];

  return (
    <>
      <div class="chart-title">{dim.question}</div>
      <div class="chart-sub">
        {dim.scale === 'yesno' ? 'Share of yes, 7-day rolling' : dim.higherIsBetter ? 'Daily answers' : 'Daily answers · lower is better'}
      </div>
      {(dim.scale === 'rating5' || dim.scale === 'yesno' || dim.scale === 'hours') && <Heatmap cells={cells} legend={heatLegend} />}
      <div style={{ height: 14 }} />
      <LineChart points={points} yMin={yMin} yMax={yMax} yTicks={ticks(yMin, yMax, dim)} format={fmt} />
      <div class="cmp" style={{ marginTop: 12 }}>
        <div class="stat">
          <div class="num">{last4 === null ? '–' : fmt(last4)}</div>
          <div class="lbl">last 4 weeks</div>
        </div>
        <div class="stat">
          <div class="num">{prev4 === null ? '–' : fmt(prev4)}</div>
          <div class="lbl">4 weeks before</div>
        </div>
      </div>
      <div class="muted small" style={{ marginTop: 8 }}>
        In this range: {st.answered} answered · {st.skipped} {dim.naLabel ? 'N/A or skipped' : 'skipped'} · {st.missing} not answered
      </div>
    </>
  );
}

function ticks(min: number, max: number, dim: Dimension): number[] {
  if (dim.scale === 'rating5') return [1, 2, 3, 4, 5];
  if (dim.scale === 'yesno') return [0, 0.5, 1];
  const step = max - min > 10 ? 4 : 2;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
  return out;
}

function Streaks({ dimensions, byDim, end }: { dimensions: Dimension[]; byDim: Map<string, Map<string, Entry>>; end: string }) {
  const habits = dimensions.filter((d) => d.frequency === 'daily' && d.scale === 'yesno');
  if (!habits.length) return null;
  return (
    <div class="card">
      <div class="chart-title">Habits</div>
      <div class="chart-sub">Consecutive "yes" days, and how often in the last 30 days.</div>
      <table class="data">
        <thead><tr><th>Habit</th><th>Current</th><th>Best</th><th>Last 30 d</th></tr></thead>
        <tbody>
          {habits.map((d) => {
            const m = byDim.get(d.id)!;
            const s = streaks(m, end);
            let yes = 0;
            for (let i = 0; i < 30; i++) if (m.get(addDays(end, -i))?.value === true) yes++;
            return (
              <tr key={d.id}>
                <td>{d.shortLabel}</td>
                <td>{s.current} d</td>
                <td>{s.best} d</td>
                <td>{yes} / 30</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Compare({ dimensions, byDim }: { dimensions: Dimension[]; byDim: Map<string, Map<string, Entry>> }) {
  const daily = dimensions.filter((d) => d.frequency === 'daily' && d.scale !== 'text');
  const xDefault = daily.find((d) => d.scale === 'hours') ?? daily[0];
  const yDefault = daily.find((d) => d.scale === 'rating5') ?? daily[0];
  const [xId, setX] = useState(xDefault?.id ?? '');
  const [yId, setY] = useState(yDefault?.id ?? '');
  const x = daily.find((d) => d.id === xId);
  const y = daily.find((d) => d.id === yId);
  const xVals = x ? [...byDim.get(x.id)!.values()].map((e) => numeric(x, e.value)).filter((v): v is number => v !== null) : [];
  const median = xVals.length ? [...xVals].sort((a, b) => a - b)[Math.floor(xVals.length / 2)] : 0;
  const defaultThreshold = x?.scale === 'hours' ? (x.id.includes('sleep') ? 7 : Math.max(0.5, median)) : x?.scale === 'rating5' ? 4 : median;
  const [thr, setThr] = useState<number | null>(null);
  const threshold = thr ?? defaultThreshold;
  if (!x || !y) return null;
  const [hi, lo] = compareBy(x, byDim.get(x.id)!, y, byDim.get(y.id)!, threshold);
  const fmtY = (v: number | null) => (v === null ? '–' : y.scale === 'yesno' ? `${Math.round(v * 100)}%` : v.toFixed(1));
  const enough = hi.days >= 3 && lo.days >= 3;

  return (
    <div class="card">
      <div class="chart-title">Compare</div>
      <div class="chart-sub">Simple split of your days, not statistics. Needs a few days on each side.</div>
      <div class="row">
        <label class="field">
          <span>On days when</span>
          <select value={xId} onChange={(e) => { setX((e.target as HTMLSelectElement).value); setThr(null); }}>
            {daily.map((d) => <option key={d.id} value={d.id}>{d.shortLabel}</option>)}
          </select>
        </label>
        {x.scale !== 'yesno' && (
          <label class="field" style={{ flex: '0 0 84px' }}>
            <span>is at least</span>
            <input type="number" inputMode="decimal" step={x.step ?? 1} value={threshold} onInput={(e) => setThr(Number((e.target as HTMLInputElement).value))} />
          </label>
        )}
      </div>
      <label class="field">
        <span>…how is</span>
        <select value={yId} onChange={(e) => setY((e.target as HTMLSelectElement).value)}>
          {daily.filter((d) => d.id !== xId).map((d) => <option key={d.id} value={d.id}>{d.shortLabel}</option>)}
        </select>
      </label>
      <div class="cmp">
        {[hi, lo].map((c) => (
          <div class="stat" key={c.label}>
            <div class="num">{fmtY(c.avg)}</div>
            <div class="lbl">{x.shortLabel}: {c.label} · {c.days} days</div>
          </div>
        ))}
      </div>
      {!enough && <div class="muted small" style={{ marginTop: 8 }}>Not enough days yet on both sides to say much.</div>}
      {enough && hi.avg !== null && lo.avg !== null && (
        <div class="small" style={{ marginTop: 8 }}>
          {y.shortLabel} averages <strong>{fmtY(hi.avg)}</strong> when {x.shortLabel.toLowerCase()} is {hi.label.toLowerCase()}, vs <strong>{fmtY(lo.avg)}</strong> otherwise
          {y.scale === 'rating5' && !y.higherIsBetter ? ' (lower is better)' : ''}.
        </div>
      )}
    </div>
  );
}

function AnswerRates({ dimensions, byDim, days }: { dimensions: Dimension[]; byDim: Map<string, Map<string, Entry>>; days: string[] }) {
  const daily = dimensions.filter((d) => d.frequency === 'daily');
  const weeks = [...new Set(days.map(isoWeek))];
  const weekly = dimensions.filter((d) => d.frequency === 'weekly');
  const dayMax = days.length;
  const rows = [
    ...daily.map((d) => ({ d, s: questionStats(byDim.get(d.id)!, days), n: dayMax })),
    ...weekly.map((d) => ({ d, s: questionStats(byDim.get(d.id)!, weeks), n: weeks.length })),
  ];
  const firstDay = days.find((d) => daily.some((q) => byDim.get(q.id)!.has(d)));
  return (
    <div class="card">
      <div class="chart-title">Answer rates</div>
      <div class="chart-sub">
        Questions you skip a lot are candidates to trim{firstDay ? ` · counting from ${formatShort(days[0])}` : ''}.
      </div>
      <details>
        <summary>Show per question</summary>
        <table class="data">
          <thead><tr><th>Question</th><th>Answered</th><th>Skipped</th><th>Rate</th></tr></thead>
          <tbody>
            {rows.map(({ d, s, n }) => (
              <tr key={d.id}>
                <td>{d.shortLabel}{d.frequency === 'weekly' ? ' (wk)' : ''}</td>
                <td>{s.answered}</td>
                <td>{s.skipped}</td>
                <td>{n ? Math.round(((s.answered + s.skipped) / n) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

