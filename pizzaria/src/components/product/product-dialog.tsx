'use client';

import { AnimatePresence, m } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { productFallback } from '@/components/menu/product-visual';
import { ProductTags } from '@/components/menu/product-tags';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { SmartImage } from '@/components/ui/smart-image';
import { formatCents, formatPrice, toCents } from '@/lib/format';
import {
  getGroupOptions,
  getHalfAndHalfCandidates,
  getOptionGroups,
  getProduct,
  isAvailable,
} from '@/lib/menu';
import { getUnitPriceCents, validateSelection } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { MAX_QUANTITY, useCart } from '@/store/cart';
import { useUI } from '@/store/ui';
import type { ItemSelection } from '@/types/cart';
import type { OptionGroup, Product } from '@/types/menu';

const NOTES_MAX = 140;

export function ProductDialog() {
  const current = useUI((s) => s.product);
  const close = useUI((s) => s.closeProduct);
  // Mantém o último produto durante a animação de saída.
  const [last, setLast] = useState(current);
  if (current && current !== last) setLast(current);

  const product = getProduct(last?.id);

  return (
    <Dialog open={current !== null} onClose={close} labelledBy="product-title" variant="sheet">
      {product && last && (
        <ProductForm key={`${last.id}:${last.editLineId ?? ''}`} product={product} editLineId={last.editLineId} onDone={close} />
      )}
    </Dialog>
  );
}

function defaultSizeId(product: Product) {
  if (!product.sizes?.length) return undefined;
  return (product.sizes.find((s) => s.id === 'grande') ?? product.sizes[0])?.id;
}

function defaultOptions(product: Product) {
  const options: Record<string, string[]> = {};
  for (const group of getOptionGroups(product)) {
    options[group.id] = group.type === 'single' && group.defaultOptionId ? [group.defaultOptionId] : [];
  }
  return options;
}

