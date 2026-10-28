"use client";

import { useId, useState } from "react";
import type { Bucket } from "@/lib/metrics";

const W = 800;
const H = 220;
const PAD = { l: 30, r: 8, t: 10, b: 24 };

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / pow) * pow;
}

/** Curva suave (Catmull-Rom convertida em Bezier) para o traço da órbita. */
function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function TimelineChart({ buckets }: { buckets: Bucket[] }) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...buckets.map((bucket) => bucket.count), 1));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (index: number) => PAD.l + (buckets.length === 1 ? innerW / 2 : (index / (buckets.length - 1)) * innerW);
  const y = (value: number) => PAD.t + innerH - (value / max) * innerH;
  const points = buckets.map((bucket, index) => [x(index), y(bucket.count)] as [number, number]);
  const line = smoothPath(points);
  const area = `${line} L${x(buckets.length - 1)},${PAD.t + innerH} L${x(0)},${PAD.t + innerH} Z`;
  const ticks = [0, 0.5, 1].map((fraction) => Math.round(max * fraction));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const active = hover !== null ? buckets[hover] : undefined;
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div>
      <div className="chart-readout" aria-live="polite">
        {active ? <><b>{active.count} {active.count === 1 ? "oferta" : "ofertas"}</b> · {active.label}</> : `${total} publicadas no período`}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ofertas publicadas ao longo do período: ${total} no total`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={PAD.l} x2={W - PAD.r} y1={y(tick)} y2={y(tick)} />
            <text x={PAD.l - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradient})`} />
        <path className="line draw" d={line} pathLength={1} />
        {buckets.map((bucket, index) => (index % labelEvery === 0 ? (
          <text key={`${bucket.label}-${index}`} x={x(index)} y={H - 4} textAnchor="middle">{bucket.label}</text>
        ) : null))}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--faint)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(buckets[hover]!.count)} r={5} fill="#000" stroke="var(--accent-text)" strokeWidth={2.5} />
          </g>
        ) : null}
        {buckets.map((bucket, index) => (
          <rect
            key={`hit-${index}`}
            x={x(index) - innerW / buckets.length / 2}
            y={PAD.t}
            width={innerW / buckets.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
            onTouchStart={() => setHover(index)}
          />
        ))}
      </svg>
    </div>
  );
}

export function Columns({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const colW = 100;
  const gap = 28;
  const width = buckets.length * colW + (buckets.length - 1) * gap;
  const height = 150;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height + 34}`} role="img" aria-label="Distribuição de ofertas por faixa de desconto">
      {buckets.map((bucket, index) => {
        const h = Math.max(bucket.count ? 4 : 1, (bucket.count / max) * height);
        const left = index * (colW + gap);
        return (
          <g key={bucket.label}>
            <rect className="col" x={left} y={height - h} width={colW} height={h} rx={5} />
            <text x={left + colW / 2} y={height - h - 8} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 18 }}>{bucket.count}</text>
            <text x={left + colW / 2} y={height + 24} textAnchor="middle" style={{ fontSize: 16 }}>{bucket.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ rows, limit = 6 }: { rows: Array<{ label: string; value: number }>; limit?: number }) {
  const shown = rows.slice(0, limit);
  const max = Math.max(...shown.map((row) => row.value), 1);
  return (
    <div className="hbars">
      {shown.map((row) => (
        <div className="hbar" key={row.label}>
          <span>{row.label}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ display: "block", width: `${(row.value / max) * 100}%` }} /></span>
          <span className="val">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
