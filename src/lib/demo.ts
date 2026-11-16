// Dev only: `npm run dev` then open /?demo to get a separate database with ~10 weeks of fake answers.
import { db, setEntry, saveDayNote, saveWeekNote } from './db';
import { addDays, addWeeks, isoWeek, todayKey } from './dates';

export const isDemo = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

export async function fillDemo() {
  if ((await db.entries.count()) > 0) return;
  const dims = await db.dimensions.toArray();
  const today = todayKey();
  let mood = 3.4;
  for (let i = 70; i >= 1; i--) {
    const d = addDays(today, -i);
    if (Math.random() < 0.12) continue; // missed day
    mood = Math.min(4.6, Math.max(1.8, mood + (Math.random() - 0.5) * 0.8));
    const sleep = Math.round((6 + Math.random() * 2.5) * 2) / 2;
    for (const q of dims.filter((x) => x.frequency === 'daily')) {
      let v: number | boolean | null;
      if (q.scale === 'hours') v = q.id.includes('sleep') ? sleep : [0, 6, 7.5, 8, 8.5, 9][Math.floor(Math.random() * 6)];
      else if (q.scale === 'yesno') v = Math.random() < 0.55;
      else {
        const base = q.higherIsBetter ? mood + (sleep - 7) * 0.4 : 6 - mood;
        v = Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5) * 1.6)));
      }
      if (q.naLabel && Math.random() < 0.15) v = null;
      await setEntry(q.id, d, v);
    }
    if (Math.random() < 0.3) await saveDayNote(d, 'Good conversation at dinner. Felt focused in the morning.');
  }
  for (let w = 1; w <= 10; w++) {
    const wk = addWeeks(isoWeek(today), -w);
    for (const q of dims.filter((x) => x.frequency === 'weekly')) await setEntry(q.id, wk, 2 + Math.floor(Math.random() * 4));
    await saveWeekNote(wk, { wentWell: 'Long walk on Saturday.' });
  }
}
