'use client';

import { Banknote, Bike, CreditCard, LoaderCircle, QrCode, Store, TriangleAlert } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { WhatsAppIcon } from '@/components/icons/social';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { useOpenStatus } from '@/hooks/use-open-status';
import { formatCents, maskCep, maskPhone, onlyDigits, parseMoneyInput, toCents } from '@/lib/format';
import type { CartTotals, ResolvedCartItem } from '@/lib/pricing';
import { readStorage, removeStorage, writeStorage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { buildOrderMessage, createOrderCode, paymentLabels, whatsappLink } from '@/lib/whatsapp';
import { useCart } from '@/store/cart';
import { useUI } from '@/store/ui';
import type { CheckoutData, PaymentMethod } from '@/types/cart';
import { Summary } from './summary';

const CUSTOMER_KEY = 'pizzaria:customer';

type Errors = Partial<Record<string, string>>;

function emptyCheckout(): CheckoutData {
  return {
    name: '',
    phone: '',
    mode: 'delivery',
    address: {
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: siteConfig.delivery.defaultCity,
      reference: '',
    },
    payment: 'pix',
    changeFor: '',
    notes: '',
  };
}

function loadSaved(): CheckoutData {
  const base = emptyCheckout();
  const saved = readStorage<Partial<CheckoutData>>(CUSTOMER_KEY);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    name: typeof saved.name === 'string' ? saved.name : '',
    phone: typeof saved.phone === 'string' ? saved.phone : '',
    address: { ...base.address, ...(saved.address ?? {}) },
  };
}

function validate(data: CheckoutData, totals: CartTotals): Errors {
  const errors: Errors = {};
  if (data.name.trim().length < 2) errors.name = 'Please enter your name.';
  const phone = onlyDigits(data.phone);
  if (phone.length < 10 || phone.length > 11) errors.phone = 'Please enter a phone number with area code.';
  if (data.mode === 'delivery') {
    if (data.address.cep && onlyDigits(data.address.cep).length !== 8) errors.cep = 'Incomplete postal code.';
    if (!data.address.street.trim()) errors.street = 'Please enter the street.';
    if (!data.address.number.trim()) errors.number = 'Please enter the number (or “n/a”).';
    if (!data.address.neighborhood.trim()) errors.neighborhood = 'Please enter the neighborhood.';
  }
  if (data.payment === 'dinheiro' && data.changeFor.trim()) {
    const value = parseMoneyInput(data.changeFor);
    if (value === null || toCents(value) < totals.totalCents) {
      errors.changeFor = `Change must be for an amount above ${formatCents(totals.totalCents)}.`;
    }
  }
  return errors;
}

const paymentIcons: Record<PaymentMethod, typeof QrCode> = {
  pix: QrCode,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
};

type CepState = 'idle' | 'loading' | 'error' | 'found';

