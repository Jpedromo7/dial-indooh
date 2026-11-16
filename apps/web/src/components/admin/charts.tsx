"use client";

import { cn } from "@/lib/utils";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthLabel(month: string) {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTHS[index] ?? month;
}

/** Gráfico de barras simples em SVG (sem dependências). */
export function BarChart({
  data,
  height = 160,
  className,
  formatLabel = (label: string) => label
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  className?: string;
  formatLabel?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const barWidth = 100 / Math.max(1, data.length);

  return (
    <div className={cn("w-full", className)}>
      <svg aria-label="Gráfico de barras" className="w-full" preserveAspectRatio="none" role="img" style={{ height }} viewBox={`0 0 100 ${height}`}>
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <line key={step} stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.3} x1={0} x2={100} y1={height - step * (height - 10)} y2={height - step * (height - 10)} />
        ))}
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 10);
          return (
            <rect
              className="fill-primary"
              height={Math.max(item.value ? 1 : 0, barHeight)}
              key={item.label}
              rx={0.8}
              width={barWidth * 0.62}
              x={index * barWidth + barWidth * 0.19}
              y={height - barHeight}
            >
              <title>
                {formatLabel(item.label)}: {item.value.toLocaleString("pt-BR")}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex">
        {data.map((item) => (
          <span className="flex-1 truncate text-center text-[10px] text-muted-foreground" key={item.label}>
            {formatLabel(item.label)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${40 - (value / max) * 36}`).join(" ");

  return (
    <svg className={cn("h-16 w-full", className)} preserveAspectRatio="none" viewBox="0 0 100 40">
      <polyline className="stroke-primary" fill="none" points={points} strokeLinejoin="round" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Gauge({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const angle = (clamped / 100) * 180;
  const radians = ((180 - angle) * Math.PI) / 180;
  const x = 50 + 40 * Math.cos(radians);
  const y = 50 - 40 * Math.sin(radians);

  return (
    <div className="flex flex-col items-center">
      <svg className="h-28 w-48" viewBox="0 0 100 55">
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeOpacity={0.12} strokeLinecap="round" strokeWidth={9} />
        {clamped > 0 ? (
          <path
            className="stroke-primary"
            d={`M10 50 A40 40 0 ${angle > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
            fill="none"
            strokeLinecap="round"
            strokeWidth={9}
          />
        ) : null}
        <text className="fill-foreground text-[14px] font-semibold" textAnchor="middle" x={50} y={48}>
          {Math.round(clamped)}%
        </text>
      </svg>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
