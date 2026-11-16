// All dates are local calendar dates in "YYYY-MM-DD" form. Weeks are ISO weeks "YYYY-Www".

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function todayKey(now = new Date()): string {
  return toKey(now);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(key: string): number {
  return fromKey(key).getDay();
}

export function isoWeek(key: string): string {
  const d = fromKey(key);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4, 12);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day);
  const week = 1 + Math.round((d.getTime() - week1Monday.getTime()) / (7 * 86400000) - 3 / 7);
  return `${year}-W${pad(week)}`;
}

/** Monday of an ISO week key. */
export function weekStart(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4, 12);
  const jan4Day = (jan4.getDay() + 6) % 7;
  jan4.setDate(jan4.getDate() - jan4Day + (w - 1) * 7);
  return toKey(jan4);
}

export function addWeeks(week: string, n: number): string {
  return isoWeek(addDays(weekStart(week), n * 7));
}

export function weekDays(week: string): string[] {
  const start = weekStart(week);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The date the daily check-in should open on. */
export function checkInDate(now: Date, morningMode: boolean, cutoff: string): string {
  const today = toKey(now);
  if (!morningMode) return today;
  const [h, m] = cutoff.split(':').map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < h * 60 + (m || 0) ? addDays(today, -1) : today;
}

/**
 * The week whose weekly check-in is due right now, or null.
 * Due on the check-in day itself and the day after (for morning check-ins).
 */
export function dueWeek(now: Date, checkInDay: number): string | null {
  const today = toKey(now);
  for (let back = 0; back <= 1; back++) {
    const d = addDays(today, -back);
    if (weekday(d) === checkInDay) return isoWeek(d);
  }
  return null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayName = (i: number) => DAYS[i];
export const monthName = (i: number) => MONTHS[i];

export function formatLong(key: string): string {
  const d = fromKey(key);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatWeek(week: string): string {
  const days = weekDays(week);
  return `${formatShort(days[0])} – ${formatShort(days[6])}`;
}

/** "How was yesterday?" style title for a check-in date. */
export function relativeTitle(key: string, now = new Date()): string {
  const diff = diffDays(toKey(now), key);
  if (diff === 0) return 'How was today?';
  if (diff === 1) return 'How was yesterday?';
  return `How was ${formatLong(key)}?`;
}
