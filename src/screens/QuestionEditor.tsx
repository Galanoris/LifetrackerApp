import { useState } from 'preact/hooks';
import type { Dimension, Frequency, Scale } from '../lib/types';
import { db } from '../lib/db';

const SCALES: { id: Scale; label: string }[] = [
  { id: 'rating5', label: '1–5 rating' },
  { id: 'yesno', label: 'Yes / no' },
  { id: 'hours', label: 'Hours' },
  { id: 'number', label: 'Number' },
  { id: 'text', label: 'Short text' },
];

interface Props {
  dim: Dimension | null; // null = new question
  categories: string[];
  nextOrder: number;
  answerCount: number;
  onClose: () => void;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

export function QuestionEditor({ dim, categories, nextOrder, answerCount, onClose }: Props) {
  const [d, setD] = useState<Dimension>(
    dim ?? {
      id: '',
      category: categories[0] ?? 'General',
      question: '',
      shortLabel: '',
      frequency: 'daily',
      scale: 'rating5',
      anchors: { 1: '', 3: '', 5: '' },
      higherIsBetter: true,
      order: nextOrder,
      active: true,
      createdAt: new Date().toISOString(),
    },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Dimension>(k: K, v: Dimension[K]) => setD({ ...d, [k]: v });
  const changingKind = dim !== null && answerCount > 0 && (dim.scale !== d.scale || dim.frequency !== d.frequency);

  const save = async () => {
    if (!d.question.trim()) return setError('The question needs some text.');
    if (!d.category.trim()) return setError('Pick or type a category.');
    const clean: Dimension = {
      ...d,
      question: d.question.trim(),
      category: d.category.trim(),
      shortLabel: (d.shortLabel || d.question).trim().slice(0, 40),
      naLabel: d.naLabel?.trim() || undefined,
      hint: d.hint?.trim() || undefined,
      id: d.id || `${slug(d.shortLabel || d.question)}-${Date.now().toString(36)}`,
    };
    if (clean.scale !== 'rating5') delete clean.anchors;
    if (clean.scale !== 'hours' && clean.scale !== 'number') {
      delete clean.min; delete clean.max; delete clean.step; delete clean.defaultValue;
    }
    if (clean.scale !== 'yesno') delete clean.autoFromNote;
    await db.dimensions.put(clean);
    onClose();
  };

  const num = (v: string) => (v === '' ? undefined : Number(v));
  const isNumeric = d.scale === 'hours' || d.scale === 'number';

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={dim ? 'Edit question' : 'New question'}>
        <div class="sheet-head">
          <button class="link-btn" onClick={onClose}>Cancel</button>
          <h2>{dim ? 'Edit question' : 'New question'}</h2>
          <button class="link-btn" style={{ fontWeight: 600 }} onClick={save}>Save</button>
        </div>
        {error && <div class="banner warn">{error}</div>}

        <label class="field">
          <span>Question</span>
          <textarea rows={2} style={{ minHeight: 0 }} value={d.question} onInput={(e) => set('question', (e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="row">
          <label class="field">
            <span>Short label (charts)</span>
            <input type="text" value={d.shortLabel} placeholder="e.g. Sleep quality" onInput={(e) => set('shortLabel', (e.target as HTMLInputElement).value)} />
          </label>
          <label class="field">
            <span>Category</span>
            <input type="text" list="categories" value={d.category} onInput={(e) => set('category', (e.target as HTMLInputElement).value)} />
            <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
        </div>

        <span class="small muted">Asked</span>
        <div class="seg" style={{ marginTop: 4 }}>
          {(['daily', 'weekly'] as Frequency[]).map((f) => (
            <button key={f} class={d.frequency === f ? 'on' : ''} onClick={() => set('frequency', f)}>{f === 'daily' ? 'Daily' : 'Weekly'}</button>
          ))}
        </div>
        <span class="small muted">Answer type</span>
        <div class="seg" style={{ marginTop: 4 }}>
          {SCALES.map((s) => (
            <button key={s.id} class={d.scale === s.id ? 'on' : ''} onClick={() => setD({ ...d, scale: s.id, ...(s.id === 'hours' && d.max === undefined ? { min: 0, max: 12, step: 0.5, defaultValue: 7 } : {}) })}>
              {s.label}
            </button>
          ))}
        </div>
        {changingKind && (
          <div class="banner warn small">This question already has {answerCount} answers. Changing its type or frequency can make old answers read oddly; archiving it and adding a new one keeps history clean.</div>
        )}

        {d.scale === 'rating5' && (
          <>
            <div class="small muted" style={{ marginBottom: 6 }}>What 1, 3 and 5 mean (keeps answers comparable over time)</div>
            <div class="row">
              {([1, 3, 5] as const).map((k) => (
                <label class="field" key={k}>
                  <span>{k}</span>
                  <input type="text" value={d.anchors?.[k] ?? ''} onInput={(e) => set('anchors', { ...d.anchors, [k]: (e.target as HTMLInputElement).value })} />
                </label>
              ))}
            </div>
            <label class="check">
              <input type="checkbox" checked={!d.higherIsBetter} onChange={(e) => set('higherIsBetter', !(e.target as HTMLInputElement).checked)} />
              Lower is better (e.g. stress)
            </label>
          </>
        )}

        {isNumeric && (
          <div class="row">
            <label class="field"><span>Min</span><input type="number" inputMode="decimal" value={d.min ?? ''} onInput={(e) => set('min', num((e.target as HTMLInputElement).value))} /></label>
            <label class="field"><span>Max</span><input type="number" inputMode="decimal" value={d.max ?? ''} onInput={(e) => set('max', num((e.target as HTMLInputElement).value))} /></label>
            <label class="field"><span>Step</span><input type="number" inputMode="decimal" value={d.step ?? ''} onInput={(e) => set('step', num((e.target as HTMLInputElement).value))} /></label>
            <label class="field"><span>Start at</span><input type="number" inputMode="decimal" value={d.defaultValue ?? ''} onInput={(e) => set('defaultValue', num((e.target as HTMLInputElement).value))} /></label>
          </div>
        )}

        {d.scale === 'yesno' && d.frequency === 'daily' && (
          <label class="check">
            <input type="checkbox" checked={!!d.autoFromNote} onChange={(e) => set('autoFromNote', (e.target as HTMLInputElement).checked)} />
            Tick "yes" automatically when the day note has a few sentences
          </label>
        )}

        <label class="field">
          <span>"Not applicable" button label (optional, replaces "Skip")</span>
          <input type="text" value={d.naLabel ?? ''} placeholder="e.g. No work today" onInput={(e) => set('naLabel', (e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Hint under the question (optional)</span>
          <input type="text" value={d.hint ?? ''} onInput={(e) => set('hint', (e.target as HTMLInputElement).value)} />
        </label>

        <button class="btn primary block" onClick={save}>Save</button>
        {dim && (
          <button class="btn block" style={{ marginTop: 8 }} onClick={async () => { await db.dimensions.update(dim.id, { active: !dim.active }); onClose(); }}>
            {dim.active ? 'Archive (keeps history)' : 'Restore'}
          </button>
        )}
      </div>
    </div>
  );
}