export function CheckoutForm({ lines, totals: cartTotals }: { lines: ResolvedCartItem[]; totals: CartTotals }) {
  const mode = useCart((s) => s.mode);
  const setMode = useCart((s) => s.setMode);
  const clearCart = useCart((s) => s.clear);
  const setStep = useUI((s) => s.setCartStep);
  const setLastOrder = useUI((s) => s.setLastOrder);
  const status = useOpenStatus();

  const [data, setData] = useState<CheckoutData>(loadSaved);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [cepState, setCepState] = useState<CepState>('idle');
  const cepAbort = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const checkout: CheckoutData = { ...data, mode };
  const totals = cartTotals;
  const closedBlock = status && !status.isOpen && !siteConfig.ordering.allowWhenClosed;

  const update = <K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const updateAddress = (key: keyof CheckoutData['address'], value: string) => {
    setData((d) => ({ ...d, address: { ...d.address, [key]: value } }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const lookupCep = async (cep: string) => {
    cepAbort.current?.abort();
    const controller = new AbortController();
    cepAbort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    setCepState('loading');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
      if (!res.ok) throw new Error('cep');
      const json = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (json.erro) throw new Error('not-found');
      setData((d) => ({
        ...d,
        address: {
          ...d.address,
          street: json.logradouro || d.address.street,
          neighborhood: json.bairro || d.address.neighborhood,
          city: json.localidade ? `${json.localidade}${json.uf ? ` - ${json.uf}` : ''}` : d.address.city,
        },
      }));
      setErrors((e) => ({ ...e, street: undefined, neighborhood: undefined }));
      setCepState('found');
    } catch {
      if (!controller.signal.aborted || cepAbort.current === controller) setCepState('error');
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const onCepChange = (value: string) => {
    const masked = maskCep(value);
    updateAddress('cep', masked);
    const digits = onlyDigits(masked);
    if (digits.length === 8) void lookupCep(digits);
    else setCepState('idle');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(checkout, totals);
    setErrors(found);
    const firstError = Object.keys(found)[0];
    if (firstError) {
      const field = formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`);
      field?.focus();
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    const code = createOrderCode();
    const message = buildOrderMessage({ code, lines, totals, checkout });
    const url = whatsappLink(message);

    if (remember) {
      writeStorage(CUSTOMER_KEY, { name: checkout.name, phone: checkout.phone, address: checkout.address });
    } else {
      removeStorage(CUSTOMER_KEY);
    }

    // Abre o WhatsApp no mesmo gesto do clique (evita bloqueio de pop-up).
    window.open(url, '_blank', 'noopener,noreferrer');
    setLastOrder({ code, message, url });
    clearCart();
    setStep('success');
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6">
        {status && !status.isOpen && (
          <div className="flex gap-3 rounded-2xl bg-gold-300/25 px-4 py-3 text-sm text-[#6b4a0e]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong>We’re closed right now.</strong> {status.detail}.{' '}
              {siteConfig.ordering.allowWhenClosed
                ? "You can still send your order and we'll reply as soon as we open."
                : 'Please come back during our opening hours.'}
            </p>
          </div>
        )}

        <FormSection title="Your details">
          <Field label="Name" error={errors.name} htmlFor="name">
            <input
              id="name"
              name="name"
              autoComplete="name"
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="What should we call you?"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={inputClass(errors.name)}
            />
          </Field>
          <Field label="Phone / WhatsApp" error={errors.phone} htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={data.phone}
              onChange={(e) => update('phone', maskPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              className={inputClass(errors.phone)}
            />
          </Field>
        </FormSection>

        <FormSection title="How would you like to get it?">
          <div role="radiogroup" aria-label="Delivery method" className="grid grid-cols-2 gap-2.5">
            {(
              [
                { id: 'delivery', label: 'Delivery', hint: siteConfig.delivery.estimate, icon: Bike },
                { id: 'pickup', label: 'Pickup', hint: siteConfig.delivery.pickupEstimate, icon: Store },
              ] as const
            ).map(({ id, label, hint, icon: Icon }) => (
              <ChoiceCard key={id} name="mode" checked={mode === id} onChange={() => setMode(id)}>
                <Icon className="size-5 text-tomato-500" aria-hidden />
                <span className="mt-2 block font-semibold">{label}</span>
                <span className="block text-xs text-ink-500">{hint}</span>
              </ChoiceCard>
            ))}
          </div>

          {mode === 'delivery' ? (
            <div className="grid grid-cols-6 gap-3">
              <Field
                label="Postal code (optional)"
                error={errors.cep}
                htmlFor="cep"
                className="col-span-6 sm:col-span-3"
                hint={
                  cepState === 'loading' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Looking up address…
                    </span>
                  ) : cepState === 'found' ? (
                    'Address filled in. Please double-check it.'
                  ) : cepState === 'error' ? (
                    "We couldn't find that postal code. Please fill in the address manually."
                  ) : undefined
                }
              >
                <input
                  id="cep"
                  name="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={data.address.cep}
                  onChange={(e) => onCepChange(e.target.value)}
                  placeholder="00000-000"
                  aria-invalid={Boolean(errors.cep)}
                  aria-describedby={errors.cep ? 'cep-error' : 'cep-hint'}
                  className={inputClass(errors.cep)}
                />
              </Field>
              <Field label="Street" error={errors.street} htmlFor="street" className="col-span-6">
                <input
                  id="street"
                  name="street"
                  autoComplete="address-line1"
                  value={data.address.street}
                  onChange={(e) => updateAddress('street', e.target.value)}
                  aria-invalid={Boolean(errors.street)}
                  aria-describedby={errors.street ? 'street-error' : undefined}
                  className={inputClass(errors.street)}
                />
              </Field>
              <Field label="Number" error={errors.number} htmlFor="number" className="col-span-2">
                <input
                  id="number"
                  name="number"
                  inputMode="numeric"
                  value={data.address.number}
                  onChange={(e) => updateAddress('number', e.target.value)}
                  aria-invalid={Boolean(errors.number)}
                  aria-describedby={errors.number ? 'number-error' : undefined}
                  className={inputClass(errors.number)}
                />
              </Field>
              <Field label="Apt / unit" htmlFor="complement" className="col-span-4">
                <input
                  id="complement"
                  name="complement"
                  autoComplete="address-line2"
                  value={data.address.complement}
                  onChange={(e) => updateAddress('complement', e.target.value)}
                  placeholder="Apt, building…"
                  className={inputClass()}
                />
              </Field>
              <Field label="Neighborhood" error={errors.neighborhood} htmlFor="neighborhood" className="col-span-6 sm:col-span-3">
                <input
                  id="neighborhood"
                  name="neighborhood"
                  value={data.address.neighborhood}
                  onChange={(e) => updateAddress('neighborhood', e.target.value)}
                  aria-invalid={Boolean(errors.neighborhood)}
                  aria-describedby={errors.neighborhood ? 'neighborhood-error' : undefined}
                  className={inputClass(errors.neighborhood)}
                />
              </Field>
              <Field label="City" htmlFor="city" className="col-span-6 sm:col-span-3">
                <input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={data.address.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                  className={inputClass()}
                />
              </Field>
              <Field label="Landmark" htmlFor="reference" className="col-span-6">
                <input
                  id="reference"
                  name="reference"
                  value={data.address.reference}
                  onChange={(e) => updateAddress('reference', e.target.value)}
                  placeholder="Optional"
                  className={inputClass()}
                />
              </Field>
            </div>
          ) : (
            <p className="rounded-2xl bg-cream-200/70 px-4 py-3 text-sm text-ink-600">
              Pick up at: <strong className="text-ink-900">{siteConfig.address.street}</strong> — {siteConfig.address.neighborhood},{' '}
              {siteConfig.address.city}, {siteConfig.address.state}
            </p>
          )}
        </FormSection>

        <FormSection title="Payment">
          <p className="-mt-1 text-xs text-ink-500">You pay on delivery or at pickup.</p>
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5">
            {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => {
              const Icon = paymentIcons[method];
              return (
                <ChoiceCard key={method} name="payment" checked={data.payment === method} onChange={() => update('payment', method)}>
                  <span className="flex items-center gap-2.5">
                    <Icon className="size-[1.125rem] text-tomato-500" aria-hidden />
                    <span className="text-sm font-semibold">{paymentLabels[method]}</span>
                  </span>
                </ChoiceCard>
              );
            })}
          </div>
          {data.payment === 'pix' && (
            <p className="text-xs text-ink-500">We’ll send our Pix key over WhatsApp with your confirmation.</p>
          )}
          {data.payment === 'dinheiro' && (
            <Field label="Change for how much?" error={errors.changeFor} htmlFor="changeFor" hint="Leave blank if you don’t need change.">
              <input
                id="changeFor"
                name="changeFor"
                inputMode="decimal"
                value={data.changeFor}
                onChange={(e) => update('changeFor', e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="E.g. 200"
                aria-invalid={Boolean(errors.changeFor)}
                aria-describedby={errors.changeFor ? 'changeFor-error' : 'changeFor-hint'}
                className={inputClass(errors.changeFor)}
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Order notes">
          <label htmlFor="notes" className="sr-only">
            Order notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={300}
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="E.g. buzzer is broken, please call on arrival…"
            className={cn(inputClass(), 'h-auto resize-none py-3')}
          />
        </FormSection>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 size-4 accent-tomato-500"
          />
          Remember my details on this device for next time.
        </label>
      </div>

      <div className="shrink-0 border-t border-ink-900/[0.07] bg-white px-5 pt-4 pb-safe">
        <Summary totals={totals} mode={mode} />
        <Button type="submit" variant="whatsapp" size="lg" className="mt-4 w-full" disabled={submitting || Boolean(closedBlock)}>
          {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <WhatsAppIcon className="size-5" />}
          Send order via WhatsApp
        </Button>
        <p className="mt-2.5 text-center text-xs text-ink-400">
          You can review the message in WhatsApp before sending.
        </p>
      </div>
    </form>
  );
}

function inputClass(error?: string) {
  return cn(
    'h-12 w-full rounded-xl border bg-white px-4 text-[0.9375rem] text-ink-900 outline-none transition-[border-color,box-shadow] placeholder:text-ink-400 focus:ring-4',
    error
      ? 'border-tomato-500 focus:border-tomato-500 focus:ring-tomato-500/15'
      : 'border-ink-900/12 focus:border-tomato-500 focus:ring-tomato-500/15',
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3.5">
      <legend className="mb-3.5 text-display text-lg font-medium text-ink-900">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[0.8125rem] font-medium text-tomato-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} aria-live="polite" className="mt-1.5 text-[0.8125rem] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceCard({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        'relative block cursor-pointer rounded-2xl border bg-white px-4 py-3.5 transition-[border-color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tomato-500',
        checked ? 'border-tomato-500 shadow-[0_0_0_1px_var(--color-tomato-500)]' : 'border-ink-900/10 hover:border-ink-900/25',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}
