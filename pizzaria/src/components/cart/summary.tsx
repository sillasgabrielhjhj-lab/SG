import { formatCents } from '@/lib/format';
import type { CartTotals } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export function Summary({ totals, mode, className }: { totals: CartTotals; mode: 'delivery' | 'pickup'; className?: string }) {
  return (
    <dl className={cn('space-y-1.5 text-[0.9375rem]', className)}>
      <div className="flex justify-between text-ink-600">
        <dt>Subtotal</dt>
        <dd className="tabular-nums">{formatCents(totals.subtotalCents)}</dd>
      </div>
      <div className="flex justify-between text-ink-600">
        <dt>{mode === 'delivery' ? 'Delivery' : 'In-store pickup'}</dt>
        <dd className={cn('tabular-nums', mode === 'pickup' || totals.deliveryFeeCents === 0 ? 'font-semibold text-basil-600' : '')}>
          {mode === 'pickup' || totals.deliveryFeeCents === 0 ? 'Free' : formatCents(totals.deliveryFeeCents)}
        </dd>
      </div>
      <div className="flex justify-between pt-1 text-lg font-bold text-ink-900">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatCents(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
