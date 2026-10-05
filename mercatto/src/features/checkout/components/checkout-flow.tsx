"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CreditCard, FlaskConical, Lock, MapPin, Pencil, Plus, QrCode, ShieldCheck, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, installmentOptions, type InstallmentConfig } from "@/lib/money";
import { formatCep, formatCpf, formatPhone } from "@/lib/format";
import { isValidCpf, isValidPhone } from "@/lib/validators/br";
import { trackEvent } from "@/lib/analytics";
import type { CartView } from "@/features/cart/types";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MaskedInput } from "@/components/ui/masked-input";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { RadioCard } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/commerce/product-image";
import { AddressForm } from "@/features/account/components/address-form";
import { createCheckoutAction, quoteCheckoutShippingAction, reviewCheckoutAction } from "@/features/checkout/actions";
import { CardTokenizer, type CardTokenResult } from "@/features/checkout/components/card-tokenizer";

type Address = { id: string; label: string | null; recipientName: string; phone: string | null; cep: string; street: string; number: string; complement: string | null; district: string; city: string; state: string; isDefault: boolean };
type ShippingQuote = { storeId: string; storeName: string; isOfficial: boolean; options: { id: string; service: string; carrier: string | null; priceCents: number; originalPriceCents: number; minDays: number; maxDays: number; isPickup: boolean }[]; error: string | null; freeShippingReason: string | null };
type Review = Extract<Awaited<ReturnType<typeof reviewCheckoutAction>>, { ok: true }>["data"];

const STEPS = ["Identificação", "Endereço", "Entrega", "Pagamento", "Revisão"];
const KEY_STORAGE = "mrc_checkout_key";

