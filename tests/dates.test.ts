import { describe, expect, it } from 'vitest';
import { addWeeks, checkInDate, dueWeek, isoWeek, weekDays, weekStart } from '../src/lib/dates';

describe('iso weeks', () => {
  it.each([
    ['2026-11-16', '2026-W47'],
    ['2026-11-22', '2026-W47'],
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2021-01-03', '2020-W53'],
    ['2024-12-30', '2025-W01'],
    ['2025-12-28', '2025-W52'],
  ])('%s -> %s', (d, w) => expect(isoWeek(d)).toBe(w));

  it('weekStart is the Monday and round-trips', () => {
    expect(weekStart('2026-W47')).toBe('2026-11-16');
    expect(weekStart('2025-W01')).toBe('2024-12-30');
    for (const w of ['2026-W01', '2026-W53', '2020-W53', '2027-W10']) expect(isoWeek(weekStart(w))).toBe(w);
  });

  it('addWeeks crosses years', () => {
    expect(addWeeks('2026-W53', 1)).toBe('2027-W01');
    expect(addWeeks('2027-W01', -1)).toBe('2026-W53');
    expect(weekDays('2026-W47')).toHaveLength(7);
  });
});

describe('check-in date', () => {
  it('morning mode opens yesterday before the cutoff', () => {
    expect(checkInDate(new Date(2026, 10, 16, 7, 30), true, '12:00')).toBe('2026-11-15');
    expect(checkInDate(new Date(2026, 10, 16, 12, 0), true, '12:00')).toBe('2026-11-16');
    expect(checkInDate(new Date(2026, 10, 16, 7, 30), false, '12:00')).toBe('2026-11-16');
  });

  it('weekly check-in is due on Sunday and Monday', () => {
    expect(dueWeek(new Date(2026, 10, 22, 9), 0)).toBe('2026-W47'); // Sunday
    expect(dueWeek(new Date(2026, 10, 23, 9), 0)).toBe('2026-W47'); // Monday
    expect(dueWeek(new Date(2026, 10, 24, 9), 0)).toBeNull(); // Tuesday
  });
});
