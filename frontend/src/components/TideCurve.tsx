import { useMemo, useState, useRef, useEffect, useCallback } from 'react';

interface TideCurveProps {
  data: unknown;
  /** IANA timezone — NZ tide tables use this. */
  displayTimeZone?: string;
}

const DEFAULT_TZ = 'Pacific/Auckland';
const CHART_H = 320;
const PAD = { left: 56, right: 20, top: 16, bottom: 52 };
/** Estimated panel size for clamping when following cursor */
const READOUT_PANEL_EST_W = 228;
const READOUT_PANEL_EST_H = 150;

interface RawRow {
  time: string;
  value?: number;
  height?: number;
}

interface TidePoint {
  t: number;
  h: number;
}

function fmtNz(ms: number, tz: string, withDate = true): string {
  return new Date(ms).toLocaleString('en-NZ', {
    timeZone: tz,
    ...(withDate
      ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: '2-digit', minute: '2-digit', hour12: false }),
  });
}

function parseHeight(row: RawRow): number {
  const v = row.value ?? row.height;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return parseFloat(String(v));
}

function extractRows(data: unknown): RawRow[] {
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.values)) return o.values as RawRow[];
  if (Array.isArray(data)) return data as RawRow[];
  return [];
}

function buildSortedSeries(rows: RawRow[]): TidePoint[] {
  const tmp: TidePoint[] = [];
  for (const row of rows) {
    const t = Date.parse(row.time);
    const h = parseHeight(row);
    if (!Number.isFinite(t) || !Number.isFinite(h)) continue;
    tmp.push({ t, h });
  }
  tmp.sort((a, b) => a.t - b.t);
  const out: TidePoint[] = [];
  for (const p of tmp) {
    if (out.length && out[out.length - 1].t === p.t) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function interpolateHeight(points: TidePoint[], targetT: number): number | null {
  if (points.length === 0) return null;
  if (targetT <= points[0].t) return points[0].h;
  if (targetT >= points[points.length - 1].t) return points[points.length - 1].h;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (p0.t <= targetT && targetT <= p1.t) {
      const r = (targetT - p0.t) / (p1.t - p0.t);
      return p0.h + (p1.h - p0.h) * r;
    }
  }
  return null;
}

/** Smooth path (Catmull–Rom → cubic Bézier), passes through every API sample. */
function smoothPathD(
  points: TidePoint[],
  xScale: (t: number) => number,
  yScale: (h: number) => number,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const x = xScale(points[0].t);
    const y = yScale(points[0].h);
    return `M ${x} ${y}`;
  }
  const p = points.map((pt) => ({ x: xScale(pt.t), y: yScale(pt.h) }));
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Indices of global max / min height among samples in the visible window. */
function sampleMinMaxIndices(points: TidePoint[]): { maxIdx: number; minIdx: number } | null {
  if (points.length === 0) return null;
  let maxIdx = 0;
  let minIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].h > points[maxIdx].h) maxIdx = i;
    if (points[i].h < points[minIdx].h) minIdx = i;
  }
  return { maxIdx, minIdx };
}

interface TideModel {
  seriesFull: TidePoint[];
  seriesView: TidePoint[];
  meta: { datum?: string; heightUnit?: string; source?: string };
  hMin: number;
  hMax: number;
}

function buildModel(data: unknown): TideModel | null {
  const rows = extractRows(data);
  if (rows.length === 0) return null;

  const seriesFull = buildSortedSeries(rows);
  if (seriesFull.length === 0) return null;

  /** Full NIWA/mock series — no ±24h clip (that made the chart look like “today only”). */
  const seriesView = seriesFull;
  if (seriesView.length === 0) return null;

  const hs = seriesView.map((p) => p.h);
  const hMin = Math.min(...hs);
  const hMax = Math.max(...hs);

  let datum: string | undefined;
  let heightUnit: string | undefined;
  let source: string | undefined;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    const md = o.metadata;
    if (md && typeof md === 'object') {
      const m = md as Record<string, unknown>;
      if (typeof m.datum === 'string') datum = m.datum;
      if (typeof m.height === 'string') heightUnit = m.height;
    }
    if (typeof o._source === 'string') source = o._source;
  }

  return { seriesFull, seriesView, meta: { datum, heightUnit, source }, hMin, hMax };
}

