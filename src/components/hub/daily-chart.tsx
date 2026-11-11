"use client";

import { useState } from "react";

interface Point {
  day: string;
  value: number;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

/** Single-series daily bar chart: thin rounded bars, recessive axis, hover tooltip, table fallback. */
export function DailyChart({ title, unit, color, data }: { title: string; unit: string; color: string; data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const total = data.reduce((a, d) => a + d.value, 0);
  const W = 560;
  const H = 180;
  const padL = 28;
  const padB = 22;
  const slot = (W - padL) / data.length;
  const barW = Math.max(4, slot - 6);
  const y = (v: number) => (H - padB) * (1 - v / niceMax);
  const active = hover === null ? null : data[hover];

  return (
    <figure className="card flex flex-col gap-3 p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">{title}</span>
        <span className="text-sm text-muted">
          {active ? (
            <>
              {fmtDay(active.day)}: <b className="text-text tabular-nums">{active.value}</b> {unit}
            </>
          ) : (
            <>
              <b className="text-text tabular-nums">{total}</b> {unit} in {data.length} days
            </>
          )}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}, last ${data.length} days`}>
        {[0, niceMax / 2, niceMax].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} strokeDasharray={t ? "2 4" : undefined} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--color-muted)">
              {Number.isInteger(t) ? t : ""}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = (H - padB) - y(d.value);
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Hit target spans the full slot so tiny bars are still easy to hover. */}
              <rect x={padL + i * slot} y={0} width={slot} height={H - padB} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={`M${x},${H - padB} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${H - padB} Z`}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(i === 0 || i === data.length - 1 || i % 4 === 0) && (
                <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                  {fmtDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-medium">Day (UTC)</th>
              <th className="py-1 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line/50">
                <td className="py-1">{fmtDay(d.day)}</td>
                <td className="py-1 text-right tabular-nums text-text">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
