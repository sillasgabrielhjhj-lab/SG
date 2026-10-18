import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { criterionLabel, OFFER_TIER } from '@/lib/labels';
import type { OfferTier, ScoreBreakdown } from '@/lib/types';

const BAR: Record<OfferTier, string> = {
  EXCEPTIONAL: 'bg-success',
  EXCELLENT: 'bg-success',
  GOOD: 'bg-info',
  BELOW: 'bg-muted',
};

/** Barra de score 0–100 (valor também em texto: a cor nunca é a única informação). */
export function ScoreBar({ score, tier, showTier = false }: { score: number; tier: OfferTier; showTier?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const t = OFFER_TIER[tier] ?? { label: tier, tone: 'neutral' as const };
  return (
    <div className="min-w-[96px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{score}</span>
        <span className="text-[11px] text-muted">/ 100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Score ${score} de 100 — ${t.label}`}>
        <div className={cn('h-full rounded-full', BAR[tier] ?? 'bg-muted')} style={{ width: `${pct}%` }} />
      </div>
      {showTier ? (
        <div className="mt-1.5">
          <Badge tone={t.tone}>{t.label}</Badge>
        </div>
      ) : null}
    </div>
  );
}

/** Quebra do score por critério, com a observação real ("sem dado" quando a fonte não informou). */
export function ScoreBreakdownList({ breakdown }: { breakdown: ScoreBreakdown | null }) {
  const entries = breakdown ? Object.entries(breakdown) : [];
  if (entries.length === 0) return <p className="text-sm text-muted">Quebra do score indisponível para esta oferta.</p>;
  return (
    <ul className="space-y-2.5">
      {entries.map(([key, v]) => {
        const pct = v.max > 0 ? Math.max(0, Math.min(100, (v.points / v.max) * 100)) : 0;
        return (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{criterionLabel(key)}</span>
              <span className="tabular-nums text-muted">
                {Number.isInteger(v.points) ? v.points : v.points.toFixed(1)} / {Number.isInteger(v.max) ? v.max : v.max.toFixed(1)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            {v.note ? <p className="mt-0.5 text-xs text-muted">{v.note}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
