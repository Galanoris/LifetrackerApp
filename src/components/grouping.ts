import type { Dimension } from '../lib/types';

/** Group questions by category, categories ordered by their first question. */
export function groupByCategory(dims: Dimension[]): [string, Dimension[]][] {
  const groups = new Map<string, Dimension[]>();
  for (const d of [...dims].sort((a, b) => a.order - b.order)) {
    if (!groups.has(d.category)) groups.set(d.category, []);
    groups.get(d.category)!.push(d);
  }
  return [...groups.entries()];
}

/** "How was yesterday?" -> ["How was", "yesterday?"] for the indented two-line display headline. */
export function splitHeadline(t: string): [string, string] {
  const words = t.split(' ');
  return [words.slice(0, 2).join(' '), words.slice(2).join(' ')];
}
