"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/money";

type Point = { date: string; revenueCents: number; orders: number };

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

/**
 * Gráfico de barras de faturamento diário (SVG puro, responsivo via viewBox).
 * Acessível: resumo textual + tabela para leitores de tela; dica ao passar o
 * mouse ou focar uma barra com o teclado.
 */
export function SalesChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 720;
  const pad = { top: 16, right: 8, bottom: 26, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.revenueCents));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(2, step * 0.68);
  const total = data.reduce((s, d) => s + d.revenueCents, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const labelEvery = Math.ceil(data.length / 8);
  const current = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        Faturamento diário: total de {formatBRL(total)} em {totalOrders} pedidos no período.
      </figcaption>
      <div className="mb-2 flex min-h-10 items-end justify-between gap-2 text-sm" aria-live="polite">
        {current ? (
          <p>
            <span className="font-semibold">{dayLabel(current.date)}</span> · <span className="font-bold tabular">{formatBRL(current.revenueCents)}</span> <span className="text-fg-muted">({current.orders} pedido(s))</span>
          </p>
        ) : (
          <p className="text-fg-muted">
            Total no período: <span className="font-bold text-fg tabular">{formatBRL(total)}</span> · {totalOrders} pedido(s)
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Gráfico de faturamento diário" onMouseLeave={() => setActive(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} x2={width - pad.right} y1={pad.top + innerH * (1 - f)} y2={pad.top + innerH * (1 - f)} className="stroke-line" strokeDasharray="3 4" />
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="stroke-line-strong" />
        {data.map((d, i) => {
          const h = (d.revenueCents / max) * innerH;
          const x = pad.left + i * step + (step - barW) / 2;
          return (
            <g key={d.date}>
              <rect
                x={pad.left + i * step}
                y={pad.top}
                width={step}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${dayLabel(d.date)}: ${formatBRL(d.revenueCents)}, ${d.orders} pedidos`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
              <rect x={x} y={pad.top + innerH - h} width={barW} height={Math.max(h, d.revenueCents > 0 ? 2 : 0)} rx={Math.min(3, barW / 2)} className={active === i ? "fill-sun-500" : "fill-brand-600"} pointerEvents="none" />
              {i % labelEvery === 0 ? (
                <text x={pad.left + i * step + step / 2} y={height - 8} textAnchor="middle" className="fill-fg-subtle text-[11px]">
                  {dayLabel(d.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Faturamento por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Faturamento</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{dayLabel(d.date)}</td>
              <td>{formatBRL(d.revenueCents)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Barras horizontais simples (ranking). */
export function RankBars({ items, formatAs = "number" }: { items: { label: string; value: number }[]; formatAs?: "brl" | "number" }) {
  const format = (v: number) => (formatAs === "brl" ? formatBRL(v) : v.toLocaleString("pt-BR"));
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-semibold tabular">{format(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
