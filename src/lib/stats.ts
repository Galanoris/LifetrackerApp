import type { DayNote, Dimension, Entry, EntryValue } from './types';
import { addDays, diffDays, isoWeek } from './dates';

/** Numeric value for charts: ratings/hours/numbers as-is, yes = 1, no = 0. */
export function numeric(dim: Dimension, v: EntryValue | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (dim.scale === 'yesno') return v === true ? 1 : v === false ? 0 : null;
  if (dim.scale === 'text') return null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 1-5 where 5 is always "good" (stress is flipped). Only for rating5 questions. */
export function goodScore(dim: Dimension, v: EntryValue | undefined): number | null {
  if (dim.scale !== 'rating5' || typeof v !== 'number') return null;
  return dim.higherIsBetter ? v : 6 - v;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Map of period -> entry for one dimension. */
export function byPeriod(entries: Entry[], dimensionId: string): Map<string, Entry> {
  const m = new Map<string, Entry>();
  for (const e of entries) if (e.dimensionId === dimensionId) m.set(e.period, e);
  return m;
}

export interface Point {
  date: string;
  value: number | null;
  avg: number | null;
}

/** Daily series with a trailing 7-day rolling average (needs >= 3 values in the window). */
export function dailySeries(dim: Dimension, entries: Map<string, Entry>, from: string, to: string): Point[] {
  const out: Point[] = [];
  const n = diffDays(to, from);
  for (let i = 0; i <= n; i++) {
    const date = addDays(from, i);
    const value = numeric(dim, entries.get(date)?.value);
    const window: number[] = [];
    for (let k = 0; k < 7; k++) {
      const v = numeric(dim, entries.get(addDays(date, -k))?.value);
      if (v !== null) window.push(v);
    }
    out.push({ date, value, avg: window.length >= 3 ? mean(window) : null });
  }
  return out;
}

/** Average of numeric values in [from, to] (inclusive). */
export function rangeAverage(dim: Dimension, entries: Map<string, Entry>, from: string, to: string): number | null {
  const vals: number[] = [];
  for (let i = 0; i <= diffDays(to, from); i++) {
    const v = numeric(dim, entries.get(addDays(from, i))?.value);
    if (v !== null) vals.push(v);
  }
  return mean(vals);
}

/**
 * Category score for a set of days: mean of good-oriented 1-5 scores of the category's
 * rating questions. Weekly questions count for the ISO weeks the days fall in.
 */
export function categoryScore(dims: Dimension[], entries: Entry[], days: string[]): number | null {
  const weeks = new Set(days.map(isoWeek));
  const dayset = new Set(days);
  const ids = new Map(dims.map((d) => [d.id, d]));
  const vals: number[] = [];
  for (const e of entries) {
    const d = ids.get(e.dimensionId);
    if (!d) continue;
    const inRange = d.frequency === 'daily' ? dayset.has(e.period) : weeks.has(e.period);
    if (!inRange) continue;
    const s = goodScore(d, e.value);
    if (s !== null) vals.push(s);
  }
  return mean(vals);
}

/** Days in range with at least one daily answer (skips count as checking in). */
export function checkedInDays(dailyIds: Set<string>, entries: Entry[]): Set<string> {
  const s = new Set<string>();
  for (const e of entries) if (dailyIds.has(e.dimensionId)) s.add(e.period);
  return s;
}

export interface QuestionStats {
  answered: number;
  skipped: number;
  missing: number;
}

export function questionStats(entries: Map<string, Entry>, periods: string[]): QuestionStats {
  let answered = 0, skipped = 0, missing = 0;
  for (const p of periods) {
    const e = entries.get(p);
    if (!e) missing++;
    else if (e.value === null) skipped++;
    else answered++;
  }
  return { answered, skipped, missing };
}

/** Yes/no streaks, counting back from `today` (today may still be unanswered). */
export function streaks(entries: Map<string, Entry>, today: string): { current: number; best: number } {
  let current = 0;
  let d = today;
  if (entries.get(d)?.value !== true) d = addDays(d, -1);
  while (entries.get(d)?.value === true) {
    current++;
    d = addDays(d, -1);
  }
  const yesDays = [...entries.values()].filter((e) => e.value === true).map((e) => e.period).sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const day of yesDays) {
    run = prev && diffDays(day, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best };
}

export interface Comparison {
  label: string;
  avg: number | null;
  days: number;
}

/**
 * Split days by a condition on question X, compare the average of question Y.
 * Rating / hours / number X: split at threshold (>=). Yes/no X: yes vs no.
 */
export function compareBy(
  x: Dimension,
  xEntries: Map<string, Entry>,
  y: Dimension,
  yEntries: Map<string, Entry>,
  threshold: number,
): [Comparison, Comparison] {
  const hi: number[] = [], lo: number[] = [];
  for (const [period, xe] of xEntries) {
    const xv = numeric(x, xe.value);
    const yv = numeric(y, yEntries.get(period)?.value);
    if (xv === null || yv === null) continue;
    (x.scale === 'yesno' ? xv === 1 : xv >= threshold) ? hi.push(yv) : lo.push(yv);
  }
  const unit = x.scale === 'hours' ? ' h' : '';
  const hiLabel = x.scale === 'yesno' ? 'Yes' : `${threshold}${unit} or more`;
  const loLabel = x.scale === 'yesno' ? 'No' : `Under ${threshold}${unit}`;
  return [
    { label: hiLabel, avg: mean(hi), days: hi.length },
    { label: loLabel, avg: mean(lo), days: lo.length },
  ];
}

// ---------- CSV export (wide layout, like the original spreadsheet) ----------

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function displayValue(dim: Dimension, e: Entry | undefined): string {
  if (!e) return '';
  if (e.value === null) return dim.naLabel ? 'N/A' : 'skip';
  if (dim.scale === 'yesno') return e.value ? 'yes' : 'no';
  return String(e.value);
}

export function buildCsv(dims: Dimension[], entries: Entry[], dayNotes: DayNote[], today: string): string {
  const daily = dims.filter((d) => d.frequency === 'daily').sort((a, b) => a.order - b.order);
  const weekly = dims.filter((d) => d.frequency === 'weekly').sort((a, b) => a.order - b.order);
  const dailyIds = new Set(daily.map((d) => d.id));
  const dates = entries.filter((e) => dailyIds.has(e.dimensionId)).map((e) => e.period);
  dates.push(...dayNotes.map((n) => n.date));
  const first = dates.sort()[0] ?? today;
  const last = dates.sort().at(-1) ?? today;
  const end = last > today ? last : today;
  const days: string[] = [];
  for (let d = first; d <= end; d = addDays(d, 1)) days.push(d);

  const map = new Map(entries.map((e) => [e.id, e]));
  const rows: string[][] = [];
  const meta = (d: Dimension) => [d.category, d.question, d.scale + (d.higherIsBetter ? '' : ' (lower is better)'), d.active ? '' : 'archived'];

  rows.push(['Category', 'Question', 'Scale', 'Status', ...days]);
  for (const d of daily) rows.push([...meta(d), ...days.map((p) => displayValue(d, map.get(`${d.id}|${p}`)))]);
  const notes = new Map(dayNotes.map((n) => [n.date, n.text]));
  rows.push(['', 'Day note', 'text', '', ...days.map((p) => notes.get(p) ?? '')]);

  if (weekly.length) {
    const weekIds = new Set(weekly.map((d) => d.id));
    const weekSet = new Set(entries.filter((e) => weekIds.has(e.dimensionId)).map((e) => e.period));
    for (const d of days) weekSet.add(isoWeek(d));
    const weeks = [...weekSet].sort();
    rows.push([]);
    rows.push(['Category', 'Question', 'Scale', 'Status', ...weeks]);
    for (const d of weekly) rows.push([...meta(d), ...weeks.map((p) => displayValue(d, map.get(`${d.id}|${p}`)))]);
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
