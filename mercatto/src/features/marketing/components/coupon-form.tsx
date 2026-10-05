"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Power, Shuffle } from "lucide-react";
import { formatBRL, percentOf } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/masked-input";
import { Checkbox, RadioCard, Switch } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { adminCreateCouponAction, adminToggleCouponAction, adminUpdateCouponAction, sellerCreateCouponAction, sellerToggleCouponAction, sellerUpdateCouponAction } from "@/features/marketing/actions";
import { COUPON_STATE, COUPON_TYPE, FormErrorBox, FormSection, StateBadge, formatCouponValue, normalizeFieldErrors, type CouponKind, type CouponState, type MarketingMode } from "@/features/marketing/components/marketing-ui";
import { CategoryMultiSelect, ProductPicker, type CategoryOption, type PickedProduct } from "@/features/marketing/components/target-pickers";

export type CouponFormInitial = {
  code: string;
  description: string;
  type: CouponKind;
  value: number | null;
  maxDiscountCents: number | null;
  minOrderCents: number;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  firstPurchaseOnly: boolean;
  stackWithPromotions: boolean;
  products: PickedProduct[];
  categoryIds: string[];
  isActive: boolean;
  isPublic: boolean;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(prefix: string) {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}${suffix}`.slice(0, 30);
}

/** Formulário de cupom (vendedor ou admin). */
export function CouponForm({
  mode,
  basePath,
  couponId,
  initial,
  categories,
  state,
  usedCount = 0,
  readOnlyReason,
  storeName,
}: {
  mode: MarketingMode;
  basePath: string;
  couponId?: string;
  initial: CouponFormInitial;
  categories: CategoryOption[];
  state?: CouponState;
  usedCount?: number;
  readOnlyReason?: string;
  storeName?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [s, setS] = useState(() => ({
    code: initial.code,
    description: initial.description,
    type: initial.type,
    percent: initial.type === "PERCENT" && initial.value ? String(initial.value) : "",
    cents: initial.type === "FIXED" ? initial.value : null,
    maxDiscountCents: initial.maxDiscountCents,
    minOrderCents: initial.minOrderCents || null,
    startsAt: initial.startsAt,
    endsAt: initial.endsAt,
    usageLimit: initial.usageLimit?.toString() ?? "",
    usageLimitPerUser: initial.usageLimitPerUser?.toString() ?? "",
    firstPurchaseOnly: initial.firstPurchaseOnly,
    stackWithPromotions: initial.stackWithPromotions,
    categoryIds: initial.categoryIds,
    isActive: initial.isActive,
    isPublic: initial.isPublic,
  }));
  const [products, setProducts] = useState<PickedProduct[]>(initial.products);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (path: string) => errors[path]?.[0];
  const readOnly = Boolean(readOnlyReason);

  const value = s.type === "PERCENT" ? Number(s.percent) || 0 : s.type === "FIXED" ? (s.cents ?? 0) : 0;
  const sampleOrder = Math.max(s.minOrderCents ?? 0, 20_000);
  const saving = s.type === "PERCENT" ? Math.min(percentOf(sampleOrder, Math.min(value, 100)), s.maxDiscountCents ?? Infinity) : Math.min(value, sampleOrder);
  const preview =
    s.type === "FREE_SHIPPING"
      ? `O frete ${mode === "seller" ? "da sua loja " : ""}sai grátis${s.minOrderCents ? ` em pedidos a partir de ${formatBRL(s.minOrderCents)}` : ""}.`
      : value <= 0
        ? "Informe o valor para ver a prévia."
        : `Num pedido de ${formatBRL(sampleOrder)}, o cliente economiza ${formatBRL(saving)}.`;

  const toInput = () => ({
    code: s.code,
    description: s.description,
    type: s.type,
    value: s.type === "PERCENT" ? s.percent : s.type === "FIXED" ? (s.cents ?? "") : 0,
    maxDiscountCents: s.type === "PERCENT" ? (s.maxDiscountCents ?? "") : "",
    minOrderCents: s.minOrderCents ?? 0,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    usageLimit: s.usageLimit,
    usageLimitPerUser: s.usageLimitPerUser,
    firstPurchaseOnly: mode === "admin" ? s.firstPurchaseOnly : false,
    stackWithPromotions: s.stackWithPromotions,
    productIds: products.map((p) => p.id),
    categoryIds: s.categoryIds,
    isActive: s.isActive,
    isPublic: s.isPublic,
  });

  const save = () =>
    start(async () => {
      setFormError(null);
      const input = toInput();
      const res =
        mode === "seller"
          ? couponId
            ? await sellerUpdateCouponAction({ id: couponId, input })
            : await sellerCreateCouponAction(input)
          : couponId
            ? await adminUpdateCouponAction({ id: couponId, input })
            : await adminCreateCouponAction(input);
      if (!res.ok) {
        const fieldErrors = normalizeFieldErrors(res.fieldErrors);
        if (res.code === "CONFLICT" && !fieldErrors.code) fieldErrors.code = [res.error];
        setErrors(fieldErrors);
        setFormError(res.error);
        toast.error(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Cupom salvo.");
      if (!couponId) router.replace(basePath);
      else router.refresh();
    });

  /** Ativar/desativar direto (usado no modo leitura do admin para cupons de lojas). */
  const toggle = () =>
    start(async () => {
      if (!couponId) return;
      const next = !s.isActive;
      const res = mode === "seller" ? await sellerToggleCouponAction({ id: couponId, isActive: next }) : await adminToggleCouponAction({ id: couponId, isActive: next });
      if (!res.ok) return toast.error(res.error);
      set("isActive", next);
      toast.success(res.message ?? "Pronto.");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Cupons
          </Link>
          <h1 className="mt-1 font-mono text-xl font-extrabold tracking-tight break-all sm:text-2xl">{couponId ? initial.code : <span className="font-sans">Novo cupom</span>}</h1>
          {couponId ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
              {state ? <StateBadge meta={COUPON_STATE[state]} /> : null}
              <span>
                {usedCount} uso(s){initial.usageLimit ? ` de ${initial.usageLimit}` : ""}
              </span>
              {storeName ? <span>· Loja: {storeName}</span> : null}
            </p>
          ) : null}
        </div>
        {couponId ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton value={initial.code} variant="outline" size="sm" label="Copiar código" />
            {readOnly ? (
              <Button variant="outline" size="sm" leftIcon={<Power className="size-4" />} loading={pending} onClick={toggle}>
                {s.isActive ? "Desativar cupom" : "Ativar cupom"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {readOnlyReason ? <Alert tone="warning" title="Somente leitura">{readOnlyReason}</Alert> : null}
      <FormErrorBox message={formError} errors={errors} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={readOnly || pending} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Dados do cupom</legend>
          <FormSection id="cupom" title="Cupom">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Código"
                required
                error={err("code")}
                hint="Letras, números, hífen ou sublinhado (3 a 30). O cliente digita no carrinho."
                labelAction={
                  !readOnly ? (
                    <button type="button" onClick={() => set("code", randomCode(mode === "seller" ? "LOJA" : "MERCATTO"))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline focus-ring">
                      <Shuffle className="size-3.5" aria-hidden /> Gerar código
                    </button>
                  ) : null
                }
              >
                <Input value={s.code} maxLength={30} autoComplete="off" spellCheck={false} className="font-mono uppercase" onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} />
              </Field>
              <Field label="Descrição" error={err("description")} hint="Exibida ao cliente. Ex.: 15% OFF em notebooks">
                <Input value={s.description} maxLength={200} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium text-fg">Tipo de cupom</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(COUPON_TYPE) as CouponKind[]).map((t) => (
                    <RadioCard key={t} name="coupon-type" value={t} checked={s.type === t} onChange={() => set("type", t)} label={COUPON_TYPE[t].label} description={COUPON_TYPE[t].description} />
                  ))}
                </div>
              </fieldset>
              {s.type === "PERCENT" ? (
                <>
                  <Field label="Percentual de desconto" required error={err("value")} hint="Entre 1% e 100%">
                    <Input type="number" inputMode="numeric" min={1} max={100} step={1} value={s.percent} trailing={<span className="pr-1 text-sm font-medium text-fg-muted">%</span>} onChange={(e) => set("percent", e.target.value)} />
                  </Field>
                  <Field label="Desconto máximo" error={err("maxDiscountCents")} hint="Teto em R$ (opcional)">
                    <PriceInput defaultCents={s.maxDiscountCents} onCentsChange={(c) => set("maxDiscountCents", c)} />
                  </Field>
                </>
              ) : s.type === "FIXED" ? (
                <Field label="Valor do desconto" required error={err("value")} hint="Não pode ser maior que o pedido mínimo">
                  <PriceInput defaultCents={s.cents} onCentsChange={(c) => set("cents", c)} />
                </Field>
              ) : null}
              <Field label="Pedido mínimo" error={err("minOrderCents")} hint="Subtotal elegível mínimo (opcional)">
                <PriceInput defaultCents={s.minOrderCents} onCentsChange={(c) => set("minOrderCents", c)} />
              </Field>
              <p className="rounded-field bg-brand-50 px-3 py-2.5 text-sm text-brand-900 sm:col-span-2" aria-live="polite">
                <span className="font-semibold">Prévia: </span>
                {preview}
              </p>
            </div>
          </FormSection>

          <FormSection id="validade" title="Validade e limites" description="Horário de Brasília. Deixe em branco para não limitar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início" error={err("startsAt")}>
                <Input type="datetime-local" value={s.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Término" error={err("endsAt")}>
                <Input type="datetime-local" value={s.endsAt} min={s.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
              <Field label="Limite total de usos" error={err("usageLimit")} hint={usedCount ? `Já usado ${usedCount} vez(es).` : "Quantas vezes o cupom pode ser usado no total"}>
                <Input type="number" inputMode="numeric" min={Math.max(1, usedCount)} value={s.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />
              </Field>
              <Field label="Usos por cliente" error={err("usageLimitPerUser")} hint="Vazio = ilimitado por cliente">
                <Input type="number" inputMode="numeric" min={1} max={1000} value={s.usageLimitPerUser} onChange={(e) => set("usageLimitPerUser", e.target.value)} />
              </Field>
            </div>
          </FormSection>

          <FormSection id="regras" title="Onde vale" description={mode === "seller" ? "Sem produtos ou categorias selecionados, vale para toda a sua loja." : "Sem produtos ou categorias selecionados, vale para todo o marketplace."}>
            <div className="grid gap-5">
              <ProductPicker mode={mode} value={products} onChange={setProducts} disabled={readOnly || pending} label="Produtos (opcional)" error={err("productIds")} />
              <CategoryMultiSelect options={categories} value={s.categoryIds} onChange={(v) => set("categoryIds", v)} disabled={readOnly || pending} label="Categorias (opcional)" error={err("categoryIds")} />
              <div className="grid gap-3">
                <Checkbox checked={s.stackWithPromotions} onChange={(e) => set("stackWithPromotions", e.target.checked)} label="Acumular com promoções" description="Por padrão o cupom não se aplica a itens que já estão em promoção." />
                {mode === "admin" ? <Checkbox checked={s.firstPurchaseOnly} onChange={(e) => set("firstPurchaseOnly", e.target.checked)} label="Somente primeira compra" description="Válido apenas para clientes sem pedidos pagos." /> : null}
              </div>
            </div>
          </FormSection>
        </fieldset>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <fieldset disabled={readOnly || pending} className="rounded-card border border-line bg-surface p-4">
            <legend className="sr-only">Publicação</legend>
            <h2 className="mb-3 font-bold">Publicação</h2>
            <div className="grid gap-3">
              <Switch checked={s.isActive} onChange={(e) => set("isActive", e.target.checked)} label="Cupom ativo" description="Desative para pausar sem apagar." />
              <Checkbox checked={s.isPublic} onChange={(e) => set("isPublic", e.target.checked)} label="Divulgar aos clientes" description="Aparece em “Meus cupons” na área do cliente." />
            </div>
            <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Benefício</dt>
                <dd className="font-semibold">{s.type === "FREE_SHIPPING" || value > 0 ? formatCouponValue(s.type, value, s.type === "PERCENT" ? s.maxDiscountCents : null) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Pedido mínimo</dt>
                <dd>{s.minOrderCents ? formatBRL(s.minOrderCents) : "Sem mínimo"}</dd>
              </div>
            </dl>
            {!readOnly ? (
              <Button className="mt-4 hidden xl:inline-flex" fullWidth loading={pending} onClick={save}>
                {couponId ? "Salvar alterações" : "Criar cupom"}
              </Button>
            ) : null}
          </fieldset>
        </aside>
      </div>

      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur xl:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-3xl gap-2">
            <ButtonLink href={basePath} variant="outline" className="flex-1">
              Voltar
            </ButtonLink>
            <Button onClick={save} loading={pending} className="flex-1">
              {couponId ? "Salvar" : "Criar cupom"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