export function TideCurve({ data, displayTimeZone = DEFAULT_TZ }: TideCurveProps) {
  const tz = displayTimeZone;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  const model = useMemo(() => buildModel(data), [data]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (w > 40) setWidth(w);
    });
    ro.observe(el);
    const w0 = el.getBoundingClientRect().width;
    if (w0 > 40) setWidth(w0);
    return () => ro.disconnect();
  }, []);

  const [hover, setHover] = useState<{ t: number; h: number } | null>(null);
  const [readout, setReadout] = useState<{ t: number; h: number } | null>(null);
  /** When set, readout box follows cursor (coordinates relative to wrapRef) */
  const [readoutFollowPos, setReadoutFollowPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!model) return;
    const t = Date.now();
    const h = interpolateHeight(model.seriesView, t);
    if (h !== null) setReadout({ t, h });
  }, [model]);

  const onSvgMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!model) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const innerW = width - PAD.left - PAD.right;
      if (innerW <= 0) return;

      const px = e.clientX - rect.left - PAD.left;
      const clamped = Math.max(0, Math.min(innerW, px));
      const t0v = model.seriesView[0].t;
      const t1v = model.seriesView[model.seriesView.length - 1].t;
      const targetT = t0v + (clamped / innerW) * (t1v - t0v);
      const h = interpolateHeight(model.seriesView, targetT);
      if (h !== null) {
        setHover({ t: targetT, h });
        setReadout({ t: targetT, h });
      }

      const wrap = wrapRef.current;
      if (wrap) {
        const br = wrap.getBoundingClientRect();
        const offset = 14;
        let left = e.clientX - br.left + offset;
        let top = e.clientY - br.top + offset;
        if (left + READOUT_PANEL_EST_W > br.width - 6) {
          left = e.clientX - br.left - READOUT_PANEL_EST_W - offset;
        }
        if (top + READOUT_PANEL_EST_H > br.height - 6) {
          top = e.clientY - br.top - READOUT_PANEL_EST_H - offset;
        }
        left = Math.max(6, Math.min(left, br.width - READOUT_PANEL_EST_W - 6));
        top = Math.max(6, Math.min(top, br.height - READOUT_PANEL_EST_H - 6));
        setReadoutFollowPos({ left, top });
      }
    },
    [model, width],
  );

  const onSvgLeave = useCallback(() => {
    setHover(null);
    setReadoutFollowPos(null);
    if (!model) return;
    const t = Date.now();
    const h = interpolateHeight(model.seriesView, t);
    if (h !== null) setReadout({ t, h });
  }, [model]);

  if (!data) {
    return <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No tide data available</p>;
  }

  if (!model) {
    return (
      <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
        Invalid tide data or no samples in forecast
      </p>
    );
  }

  const { seriesView, hMin, hMax, meta } = model;
  const padH = Math.max(0.05 * (hMax - hMin), 0.1);
  const y0 = hMin - padH;
  const y1 = hMax + padH;
  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const t0 = seriesView[0].t;
  const t1 = seriesView[seriesView.length - 1].t;
  const tSpan = t1 - t0 || 1;
  const spanHours = tSpan / (60 * 60 * 1000);

  const xScale = (t: number) => PAD.left + ((t - t0) / tSpan) * innerW;
  const yScale = (h: number) => PAD.top + innerH - ((h - y0) / (y1 - y0)) * innerH;

  const curveD = smoothPathD(seriesView, xScale, yScale);
  const minMaxIdx = sampleMinMaxIndices(seriesView);

  const nowMs = Date.now();
  const nowX = xScale(Math.min(Math.max(nowMs, t0), t1));

  const tickCount = 6;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(t0 + (tSpan * i) / tickCount);
  }

  const yTicks = 4;
  const yTickVals: number[] = [];
  for (let i = 0; i <= yTicks; i++) {
    yTickVals.push(y0 + ((y1 - y0) * i) / yTicks);
  }

  const hoverX = hover ? xScale(hover.t) : null;
  const hoverY = hover ? yScale(hover.h) : null;

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          zIndex: 10,
          ...(readoutFollowPos != null
            ? { left: readoutFollowPos.left, top: readoutFollowPos.top }
            : { top: 8, left: 12 }),
          backgroundColor: 'white',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          padding: '10px 14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          minWidth: 200,
          maxWidth: READOUT_PANEL_EST_W,
          pointerEvents: 'none',
          transition: readoutFollowPos != null ? 'none' : 'left 0.15s ease, top 0.15s ease',
        }}
      >
        <p style={{ margin: '0 0 4px', fontSize: 11, color: '#999' }}>
          {hover ? 'Cursor (NZ time)' : 'Now (NZ time)'}
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1890ff' }} title="Time at cursor or current time">
          {readout ? fmtNz(readout.t, tz) : <span style={{ color: '#999' }}>No time</span>}
        </p>
        <p
          style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, color: '#ff7a45' }}
          title="Tide height from linear interpolation between API samples"
        >
          {readout != null && Number.isFinite(readout.h) ? readout.h.toFixed(2) : (
            <span style={{ fontSize: 16, color: '#999', fontWeight: 600 }}>No height</span>
          )}{' '}
          <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>m</span>
        </p>
        {meta.datum != null && (
          <p style={{ margin: '8px 0 0', fontSize: 10, color: '#888' }}>Datum: {meta.datum}</p>
        )}
        {meta.source === 'mock' && (
          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#faad14' }}>Mock data (not NIWA)</p>
        )}
      </div>

      <svg
        width={width}
        height={CHART_H}
        style={{ display: 'block', userSelect: 'none', cursor: 'crosshair' }}
        onMouseMove={onSvgMove}
        onMouseLeave={onSvgLeave}
      >
        <rect x={0} y={0} width={width} height={CHART_H} fill="#fafafa" />
        <text x={PAD.left} y={14} fill="#666" fontSize={11}>
          Tide (smooth curve through samples; red/blue = forecast max/min)
        </text>

        {yTickVals.map((yv, i) => {
          const y = yScale(yv);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="#eee" strokeDasharray="4 4" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#999" fontSize={10}>
                {yv.toFixed(2)}
              </text>
            </g>
          );
        })}

        {ticks.map((tv, i) => {
          const x = xScale(tv);
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={PAD.top} y2={CHART_H - PAD.bottom} stroke="#f0f0f0" />
              <text x={x} y={CHART_H - PAD.bottom + 22} textAnchor="middle" fill="#999" fontSize={10}>
                {fmtNz(tv, tz, true)}
              </text>
            </g>
          );
        })}

        <path d={curveD} fill="none" stroke="#1890ff" strokeWidth={2.2} strokeLinejoin="round" />

        {minMaxIdx &&
          (() => {
            const { maxIdx, minIdx } = minMaxIdx;
            if (maxIdx === minIdx) {
              const p = seriesView[maxIdx];
              return (
                <g pointerEvents="none" aria-hidden>
                  <circle
                    cx={xScale(p.t)}
                    cy={yScale(p.h)}
                    r={4}
                    fill="#722ed1"
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                </g>
              );
            }
            const hi = seriesView[maxIdx];
            const lo = seriesView[minIdx];
            return (
              <g pointerEvents="none" aria-hidden>
                <circle
                  cx={xScale(hi.t)}
                  cy={yScale(hi.h)}
                  r={4}
                  fill="#ff4d4f"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
                <circle
                  cx={xScale(lo.t)}
                  cy={yScale(lo.h)}
                  r={4}
                  fill="#1890ff"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              </g>
            );
          })()}

        {hoverX != null && hoverY != null && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={CHART_H - PAD.bottom}
              stroke="#1890ff"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <circle cx={hoverX} cy={hoverY} r={6} fill="#fff" stroke="#1890ff" strokeWidth={2} />
          </g>
        )}

        {nowMs >= t0 && nowMs <= t1 && (
          <line
            x1={nowX}
            x2={nowX}
            y1={PAD.top}
            y2={CHART_H - PAD.bottom}
            stroke="#52c41a"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {nowMs >= t0 && nowMs <= t1 && (
          <text x={nowX + 4} y={PAD.top + 12} fill="#52c41a" fontSize={11} fontWeight={600}>
            Now
          </text>
        )}

        <text
          x={width / 2}
          y={CHART_H - 6}
          textAnchor="middle"
          fill="#bbb"
          fontSize={10}
        >
          X: {tz} · Y: m ({meta.datum ?? 'API'})
        </text>
      </svg>

      <p style={{ margin: '12px 0 0', fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 1.5 }}>
        {seriesView.length} samples · ~{spanHours < 72 ? spanHours.toFixed(1) : Math.round(spanHours)}h span · {tz}
      </p>
    </div>
  );
}