function ProductForm({ product, editLineId, onDone }: { product: Product; editLineId?: string; onDone: () => void }) {
  const editing = useCart((s) => (editLineId ? s.items.find((i) => i.lineId === editLineId) : undefined));
  const addItem = useCart((s) => s.addItem);
  const replaceItem = useCart((s) => s.replaceItem);
  const showToast = useUI((s) => s.showToast);

  const [sizeId, setSizeId] = useState(editing?.sizeId ?? defaultSizeId(product));
  const [options, setOptions] = useState<Record<string, string[]>>(() => ({
    ...defaultOptions(product),
    ...(editing?.options ?? {}),
  }));
  const [halfOn, setHalfOn] = useState(Boolean(editing?.halfProductId));
  const [halfId, setHalfId] = useState(editing?.halfProductId);
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notesId = useId();

  const groups = getOptionGroups(product);
  const halfCandidates = useMemo(() => getHalfAndHalfCandidates(product, sizeId), [product, sizeId]);
  const effectiveHalfId = halfOn && halfCandidates.some((p) => p.id === halfId) ? halfId : undefined;
  const available = isAvailable(product);

  const selection: ItemSelection = {
    productId: product.id,
    sizeId,
    halfProductId: effectiveHalfId,
    options,
    notes: notes.trim() || undefined,
  };
  const unitCents = getUnitPriceCents(selection) ?? 0;
  const totalCents = unitCents * quantity;

  const setGroup = (group: OptionGroup, optionId: string, checked: boolean) => {
    setError(null);
    setOptions((prev) => {
      const currentIds = prev[group.id] ?? [];
      if (group.type === 'single') return { ...prev, [group.id]: [optionId] };
      const next = checked ? [...currentIds, optionId] : currentIds.filter((id) => id !== optionId);
      return { ...prev, [group.id]: next };
    });
  };

  const focusSection = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = () => {
    if (halfOn && !effectiveHalfId) {
      setError('Pick the second flavor or turn off half & half.');
      focusSection('half');
      return;
    }
    const problem = validateSelection(selection);
    if (problem) {
      setError(problem);
      const missing = groups.find((g) => g.required && !(options[g.id] ?? []).length);
      if (missing) focusSection(missing.id);
      return;
    }
    if (editLineId) {
      replaceItem(editLineId, selection, quantity);
      showToast('Item updated');
    } else {
      addItem(selection, quantity);
      showToast(`${quantity > 1 ? `${quantity}x ` : ''}${product.name} added to cart`, 'open-cart');
    }
    onDone();
  };

  const image = (
    <SmartImage
      src={product.image}
      alt={product.name}
      sizes="(min-width: 768px) 24rem, 100vw"
      quality={75}
      className="size-full"
      {...productFallback(product)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <IconButton
        label="Close"
        tone="glass"
        onClick={onDone}
        className="absolute top-3 right-3 z-20 md:top-4 md:right-4"
      >
        <X className="size-5" aria-hidden />
      </IconButton>

      <div className="relative hidden md:block md:w-[42%] md:shrink-0">{image}</div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative aspect-[16/10] md:hidden">
            {image}
            <span aria-hidden className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/70" />
          </div>

          <div className="px-5 pt-6 pb-8 md:px-8 md:pt-9">
            <ProductTags tags={product.tags} className="mb-3" />
            <h2 id="product-title" className="text-display pr-10 text-[1.85rem] leading-tight font-medium md:text-4xl">
              {editLineId ? `Edit · ${product.name}` : product.name}
            </h2>
            <p className="mt-2.5 leading-relaxed text-ink-500">{product.description}</p>
            {product.serves && <p className="mt-2 text-sm font-semibold text-ink-700">{product.serves}</p>}
            {!available && (
              <p className="mt-4 rounded-xl bg-tomato-50 px-4 py-3 text-sm font-semibold text-tomato-700">
                This item is sold out right now.
              </p>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <fieldset className="mt-8" data-section="size">
                <GroupLegend title="Size" required />
                <div className={cn('mt-3 grid gap-2.5', product.sizes.length >= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                  {product.sizes.map((size) => {
                    const checked = sizeId === size.id;
                    return (
                      <label
                        key={size.id}
                        className={cn(
                          'relative flex cursor-pointer flex-col rounded-2xl border bg-white px-3 py-3 transition-[border-color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tomato-500 sm:px-4',
                          checked ? 'border-tomato-500 shadow-[0_0_0_1px_var(--color-tomato-500)]' : 'border-ink-900/10 hover:border-ink-900/25',
                        )}
                      >
                        <input
                          type="radio"
                          name="size"
                          value={size.id}
                          checked={checked}
                          onChange={() => {
                            setSizeId(size.id);
                            setError(null);
                          }}
                          className="sr-only"
                        />
                        <span className="font-semibold text-ink-900">{size.name}</span>
                        {size.detail && <span className="mt-0.5 text-xs leading-snug text-ink-500">{size.detail}</span>}
                        <span className="mt-2 text-sm font-bold text-ink-900">{formatPrice(size.price)}</span>
                        {checked && (
                          <span className="absolute top-2.5 right-2.5 inline-flex size-5 items-center justify-center rounded-full bg-tomato-500 text-white">
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {product.halfAndHalf && (
              <div className="mt-8" data-section="half">
                <button
                  type="button"
                  role="switch"
                  aria-checked={halfOn}
                  onClick={() => {
                    setHalfOn((v) => !v);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-ink-900/10 bg-white px-4 py-3.5 text-left transition-colors hover:border-ink-900/25"
                >
                  <span>
                    <span className="block font-semibold text-ink-900">Half & half pizza</span>
                    <span className="text-sm text-ink-500">Pick a 2nd flavor · priced as the more expensive one</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
                      halfOn ? 'bg-tomato-500' : 'bg-ink-900/15',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-1 size-5 rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-spring)]',
                        halfOn && 'translate-x-5',
                      )}
                    />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {halfOn && (
                    <m.fieldset
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <legend className="sr-only">Second flavor</legend>
                      <ul className="mt-3 divide-y divide-ink-900/[0.06] rounded-2xl border border-ink-900/10 bg-white">
                        {halfCandidates.map((candidate) => {
                          const price = candidate.sizes?.find((s) => s.id === sizeId)?.price;
                          return (
                            <li key={candidate.id}>
                              <OptionRow
                                type="radio"
                                name="half"
                                label={`½ ${candidate.name}`}
                                hint={candidate.description}
                                checked={halfId === candidate.id}
                                onChange={() => {
                                  setHalfId(candidate.id);
                                  setError(null);
                                }}
                                price={price !== undefined ? formatPrice(price) : undefined}
                                priceTone="muted"
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </m.fieldset>
                  )}
                </AnimatePresence>
              </div>
            )}

            {groups.map((group) => {
              const chosen = options[group.id] ?? [];
              const items = getGroupOptions(group);
              const limitReached = group.type === 'multiple' && group.max !== undefined && chosen.length >= group.max;
              return (
                <fieldset key={group.id} className="mt-8" data-section={group.id}>
                  <GroupLegend
                    title={group.title}
                    required={group.required}
                    hint={group.type === 'multiple' && group.max ? `up to ${group.max}` : undefined}
                  />
                  <ul className="mt-3 divide-y divide-ink-900/[0.06] rounded-2xl border border-ink-900/10 bg-white">
                    {items.map((option) => {
                      const checked = chosen.includes(option.id);
                      return (
                        <li key={option.id}>
                          <OptionRow
                            type={group.type === 'single' ? 'radio' : 'checkbox'}
                            name={group.id}
                            label={option.name}
                            checked={checked}
                            disabled={!checked && limitReached}
                            onChange={(value) => setGroup(group, option.id, value)}
                            price={option.price > 0 ? `+ ${formatCents(toCents(option.price))}` : undefined}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}

            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <label htmlFor={notesId} className="font-semibold text-ink-900">
                  Any special requests?
                </label>
                <span className="text-xs text-ink-400 tabular-nums">
                  {notes.length}/{NOTES_MAX}
                </span>
              </div>
              <textarea
                id={notesId}
                value={notes}
                maxLength={NOTES_MAX}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="E.g. no onions, well done…"
                className="mt-2.5 w-full resize-none rounded-2xl border border-ink-900/10 bg-white px-4 py-3 text-[0.9375rem] outline-none placeholder:text-ink-400 focus:border-tomato-500 focus:ring-4 focus:ring-tomato-500/15"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-ink-900/[0.07] bg-cream-50 px-5 pt-3 pb-safe md:px-8 md:pb-5">
          <AnimatePresence>
            {error && (
              <m.p
                role="alert"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-2.5 text-sm font-semibold text-tomato-700"
              >
                {error}
              </m.p>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={MAX_QUANTITY}
              itemName={product.name}
            />
            <Button size="lg" className="flex-1 justify-between px-5 sm:px-6" onClick={submit} disabled={!available}>
              <span>{!available ? 'Unavailable' : editLineId ? 'Save' : 'Add'}</span>
              {available && (
                <m.span key={totalCents} initial={{ opacity: 0.4, y: -4 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
                  {formatCents(totalCents)}
                </m.span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupLegend({ title, required, hint }: { title: string; required?: boolean; hint?: string }) {
  return (
    <legend className="flex w-full items-center justify-between gap-3">
      <span className="font-semibold text-ink-900">{title}</span>
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-wide uppercase',
          required ? 'bg-ink-900 text-cream-50' : 'bg-cream-200 text-ink-600',
        )}
      >
        {required ? 'Required' : `Optional${hint ? ` · ${hint}` : ''}`}
      </span>
    </legend>
  );
}

interface OptionRowProps {
  type: 'radio' | 'checkbox';
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  price?: string;
  priceTone?: 'default' | 'muted';
  onChange: (checked: boolean) => void;
}

function OptionRow({ type, name, label, hint, checked, disabled, price, priceTone = 'default', onChange }: OptionRowProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl has-[:focus-visible]:bg-cream-100',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-cream-100/70',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'inline-flex size-[1.375rem] shrink-0 items-center justify-center border-2 transition-colors',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          checked ? 'border-tomato-500 bg-tomato-500 text-white' : 'border-ink-900/20 bg-white',
        )}
      >
        {checked &&
          (type === 'radio' ? (
            <span className="size-2 rounded-full bg-white" />
          ) : (
            <Check className="size-3.5" strokeWidth={3} />
          ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-ink-900">{label}</span>
        {hint && <span className="mt-0.5 line-clamp-1 block text-xs text-ink-500">{hint}</span>}
      </span>
      {price && (
        <span className={cn('shrink-0 text-sm tabular-nums', priceTone === 'muted' ? 'text-ink-500' : 'font-semibold text-ink-700')}>
          {price}
        </span>
      )}
    </label>
  );
}
