import type { PricePoint } from "@/lib/data";
import { brl, brlShort } from "@/lib/format";

const W = 1000;
const H = 280;
const PAD = { top: 18, right: 16, bottom: 30, left: 64 };

function day(date: string): string {
  const [, month, dayOfMonth] = date.split("-");
  return `${dayOfMonth}/${month}`;
}

/** Gráfico SVG do menor preço por dia (renderizado no servidor, sem JS). */
export function PriceChart({ points, current }: { points: PricePoint[]; current: number }) {
  if (points.length < 2) {
    return <p className="muted">O bot começou a acompanhar este produto há pouco tempo. O histórico aparece aqui nos próximos dias.</p>;
  }
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices, current);
  const max = Math.max(...prices, current);
  const span = Math.max(max - min, max * 0.04);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const x = (index: number) => PAD.left + (index / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (price: number) => PAD.top + (1 - (price - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;
  const ticks = [hi - (hi - lo) * 0.1, (hi + lo) / 2, lo + (hi - lo) * 0.1];
  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const lowest = Math.min(...prices);
  const last = points[points.length - 1]!;
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histórico de preço: menor ${brl.format(lowest)}, média ${brl.format(average)}`}>
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="chart__grid" />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="chart__label">{brlShort.format(tick)}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(average)} y2={y(average)} className="chart__avg" />
        <path d={area} fill="url(#chartFill)" />
        <path d={line} className="chart__line" />
        <circle cx={x(points.length - 1)} cy={y(last.price)} r="5" className="chart__dot" />
        {labelIndexes.map((index) => (
          <text key={index} x={x(index)} y={H - 8} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="chart__label">
            {day(points[index]!.date)}
          </text>
        ))}
      </svg>
      <figcaption className="chart__legend">
        <span><i className="swatch swatch--line" /> Menor preço do dia</span>
        <span><i className="swatch swatch--avg" /> Média ({brl.format(average)})</span>
      </figcaption>
    </figure>
  );
}
