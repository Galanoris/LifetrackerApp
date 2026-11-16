export type Frequency = 'daily' | 'weekly';
export type Scale = 'rating5' | 'hours' | 'yesno' | 'number' | 'text';
export type EntryValue = number | boolean | string | null;

export interface Anchors {
  1?: string;
  3?: string;
  5?: string;
}

/** A question. Questions are data and can be edited inside the app. */
export interface Dimension {
  id: string;
  category: string;
  question: string;
  shortLabel: string;
  frequency: Frequency;
  scale: Scale;
  anchors?: Anchors;
  /** false for e.g. stress, so charts colour it correctly */
  higherIsBetter: boolean;
  /** e.g. "No work today". Choosing it stores null, like a skip. */
  naLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Starting value for steppers (hours / number). */
  defaultValue?: number;
  /** Shown small under the question (e.g. how auto-tick works). */
  hint?: string;
  /** yes/no only: auto-tick "yes" when the day note has a few sentences. */
  autoFromNote?: boolean;
  order: number;
  /** false = archived; history is kept */
  active: boolean;
  createdAt: string;
}

/** One answer. No entry = not answered yet; value null = skipped / N/A on purpose. */
export interface Entry {
  id: string; // `${dimensionId}|${period}`
  dimensionId: string;
  period: string; // "2026-11-16" (daily) or "2026-W47" (weekly)
  value: EntryValue;
  note?: string;
  auto?: boolean; // set automatically (e.g. journaling from the day note)
  updatedAt: string;
}

export interface DayNote {
  date: string;
  text: string;
  updatedAt: string;
}

export interface WeekNote {
  week: string;
  wentWell: string;
  toChange: string;
  updatedAt: string;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  id: 'settings';
  /** 1 = Monday (ISO). Week keys are always ISO weeks. */
  weekStartsOn: 0 | 1;
  /** 0 = Sunday ... 6 = Saturday */
  weeklyCheckInDay: number;
  /** "HH:MM": before this, the daily check-in opens on yesterday. */
  morningCutoff: string;
  morningMode: boolean;
  theme: Theme;
  lastBackupAt: string | null;
  schemaVersion: number;
  seededAt: string;
}

export interface BackupFile {
  app: 'good-life-tracker';
  format: 1;
  exportedAt: string;
  schemaVersion: number;
  settings: Settings;
  dimensions: Dimension[];
  entries: Entry[];
  dayNotes: DayNote[];
  weekNotes: WeekNote[];
}
