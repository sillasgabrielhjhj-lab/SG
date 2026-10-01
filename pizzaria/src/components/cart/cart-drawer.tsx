'use client';

import { AnimatePresence, m } from 'framer-motion';
import { ArrowLeft, Bike, Pencil, ShoppingBag, Store, X } from 'lucide-react';
import { productFallback } from '@/components/menu/product-visual';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { SmartImage } from '@/components/ui/smart-image';
import { siteConfig } from '@/config/site';
import { products } from '@/data/menu';
import { useCartSummary } from '@/hooks/use-cart-summary';
import { useProductActions } from '@/hooks/use-product-actions';
import { formatCents, formatPrice, plural, toCents } from '@/lib/format';
import { getStartingPrice } from '@/lib/menu';
import type { CartTotals, ResolvedCartItem } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { MAX_QUANTITY, useCart } from '@/store/cart';
import { useUI } from '@/store/ui';
import { CheckoutForm } from './checkout-form';
import { OrderSuccess } from './order-success';
import { Summary } from './summary';

const titles = { cart: 'Sua sacola', checkout: 'Finalizar pedido', success: 'Pedido enviado' } as const;

export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const step = useUI((s) => s.cartStep);
  const close = useUI((s) => s.closeCart);
  const setStep = useUI((s) => s.setCartStep);
  const { lines, totals, mode } = useCartSummary();

  return (
    <Dialog open={open} onClose={close} labelledBy="cart-title" variant="drawer">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-ink-900/[0.07] px-3 sm:px-4">
        {step === 'checkout' ? (
          <IconButton label="Voltar para a sacola" tone="light" onClick={() => setStep('cart')}>
            <ArrowLeft className="size-5" aria-hidden />
          </IconButton>
        ) : (
          <span className="inline-flex size-10 items-center justify-center text-tomato-500">
            <ShoppingBag className="size-5" aria-hidden />
          </span>
        )}
        <h2 id="cart-title" className="text-display flex-1 text-xl font-medium">
          {titles[step]}
          {step === 'cart' && totals.itemCount > 0 && (
            <span className="ml-2 font-sans text-sm font-medium text-ink-400">{plural(totals.itemCount, 'item', 'itens')}</span>
          )}
        </h2>
        <IconButton label="Fechar sacola" tone="light" onClick={close} data-autofocus>
          <X className="size-5" aria-hidden />
        </IconButton>
      </div>

      {step !== 'success' && lines.length > 0 && <CheckoutSteps current={step === 'cart' ? 1 : 2} />}

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={step}
          initial={{ opacity: 0, x: step === 'cart' ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: step === 'cart' ? -16 : 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {step === 'success' ? (
            <OrderSuccess onClose={close} />
          ) : lines.length === 0 ? (
            <EmptyCart onClose={close} />
          ) : step === 'cart' ? (
            <CartView lines={lines} totals={totals} mode={mode} onContinue={() => setStep('checkout')} />
          ) : (
            <CheckoutForm lines={lines} totals={totals} />
          )}
        </m.div>
      </AnimatePresence>
    </Dialog>
  );
}

function CheckoutSteps({ current }: { current: 1 | 2 }) {
  const steps = ['Sacola', 'Dados', 'WhatsApp'];
  return (
    <ol className="flex shrink-0 items-center gap-2 border-b border-ink-900/[0.05] px-5 py-2.5 text-xs font-semibold" aria-label="Etapas do pedido">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i + 1 === current ? 'step' : undefined}>
          <span
            className={cn(
              'inline-flex size-5 items-center justify-center rounded-full text-[0.6875rem]',
              i + 1 <= current ? 'bg-ink-900 text-cream-50' : 'bg-ink-900/10 text-ink-500',
            )}
          >
            {i + 1}
          </span>
          <span className={i + 1 === current ? 'text-ink-900' : 'text-ink-400'}>{label}</span>
          {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-ink-900/15" />}
        </li>
      ))}
    </ol>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="inline-flex size-20 items-center justify-center rounded-full bg-cream-200 text-ink-400">
        <ShoppingBag className="size-9 stroke-[1.25]" aria-hidden />
      </span>
      <p className="text-display mt-6 text-2xl">Sua sacola está vazia</p>
      <p className="mt-2 max-w-xs text-ink-500">Que tal começar por uma das pizzas favoritas da casa?</p>
      <a
        href="#cardapio"
        onClick={onClose}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-tomato-500 px-7 font-semibold text-white transition-colors hover:bg-tomato-600"
      >
        Ver cardápio
      </a>
    </div>
  );
}

interface CartViewProps {
  lines: ResolvedCartItem[];
  totals: CartTotals;
  mode: 'delivery' | 'pickup';
  onContinue: () => void;
}

