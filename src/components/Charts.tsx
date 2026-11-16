import { useEffect, useRef, useState } from 'preact/hooks';
import { formatShort, fromKey, weekday } from '../lib/dates';

function useWidth<T extends HTMLElement>(): [preact.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface LinePoint {
  key: string; // date or week key
  label: string; // tooltip label
  value: number | null; // raw value (dots)
  avg?: number | null; // smoothed line; if absent, the line connects `value`
}

interface LineProps {
  points: LinePoint[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  format: (v: number) => string;
  avgLabel?: string;
}

/** Dots for raw values + a 2px line for the average, with a crosshair tooltip. */
export function LineChart({ points, yMin, yMax, yTicks, format, avgLabel = '7-day avg' }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 170, padL = 26, padR = 8, padT = 10, padB = 22;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (width - padL - padR));
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);
  const hasAvg = points.some((p) => p.avg !== undefined);
  const lineVals = points.map((p) => (hasAvg ? p.avg ?? null : p.value));

  let path = '';
  let pen = false;
  lineVals.forEach((v, i) => {
    if (v === null || v === undefined) { pen = false; return; }
    path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });

  // ~5 x-axis labels
  const labelEvery = Math.max(1, Math.ceil(n / 5));
  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - padL) / (width - padL - padR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} class="rel">
      <svg class="chart" width={width} height={H} viewBox={`0 0 ${width} ${H}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--grid)" stroke-width={1} />
            <text x={padL - 6} y={y(t) + 3} text-anchor="end">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.key} x={x(i)} y={H - 6} text-anchor={i === 0 ? 'start' : 'middle'}>{p.label.split(' · ')[0]}</text>
          ) : null,
        )}
        {hasAvg &&
          points.map((p, i) =>
            p.value !== null ? <circle key={p.key} cx={x(i)} cy={y(p.value)} r={2.5} fill="var(--series)" opacity={0.35} /> : null,
          )}
        <path d={path} fill="none" stroke="var(--series)" stroke-width={2} stroke-linejoin="round" stroke-linecap="round" />
        {!hasAvg &&
          points.map((p, i) =>
            p.value !== null ? <circle key={p.key} cx={x(i)} cy={y(p.value)} r={4} fill="var(--series)" stroke="var(--surface)" stroke-width={2} /> : null,
          )}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--text-3)" stroke-width={1} stroke-dasharray="3 3" />
        )}
        {hover !== null && lineVals[hover] != null && (
          <circle cx={x(hover)} cy={y(lineVals[hover]!)} r={4.5} fill="var(--series)" stroke="var(--surface)" stroke-width={2} />
        )}
      </svg>
      {hp && (
        <div class="tooltip" style={{ left: Math.min(Math.max(x(hover!), 60), width - 60), top: 0 }}>
          {hp.label}: {hp.value === null ? '–' : format(hp.value)}
          {hasAvg && hp.avg != null ? ` · avg ${format(hp.avg)}` : ''}
        </div>
      )}
      {hasAvg && (
        <div class="legend">
          <span><i style={{ background: 'var(--series)', opacity: 0.35, borderRadius: 6, width: 8, height: 8 }} />Daily</span>
          <span><i class="line" style={{ background: 'var(--series)' }} />{avgLabel}</span>
        </div>
      )}
    </div>
  );
}

export interface HeatCell {
  date: string;
  /** colour step 1..5 (already "good"-oriented), 'skip', or null (no answer) */
  step: number | 'skip' | null;
  label: string;
}

/** Calendar heatmap: one column per week (Mon–Sun rows). Tap a cell to read it. */
export function Heatmap({ cells, legend }: { cells: HeatCell[]; legend: { cls: string; label: string }[] }) {
  const [sel, setSel] = useState<HeatCell | null>(null);
  if (!cells.length) return null;
  const lead = (weekday(cells[0].date) + 6) % 7; // Monday = 0
  const cols = Math.ceil((lead + cells.length) / 7);
  const months: { col: number; label: string }[] = [];
  cells.forEach((c, i) => {
    const d = fromKey(c.date);
    if (d.getDate() === 1 || i === 0) {
      const col = Math.floor((lead + i) / 7);
      if (!months.length || col - months[months.length - 1].col >= 3) months.push({ col, label: formatShort(c.date).split(' ')[1] });
    }
  });
  const colTemplate = `14px repeat(${cols}, minmax(0, 20px))`;
  return (
    <div>
      <div class="heatmap" style={{ gridTemplateColumns: colTemplate }}>
        {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => <span key={`d${i}`} class="heat-day">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <div key={`p${i}`} class="cell pad" />)}
        {cells.map((c) => (
          <div
            key={c.date}
            class={`cell${c.step === 'skip' ? ' skip' : c.step ? ` v${c.step}` : ''}`}
            title={c.label}
            onClick={() => setSel(sel?.date === c.date ? null : c)}
            style={sel?.date === c.date ? { outline: '2px solid var(--text)', outlineOffset: 1 } : undefined}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, columnGap: 3, fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
        {months.map((m) => <span key={m.col} style={{ gridColumn: `${m.col + 2} / span 3` }}>{m.label}</span>)}
      </div>
      <div class="legend">
        {sel ? <span style={{ color: 'var(--text)' }}>{sel.label}</span> : legend.map((l) => <span key={l.cls}><i style={l.cls === 'empty' ? { boxShadow: 'inset 0 0 0 1px var(--border)' } : { background: `var(--${l.cls})` }} />{l.label}</span>)}
      </div>
    </div>
  );
}
