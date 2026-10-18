'use client';

import { useEffect, useRef, useState } from 'react';
import { formatBRL, formatDateTime } from '@/lib/format';

/** Gráficos SVG próprios (sem bibliotecas). Cores via tokens CSS; acessíveis (role=img + tabela alternativa). */

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.round(cr.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Limite superior "redondo" do eixo Y. */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function Sparkline({ values, width = 120, height = 32, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="text-xs text-muted">sem dados</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / (values.length - 1);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="text-primary-ink">
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r="2.5" fill="currentColor" />
    </svg>
  );
}

export interface BarSeries {
  key: string;
  label: string;
  /** Classe Tailwind de preenchimento (usa tokens do tema). */
  className: string;
}
export interface BarDatum {
  label: string;
  values: Record<string, number>;
}

/** Barras agrupadas por categoria (ex.: dias) com legenda e tabela alternativa. */
export function BarChart({ data, series, ariaLabel, height = 220 }: { data: BarDatum[]; series: BarSeries[]; ariaLabel: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const left = 34;
  const bottom = 24;
  const top = 8;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))));
  const innerW = Math.max(0, width - left - 4);
  const innerH = height - top - bottom;
  const groupW = data.length ? innerW / data.length : 0;
  const gap = Math.min(6, groupW * 0.2);
  const barW = Math.max(2, (groupW - gap * 2) / series.length);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = groupW < 30 ? Math.ceil(30 / Math.max(groupW, 1)) : 1;

  return (
    <figure className="m-0">
      <div ref={ref} className="w-full" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => {
              const y = top + innerH - (t / max) * innerH;
              return (
                <g key={t}>
                  <line x1={left} x2={width - 4} y1={y} y2={y} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : '3 3'} />
                  <text x={left - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--muted))">
                    {t}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const gx = left + i * groupW + gap;
              return (
                <g key={d.label + i}>
                  {series.map((s, j) => {
                    const v = d.values[s.key] ?? 0;
                    const h = (v / max) * innerH;
                    return (
                      <rect key={s.key} x={gx + j * barW} y={top + innerH - h} width={Math.max(1, barW - 1)} height={h} rx="1.5" className={s.className}>
                        <title>{`${d.label} — ${s.label}: ${v}`}</title>
                      </rect>
                    );
                  })}
                  {i % labelEvery === 0 ? (
                    <text x={left + i * groupW + groupW / 2} y={height - 7} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
                      {d.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden="true">
              <rect width="10" height="10" rx="2" className={s.className} />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">Ver dados em tabela</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <caption className="sr-only">{ariaLabel}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4 font-medium text-muted">
                  Dia
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1 pr-4 font-medium text-muted">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label + i} className="border-t border-line">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {d.label}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-4 tabular-nums">
                      {d.values[s.key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export interface PricePointLite {
  at: string;
  priceCents: number;
}

/** Histórico de preço (degraus: o preço vale até a próxima observação). Eixo Y não começa em zero. */
export function PriceLineChart({ points, height = 180 }: { points: PricePointLite[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const sorted = [...points].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (sorted.length === 0) return null;
  const left = 64;
  const right = 10;
  const top = 10;
  const bottom = 26;
  const prices = sorted.map((p) => p.priceCents);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    const d = Math.max(100, Math.round(min * 0.05));
    min -= d;
    max += d;
  } else {
    const pad = Math.round((max - min) * 0.1);
    min -= pad;
    max += pad;
  }
  const t0 = new Date(sorted[0]!.at).getTime();
  const t1 = new Date(sorted[sorted.length - 1]!.at).getTime();
  const tSpan = t1 - t0 || 1;
  const innerW = Math.max(0, width - left - right);
  const innerH = height - top - bottom;
  const x = (iso: string) => left + (sorted.length === 1 ? innerW / 2 : ((new Date(iso).getTime() - t0) / tSpan) * innerW);
  const y = (c: number) => top + innerH - ((c - min) / (max - min)) * innerH;

  let path = '';
  sorted.forEach((p, i) => {
    const px = x(p.at);
    const py = y(p.priceCents);
    path += i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : ` H${px.toFixed(1)} V${py.toFixed(1)}`;
  });
  const yTicks = [min, (min + max) / 2, max].map((v) => Math.round(v));
  const dayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const aria = `Histórico de preço com ${sorted.length} observação(ões), de ${formatBRL(Math.min(...prices))} a ${formatBRL(Math.max(...prices))}.`;

  return (
    <figure className="m-0">
      <div ref={ref} className="w-full" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={aria}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray="3 3" />
                <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--muted))">
                  {formatBRL(t)}
                </text>
              </g>
            ))}
            {sorted.length > 1 ? <path d={path} fill="none" stroke="rgb(var(--primary-ink))" strokeWidth="2" strokeLinejoin="round" /> : null}
            {sorted.map((p, i) => (
              <circle key={p.at + i} cx={x(p.at)} cy={y(p.priceCents)} r="3.5" fill="rgb(var(--surface))" stroke="rgb(var(--primary-ink))" strokeWidth="2">
                <title>{`${formatDateTime(p.at)} — ${formatBRL(p.priceCents)}`}</title>
              </circle>
            ))}
            <text x={left} y={height - 7} fontSize="10" fill="rgb(var(--muted))">
              {dayFmt.format(new Date(sorted[0]!.at))}
            </text>
            {sorted.length > 1 ? (
              <text x={width - right} y={height - 7} fontSize="10" textAnchor="end" fill="rgb(var(--muted))">
                {dayFmt.format(new Date(sorted[sorted.length - 1]!.at))}
              </text>
            ) : null}
          </svg>
        ) : null}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">Ver observações em tabela</summary>
        <div className="mt-2 max-h-48 overflow-auto">
          <table className="min-w-full text-left text-xs">
            <caption className="sr-only">Observações de preço</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4 font-medium text-muted">
                  Data
                </th>
                <th scope="col" className="py-1 pr-4 font-medium text-muted">
                  Preço
                </th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((p, i) => (
                <tr key={p.at + i} className="border-t border-line">
                  <td className="py-1 pr-4">{formatDateTime(p.at)}</td>
                  <td className="py-1 pr-4 tabular-nums">{formatBRL(p.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
