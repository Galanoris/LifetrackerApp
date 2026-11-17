import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dimension, Entry } from '../lib/types';
import { clearEntry, setEntry } from '../lib/db';
import { Minus, Plus } from './Icons';

interface Props {
  dim: Dimension;
  period: string;
  entry: Entry | undefined;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function QuestionCard({ dim, period, entry }: Props) {
  const skipped = entry !== undefined && entry.value === null;
  const answered = entry !== undefined && entry.value !== null;
  const set = (v: number | boolean | string | null) => setEntry(dim.id, period, v);
  const clear = () => clearEntry(dim.id, period);

  let control;
  switch (dim.scale) {
    case 'rating5':
      control = <Rating dim={dim} value={answered ? (entry!.value as number) : null} onPick={(v) => (entry?.value === v ? clear() : set(v))} />;
      break;
    case 'hours':
    case 'number':
      control = <Stepper dim={dim} value={answered ? (entry!.value as number) : null} onChange={set} />;
      break;
    case 'yesno':
      control = (
        <div class="yesno" role="group" aria-label={dim.question}>
          {[true, false].map((v) => (
            <button
              key={String(v)}
              class={entry?.value === v ? 'sel' : ''}
              aria-pressed={entry?.value === v}
              onClick={() => (entry?.value === v ? clear() : set(v))}
            >
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );
      break;
    case 'text':
      control = <TextAnswer key={period} value={typeof entry?.value === 'string' ? entry.value : ''} onSave={(t) => (t.trim() ? set(t) : clear())} />;
      break;
  }

  return (
    <div class={`card${skipped ? ' skipped' : ''}`}>
      <div class="q-head">
        <div class="q-text">{dim.question}</div>
        {skipped ? (
          <button class="q-skip on" onClick={clear}>
            {dim.naLabel ?? 'Skipped'} · undo
          </button>
        ) : answered ? (
          <button class="q-skip" onClick={clear}>Clear</button>
        ) : (
          <button class="q-skip" onClick={() => set(null)}>{dim.naLabel ?? 'Skip'}</button>
        )}
      </div>
      {!skipped && control}
      {!skipped && dim.hint && <div class="q-hint">{entry?.auto ? 'Ticked from your day note' : dim.hint}</div>}
    </div>
  );
}

function Rating({ dim, value, onPick }: { dim: Dimension; value: number | null; onPick: (v: number) => void }) {
  const a = dim.anchors ?? {};
  return (
    <>
      <div class="rating" role="radiogroup" aria-label={dim.question}>
        {[1, 2, 3, 4, 5].map((v) => {
          const sel = value === v;
          const colour = dim.higherIsBetter ? v : 6 - v;
          return (
            <button
              key={v}
              role="radio"
              aria-checked={sel}
              aria-label={`${v}${a[v as 1 | 3 | 5] ? ` – ${a[v as 1 | 3 | 5]}` : ''}`}
              class={sel ? `sel v${colour}` : ''}
              onClick={() => onPick(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
      {(a[1] || a[3] || a[5]) && (
        <div class="anchors">
          <span>{a[1]}</span>
          <span>{a[3]}</span>
          <span>{a[5]}</span>
        </div>
      )}
    </>
  );
}

function Stepper({ dim, value, onChange }: { dim: Dimension; value: number | null; onChange: (v: number) => void }) {
  const step = dim.step ?? (dim.scale === 'hours' ? 0.5 : 1);
  const min = dim.min ?? 0;
  const max = dim.max ?? (dim.scale === 'hours' ? 24 : 999);
  const start = dim.defaultValue ?? min;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const unit = dim.scale === 'hours' ? ' h' : '';
  return (
    <div class="stepper">
      <button class="circle-btn" aria-label="Less" onClick={() => onChange(clamp(value === null ? start : value - step))}><Minus /></button>
      <button class={`val${value !== null ? ' set' : ''}`} onClick={() => value === null && onChange(clamp(start))}>
        {value === null ? <span class="muted">TAP · {fmt(start)}{unit}</span> : `${fmt(value)}${unit}`}
      </button>
      <button class="circle-btn" aria-label="More" onClick={() => onChange(clamp(value === null ? start : value + step))}><Plus /></button>
    </div>
  );
}

function TextAnswer({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [text, setText] = useState(value);
  const timer = useRef<number>();
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);
  const flush = (t: string) => {
    clearTimeout(timer.current);
    dirty.current = false;
    onSave(t);
  };
  return (
    <textarea
      value={text}
      rows={2}
      onInput={(e) => {
        const t = (e.target as HTMLTextAreaElement).value;
        setText(t);
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => flush(t), 600);
      }}
      onBlur={() => dirty.current && flush(text)}
    />
  );
}

/** Auto-saving note textarea (used for the day note and weekly reflection). */
export function NoteField({ value, placeholder, onSave, rows = 3 }: { value: string; placeholder: string; onSave: (t: string) => void; rows?: number }) {
  const [text, setText] = useState(value);
  const timer = useRef<number>();
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setText(value);
  }, [value]);
  useEffect(() => () => {
    if (dirty.current) {
      clearTimeout(timer.current);
      onSave(textRef.current);
    }
  }, []);
  const textRef = useRef(text);
  textRef.current = text;
  const flush = () => {
    clearTimeout(timer.current);
    dirty.current = false;
    onSave(textRef.current);
  };
  return (
    <textarea
      value={text}
      rows={rows}
      placeholder={placeholder}
      onInput={(e) => {
        setText((e.target as HTMLTextAreaElement).value);
        textRef.current = (e.target as HTMLTextAreaElement).value;
        dirty.current = true;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 700);
      }}
      onBlur={() => dirty.current && flush()}
    />
  );
}