function CartView({ lines, totals, mode, onContinue }: CartViewProps) {
  const setQuantity = useCart((s) => s.setQuantity);
  const setMode = useCart((s) => s.setMode);
  const openProduct = useUI((s) => s.openProduct);
  const blockedByMinimum = totals.missingForMinimumCents > 0;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {mode === 'delivery' && <FreeDeliveryProgress totals={totals} />}

        <ul className="divide-y divide-ink-900/[0.07] px-5">
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <m.li
                key={line.item.lineId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3.5 py-4">
                  <SmartImage
                    src={line.product.image}
                    alt=""
                    sizes="64px"
                    className="size-16 shrink-0 rounded-xl"
                    {...productFallback(line.product)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold leading-snug text-ink-900">
                        {line.halfProduct ? `½ ${line.product.name} + ½ ${line.halfProduct.name}` : line.product.name}
                      </p>
                      <p className="shrink-0 font-semibold tabular-nums">{formatCents(line.totalCents)}</p>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-[0.8125rem] leading-snug text-ink-500">
                      {line.sizeLabel && <li>{line.sizeLabel}</li>}
                      {line.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                      {line.item.notes && <li className="italic">“{line.item.notes}”</li>}
                    </ul>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={line.item.quantity}
                        max={MAX_QUANTITY}
                        allowRemove
                        itemName={line.product.name}
                        onChange={(q) => setQuantity(line.item.lineId, q)}
                      />
                      <button
                        type="button"
                        onClick={() => openProduct(line.product.id, line.item.lineId)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-600 transition-colors hover:bg-ink-900/[0.05] hover:text-ink-900"
                        aria-label={`Editar ${line.product.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden /> Editar
                      </button>
                    </div>
                  </div>
                </div>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>

        <Upsell lines={lines} />
      </div>

      <div className="shrink-0 border-t border-ink-900/[0.07] bg-white px-5 pt-4 pb-safe">
        <div role="radiogroup" aria-label="Como você quer receber?" className="grid grid-cols-2 gap-1 rounded-full bg-cream-200 p-1">
          {(
            [
              { id: 'delivery', label: 'Entrega', icon: Bike },
              { id: 'pickup', label: 'Retirada', icon: Store },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all',
                mode === id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        <Summary totals={totals} mode={mode} className="mt-4" />

        {blockedByMinimum && (
          <p className="mt-3 rounded-xl bg-gold-300/25 px-3.5 py-2.5 text-[0.8125rem] font-medium text-[#6b4a0e]">
            Pedido mínimo de {formatPrice(siteConfig.delivery.minimumOrder)}. Faltam{' '}
            {formatCents(totals.missingForMinimumCents)}.
          </p>
        )}

        <Button size="lg" className="mt-4 w-full justify-between" onClick={onContinue} disabled={blockedByMinimum}>
          <span>Continuar</span>
          <span className="tabular-nums">{formatCents(totals.totalCents)}</span>
        </Button>
      </div>
    </>
  );
}

function FreeDeliveryProgress({ totals }: { totals: CartTotals }) {
  const freeFrom = siteConfig.delivery.freeFrom;
  if (freeFrom === null || totals.missingForFreeDeliveryCents === null) return null;
  const progress = Math.min(1, totals.subtotalCents / toCents(freeFrom));
  const done = totals.missingForFreeDeliveryCents === 0;

  return (
    <div className="mx-5 mt-4 rounded-2xl bg-basil-50 px-4 py-3.5">
      <p className="text-[0.8125rem] font-medium text-basil-700">
        {done ? (
          <strong>Oba! Sua entrega é grátis.</strong>
        ) : (
          <>
            Faltam <strong>{formatCents(totals.missingForFreeDeliveryCents)}</strong> para a entrega grátis
          </>
        )}
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-basil-100"
        role="progressbar"
        aria-label="Progresso para entrega grátis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <m.div
          className="h-full rounded-full bg-basil-500"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function Upsell({ lines }: { lines: ResolvedCartItem[] }) {
  const { add } = useProductActions();
  const inCart = new Set(lines.map((l) => l.product.id));
  const suggestions = products
    .filter((p) => (p.category === 'bebidas' || p.category === 'sobremesas') && !inCart.has(p.id) && p.available !== false)
    .slice(0, 4);
  if (!suggestions.length) return null;

  return (
    <div className="mt-2 mb-6 px-5">
      <p className="text-sm font-semibold text-ink-900">Combina com seu pedido</p>
      <ul className="scrollbar-none -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {suggestions.map((p) => (
          <li key={p.id} className="w-36 shrink-0">
            <button
              type="button"
              onClick={() => add(p)}
              className="group flex w-full flex-col rounded-2xl bg-white p-2 text-left ring-1 ring-ink-900/[0.06] transition-shadow hover:shadow-[var(--shadow-soft)]"
              aria-label={`Adicionar ${p.name}, ${formatPrice(getStartingPrice(p))}`}
            >
              <SmartImage src={p.image} alt="" sizes="144px" className="aspect-[4/3] w-full rounded-xl" {...productFallback(p)} />
              <span className="mt-2 line-clamp-1 px-1 text-sm font-semibold">{p.name}</span>
              <span className="flex items-center justify-between px-1 pb-0.5 text-sm text-ink-500">
                {formatPrice(getStartingPrice(p))}
                <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-tomato-500 text-base leading-none text-white">
                  +
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