function getIdempotencyKey(): string {
  try {
    const existing = window.sessionStorage.getItem(KEY_STORAGE);
    if (existing) return existing;
    const key = crypto.randomUUID();
    window.sessionStorage.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutFlow({
  cart,
  user,
  addresses: initialAddresses,
  installmentConfig,
  pixDiscountPercent,
  reservationMinutes,
  gateway,
}: {
  cart: CartView;
  user: { name: string; email: string; cpf: string | null; phone: string | null };
  addresses: Address[];
  installmentConfig: InstallmentConfig;
  pixDiscountPercent: number;
  reservationMinutes: number;
  gateway: { name: string; isSandbox: boolean; supportsMethods: ("PIX" | "CREDIT_CARD")[]; publicKey: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [cpf, setCpf] = useState(user.cpf ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [idErrors, setIdErrors] = useState<{ cpf?: string; phone?: string }>({});
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [addingAddress, setAddingAddress] = useState(initialAddresses.length === 0);
  const [quotes, setQuotes] = useState<ShippingQuote[] | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">(gateway.supportsMethods.includes("PIX") ? "PIX" : "CREDIT_CARD");
  const [installments, setInstallments] = useState(1);
  const [card, setCard] = useState<CardTokenResult | null>(null);
  const [note, setNote] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Endereços recarregados do servidor (router.refresh) após cadastrar um novo.
  const [prevInitialAddresses, setPrevInitialAddresses] = useState(initialAddresses);
  if (prevInitialAddresses !== initialAddresses) {
    setPrevInitialAddresses(initialAddresses);
    setAddresses(initialAddresses);
  }
  const address = addresses.find((a) => a.id === addressId);
  const estimatedTotal = review?.totals.totalCents ?? cart.totals.totalCents;
  const installmentList = useMemo(() => installmentOptions(estimatedTotal, installmentConfig), [estimatedTotal, installmentConfig]);

  const loadShipping = useCallback(
    (id: string) =>
      start(async () => {
        setQuotes(null);
        const res = await quoteCheckoutShippingAction({ addressId: id });
        if (!res.ok) return setError(res.error);
        setQuotes(res.data);
        setSelections(Object.fromEntries(res.data.filter((q) => q.options[0]).map((q) => [q.storeId, q.options[0]!.id])));
      }),
    [],
  );

  const loadReview = useCallback(
    () =>
      start(async () => {
        const res = await reviewCheckoutAction({ addressId, shippingSelections: selections, paymentMethod: method, installments: method === "PIX" ? 1 : installments });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setError(null);
        setReview(res.data);
      }),
    [addressId, selections, method, installments],
  );

  useEffect(() => {
    if (step === 2 && addressId) loadShipping(addressId);
  }, [step, addressId, loadShipping]);
  useEffect(() => {
    if (step >= 3) loadReview();
  }, [step, method, installments, loadReview]);

  const next = () => {
    setError(null);
    if (step === 0) {
      const errs: typeof idErrors = {};
      if (!isValidCpf(cpf)) errs.cpf = "CPF inválido";
      if (!isValidPhone(phone)) errs.phone = "Telefone inválido";
      setIdErrors(errs);
      if (Object.keys(errs).length) return;
    }
    if (step === 1 && !addressId) return setError("Escolha ou cadastre um endereço de entrega.");
    if (step === 2) {
      if (!quotes || quotes.some((q) => q.error || !selections[q.storeId])) return setError("Escolha a forma de entrega de cada loja.");
      trackEvent("add_shipping_info", { value: estimatedTotal / 100 });
    }
    if (step === 3) {
      if (method === "CREDIT_CARD" && !card) return setError("Informe os dados do cartão.");
      trackEvent("add_payment_info", { payment_type: method, value: estimatedTotal / 100 });
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeOrder = () =>
    start(async () => {
      setError(null);
      const res = await createCheckoutAction({
        idempotencyKey: getIdempotencyKey(),
        addressId,
        shippingSelections: selections,
        paymentMethod: method,
        installments: method === "PIX" ? 1 : installments,
        cardToken: card?.token ?? "",
        cardPaymentMethodId: card?.paymentMethodId ?? "",
        cardIssuerId: card?.issuerId ?? "",
        customer: { cpf, phone },
        customerNote: note,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error("Não foi possível finalizar", { description: res.error });
        return;
      }
      try {
        window.sessionStorage.removeItem(KEY_STORAGE);
      } catch {
        /* ignora */
      }
      trackEvent("purchase", { transaction_id: res.data.checkoutId, value: (review?.totals.totalCents ?? estimatedTotal) / 100 });
      router.push(`/checkout/pagamento/${res.data.checkoutId}`);
    });

  const edit = (s: number) => (
    <button type="button" onClick={() => setStep(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline focus-ring">
      <Pencil className="size-3.5" aria-hidden /> Alterar
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="rounded-card border border-line bg-surface px-4 py-4">
          <ProgressSteps steps={STEPS} current={step} />
        </div>
        {gateway.isSandbox ? (
          <Alert tone="warning" title="Ambiente de demonstração">
            Modo de teste: os pagamentos são simulados e nenhuma cobrança real será feita.
          </Alert>
        ) : null}
        {error ? <Alert tone="danger" title="Revise antes de continuar">{error}</Alert> : null}

        {/* 1. Identificação */}
        <section className="rounded-card border border-line bg-surface p-4 sm:p-5" aria-labelledby="s1">
          <div className="flex items-center justify-between">
            <h2 id="s1" className="text-base font-bold">
              1. Identificação
            </h2>
            {step > 0 ? edit(0) : null}
          </div>
          {step === 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="text-sm sm:col-span-2">
                {user.name} · <span className="text-fg-muted">{user.email}</span>
              </p>
              <Field label="CPF" required error={idErrors.cpf} hint={user.cpf ? "CPF cadastrado na sua conta" : "Necessário para a nota fiscal e o pagamento"}>
                <MaskedInput mask="cpf" defaultValue={cpf ? formatCpf(cpf) : ""} onChange={(e) => setCpf(e.target.value)} readOnly={Boolean(user.cpf)} placeholder="000.000.000-00" />
              </Field>
              <Field label="Celular" required error={idErrors.phone}>
                <MaskedInput mask="phone" defaultValue={phone ? formatPhone(phone) : ""} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </Field>
            </div>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">
              {user.name} · CPF {formatCpf(cpf)} · {formatPhone(phone)}
            </p>
          )}
        </section>

        {/* 2. Endereço */}
        <section className={cn("rounded-card border border-line bg-surface p-4 sm:p-5", step < 1 && "opacity-60")} aria-labelledby="s2">
          <div className="flex items-center justify-between">
            <h2 id="s2" className="text-base font-bold">
              2. Endereço de entrega
            </h2>
            {step > 1 ? edit(1) : null}
          </div>
          {step === 1 ? (
            <div className="mt-4 flex flex-col gap-3">
              {addresses.map((a) => (
                <RadioCard key={a.id} name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} label={`${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""}`} description={`${a.district}, ${a.city}/${a.state} · CEP ${formatCep(a.cep)} · ${a.recipientName}`} aside={a.label ? <span className="text-xs font-semibold text-fg-muted">{a.label}</span> : null} />
              ))}
              {addingAddress ? (
                <div className="rounded-card border border-dashed border-line-strong p-4">
                  <AddressForm
                    defaultName={user.name}
                    submitLabel="Salvar e usar este endereço"
                    onCancel={addresses.length ? () => setAddingAddress(false) : undefined}
                    onSaved={(id) => {
                      setAddingAddress(false);
                      setAddressId(id);
                      router.refresh();
                    }}
                  />
                </div>
              ) : (
                <Button variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setAddingAddress(true)} className="self-start">
                  Novo endereço
                </Button>
              )}
            </div>
          ) : step > 1 && address ? (
            <p className="mt-1 flex items-start gap-2 text-sm text-fg-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {address.street}, {address.number} — {address.city}/{address.state} · CEP {formatCep(address.cep)}
            </p>
          ) : null}
        </section>

        {/* 3. Entrega */}
        <section className={cn("rounded-card border border-line bg-surface p-4 sm:p-5", step < 2 && "opacity-60")} aria-labelledby="s3">
          <div className="flex items-center justify-between">
            <h2 id="s3" className="text-base font-bold">
              3. Entrega
            </h2>
            {step > 2 ? edit(2) : null}
          </div>
          {step === 2 ? (
            <div className="mt-4 flex flex-col gap-4">
              {!quotes ? <p className="text-sm text-fg-muted">Calculando frete para o seu CEP…</p> : null}
              {quotes?.map((q) => {
                const group = cart.groups.find((g) => g.store.id === q.storeId);
                return (
                  <fieldset key={q.storeId} className="flex flex-col gap-2">
                    <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Store className="size-4 text-brand-700" aria-hidden /> {q.isOfficial ? "Mercatto" : q.storeName}
                      <span className="font-normal text-fg-muted">({group?.lines.filter((l) => l.selected).length ?? 0} itens)</span>
                    </legend>
                    {q.error ? <Alert tone="danger">{q.error}</Alert> : null}
                    {q.options.map((o) => (
                      <RadioCard
                        key={o.id}
                        name={`ship-${q.storeId}`}
                        checked={selections[q.storeId] === o.id}
                        onChange={() => setSelections((s) => ({ ...s, [q.storeId]: o.id }))}
                        label={o.service}
                        description={o.isPickup ? `Retire em ${o.minDays} a ${o.maxDays} dias úteis` : `Chega em ${o.minDays} a ${o.maxDays} dias úteis${o.carrier ? ` · ${o.carrier}` : ""}`}
                        aside={o.priceCents === 0 ? <span className="text-sm font-bold text-success-700">{o.originalPriceCents > 0 ? <s className="mr-1 text-xs font-normal text-fg-subtle">{formatBRL(o.originalPriceCents)}</s> : null}Grátis</span> : <span className="text-sm font-bold tabular">{formatBRL(o.priceCents)}</span>}
                      />
                    ))}
                  </fieldset>
                );
              })}
            </div>
          ) : step > 2 && review ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
              <Truck className="size-4" aria-hidden /> {review.stores.map((s) => `${s.shipping.service} (${s.shipping.priceCents - s.shippingDiscountCents === 0 ? "grátis" : formatBRL(s.shipping.priceCents - s.shippingDiscountCents)})`).join(" · ")}
            </p>
          ) : null}
        </section>

        {/* 4. Pagamento */}
        <section className={cn("rounded-card border border-line bg-surface p-4 sm:p-5", step < 3 && "opacity-60")} aria-labelledby="s4">
          <div className="flex items-center justify-between">
            <h2 id="s4" className="text-base font-bold">
              4. Pagamento
            </h2>
            {step > 3 ? edit(3) : null}
          </div>
          {step === 3 ? (
            <div className="mt-4 flex flex-col gap-3">
              {gateway.supportsMethods.includes("PIX") ? (
                <RadioCard name="method" checked={method === "PIX"} onChange={() => setMethod("PIX")} label="PIX" description={`Aprovação na hora. O código vale por ${reservationMinutes} minutos.${pixDiscountPercent ? ` ${pixDiscountPercent}% de desconto.` : ""}`} aside={<QrCode className="size-5 text-brand-700" aria-hidden />} />
              ) : null}
              {gateway.supportsMethods.includes("CREDIT_CARD") ? (
                <RadioCard name="method" checked={method === "CREDIT_CARD"} onChange={() => setMethod("CREDIT_CARD")} label="Cartão de crédito" description={`Em até ${installmentConfig.interestFreeInstallments}x sem juros`} aside={<CreditCard className="size-5 text-brand-700" aria-hidden />} />
              ) : null}
              {method === "CREDIT_CARD" ? (
                <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-muted p-4">
                  <CardTokenizer gateway={gateway.name} publicKey={gateway.publicKey} amountCents={estimatedTotal} onToken={setCard} />
                  <Field label="Parcelamento">
                    <Select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                      {installmentList.map((o) => (
                        <option key={o.count} value={o.count}>
                          {o.count}x de {formatBRL(o.installmentCents)} {o.interestFree ? "sem juros" : `(total ${formatBRL(o.totalCents)})`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : null}
            </div>
          ) : step > 3 ? (
            <p className="mt-1 text-sm text-fg-muted">{method === "PIX" ? "PIX" : `Cartão ${card?.label ?? ""} · ${installments}x`}</p>
          ) : null}
        </section>

        {/* 5. Revisão */}
        {step === 4 ? (
          <section className="rounded-card border border-brand-300 bg-surface p-4 sm:p-5" aria-labelledby="s5">
            <h2 id="s5" className="text-base font-bold">
              5. Revise e confirme
            </h2>
            {review ? (
              <ul className="mt-3 flex flex-col gap-4">
                {review.stores.map((s) => (
                  <li key={s.storeId} className="rounded-card border border-line">
                    <p className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
                      <Store className="size-4 text-brand-700" aria-hidden /> {s.isOfficial ? "Mercatto" : s.storeName}
                      <span className="ml-auto text-xs font-normal text-fg-muted">
                        {s.shipping.service} · até {s.shipping.maxDays} dias úteis
                      </span>
                    </p>
                    <ul className="divide-y divide-line">
                      {s.lines.map((l) => (
                        <li key={l.variantId} className="flex items-center gap-3 px-3 py-2">
                          <ProductImage src={l.imageUrl} alt={l.productName} className="size-12 shrink-0 rounded-md border border-line" sizes="48px" />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="line-clamp-1">{l.productName}</span>
                            <span className="text-xs text-fg-muted">
                              {l.variantName !== "Padrão" ? `${l.variantName} · ` : ""}
                              {l.quantity}x {formatBRL(l.unitPriceCents)}
                            </span>
                          </span>
                          <span className="text-sm font-semibold tabular">{formatBRL(l.lineTotalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">Calculando valores finais…</p>
            )}
            <Field label="Observação para o vendedor (opcional)" className="mt-4">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-16" />
            </Field>
            <p className="mt-3 text-xs text-fg-muted">
              Ao confirmar, você concorda com os <a href="/termos" target="_blank" className="font-semibold text-brand-700 underline">Termos de uso</a> e reconhece a <a href="/privacidade" target="_blank" className="font-semibold text-brand-700 underline">Política de privacidade</a>. Os itens ficam reservados por {reservationMinutes} minutos aguardando o pagamento.
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          ) : (
            <ButtonLink href="/carrinho" variant="ghost">
              Voltar ao carrinho
            </ButtonLink>
          )}
          {step < 4 ? (
            <Button size="lg" onClick={next} loading={pending && step === 2 && !quotes}>
              Continuar
            </Button>
          ) : (
            <Button size="lg" onClick={placeOrder} loading={pending} loadingText="Finalizando…" disabled={!review} leftIcon={<Lock className="size-4" />}>
              {method === "PIX" ? "Gerar PIX e finalizar" : "Pagar e finalizar"}
            </Button>
          )}
        </div>
      </div>

      {/* Resumo permanente */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="text-base font-bold">Resumo</h2>
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {cart.groups.flatMap((g) => g.lines.filter((l) => l.selected && l.status === "OK")).map((l) => (
              <li key={l.itemId} className="flex items-center gap-2 text-sm">
                <ProductImage src={l.imageUrl} alt={l.productName} className="size-10 shrink-0 rounded-md border border-line" sizes="40px" />
                <span className="line-clamp-1 min-w-0 flex-1">{l.productName}</span>
                <span className="text-xs text-fg-muted">x{l.quantity}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Produtos</dt>
              <dd className="tabular">{formatBRL(review?.totals.subtotalCents ?? cart.totals.subtotalCents)}</dd>
            </div>
            {(review?.totals.couponDiscountCents ?? cart.totals.couponDiscountCents) > 0 ? (
              <div className="flex justify-between text-success-700">
                <dt>Cupom {review?.coupon?.code ?? cart.coupon?.code}</dt>
                <dd className="tabular">-{formatBRL(review?.totals.couponDiscountCents ?? cart.totals.couponDiscountCents)}</dd>
              </div>
            ) : null}
            {review && review.totals.pixDiscountCents > 0 ? (
              <div className="flex justify-between text-success-700">
                <dt>Desconto PIX</dt>
                <dd className="tabular">-{formatBRL(review.totals.pixDiscountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-fg-muted">Frete</dt>
              <dd className="tabular">{review ? (review.totals.shippingCents === 0 ? <span className="font-semibold text-success-700">Grátis</span> : formatBRL(review.totals.shippingCents)) : "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2.5">
              <dt className="font-bold">Total</dt>
              <dd className="text-xl font-extrabold tabular">{formatBRL(review?.totals.totalCents ?? cart.totals.totalCents)}</dd>
            </div>
            {method === "CREDIT_CARD" && review && review.installments.count > 1 ? (
              <p className="text-right text-xs text-fg-muted">
                {review.installments.count}x de {formatBRL(review.installments.installmentCents)} {review.installments.interestFree ? "sem juros" : `(total ${formatBRL(review.installments.totalCents)})`}
              </p>
            ) : null}
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-fg-muted">
            <ShieldCheck className="size-4 text-brand-700" aria-hidden /> Valores recalculados e validados pelo servidor.
          </p>
          {gateway.isSandbox ? (
            <p className="flex items-center gap-1.5 text-xs text-warning-700">
              <FlaskConical className="size-4" aria-hidden /> Pagamento de teste (nenhuma cobrança real).
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
