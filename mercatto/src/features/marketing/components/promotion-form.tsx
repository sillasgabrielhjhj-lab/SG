"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Ban, Copy, Info, Layers } from "lucide-react";
import { formatBRL, discountPercent } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { parseLocalDateTime, toLocalInputValue } from "@/lib/dates";
import { applyPromotion } from "@/features/pricing/engine";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/masked-input";
import { RadioCard, Switch } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  adminCancelPromotionAction,
  adminCreatePromotionAction,
  adminUpdatePromotionAction,
  sellerCancelPromotionAction,
  sellerCreatePromotionAction,
  sellerUpdatePromotionAction,
} from "@/features/marketing/actions";
import { FlashBadge, FormErrorBox, FormSection, PROMOTION_STATE, PROMOTION_TYPE, StateBadge, formatPromotionValue, normalizeFieldErrors, type MarketingMode, type PromotionKind, type PromotionState } from "@/features/marketing/components/marketing-ui";
import { CategoryMultiSelect, ProductPicker, type CategoryOption, type PickedProduct } from "@/features/marketing/components/target-pickers";

export type PromotionFormInitial = {
  name: string;
  type: PromotionKind;
  value: number | null;
  isFlash: boolean;
  startsAt: string;
  endsAt: string;
  products: PickedProduct[];
  categoryIds: string[];
  stockLimit: number | null;
  perCustomerLimit: number | null;
  priority: number;
  campaignId: string | null;
};

const DURATIONS = [
  { label: "6 horas", hours: 6 },
  { label: "24 horas", hours: 24 },
  { label: "3 dias", hours: 72 },
  { label: "7 dias", hours: 168 },
  { label: "30 dias", hours: 720 },
];

const NO_STACKING = "Promoções não se acumulam: vale o maior desconto por item.";

/** Formulário de promoção (vendedor ou admin). Os limites de escopo são aplicados pelo servidor. */
export function PromotionForm({
  mode,
  basePath,
  promotionId,
  initial,
  categories,
  campaigns,
  state,
  soldCount = 0,
  readOnlyReason,
  storeName,
  allowDuplicate = true,
}: {
  mode: MarketingMode;
  basePath: string;
  promotionId?: string;
  initial: PromotionFormInitial;
  categories: CategoryOption[];
  campaigns?: { id: string; name: string }[];
  state?: PromotionState;
  soldCount?: number;
  readOnlyReason?: string;
  storeName?: string | null;
  allowDuplicate?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [s, setS] = useState(() => ({
    name: initial.name,
    type: initial.type,
    percent: initial.type === "PERCENT_OFF" && initial.value ? String(initial.value) : "",
    cents: initial.type !== "PERCENT_OFF" ? initial.value : null,
    isFlash: initial.isFlash,
    startsAt: initial.startsAt,
    endsAt: initial.endsAt,
    categoryIds: initial.categoryIds,
    stockLimit: initial.stockLimit?.toString() ?? "",
    perCustomerLimit: initial.perCustomerLimit?.toString() ?? "",
    priority: initial.priority ? String(initial.priority) : "",
    campaignId: initial.campaignId ?? "",
  }));
  const [products, setProducts] = useState<PickedProduct[]>(initial.products);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (path: string) => errors[path]?.[0];

  const readOnly = Boolean(readOnlyReason);
  const canCancel = Boolean(promotionId) && (state === "ACTIVE" || state === "SCHEDULED");
  const value = s.type === "PERCENT_OFF" ? Number(s.percent) || 0 : (s.cents ?? 0);

  // Prévia ao vivo: primeiro produto selecionado ou exemplo de R$ 100,00.
  const sample = products[0];
  const base = sample?.minPriceCents ?? 10_000;
  const final = value > 0 ? applyPromotion(base, { type: s.type, value }) : base;
  const invalidFor = s.type !== "PERCENT_OFF" && value > 0 ? products.filter((p) => value >= p.minPriceCents) : [];
  const preview =
    value <= 0
      ? "Informe o valor para ver a prévia."
      : s.type !== "PERCENT_OFF" && value >= base
        ? `${s.type === "FIXED_PRICE" ? "O preço promocional" : "O desconto"} precisa ser menor que ${formatBRL(base)}${sample ? ` (preço de “${sample.name}”)` : ""}.`
        : `${sample ? `“${sample.name}”` : "Um produto"} de ${formatBRL(base)} sai por ${formatBRL(final)} (−${discountPercent(base, final)}%).`;

  const setDuration = (hours: number) => {
    const from = parseLocalDateTime(s.startsAt) ?? new Date();
    set("endsAt", toLocalInputValue(new Date(from.getTime() + hours * 3600_000)));
  };

  const toInput = () => ({
    name: s.name,
    type: s.type,
    value: s.type === "PERCENT_OFF" ? s.percent : (s.cents ?? ""),
    isFlash: s.isFlash,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    productIds: products.map((p) => p.id),
    categoryIds: s.categoryIds,
    stockLimit: s.stockLimit,
    perCustomerLimit: s.perCustomerLimit,
    priority: mode === "admin" ? s.priority : undefined,
    campaignId: mode === "admin" ? s.campaignId : undefined,
  });

  const save = () =>
    start(async () => {
      setFormError(null);
      const input = toInput();
      const res =
        mode === "seller"
          ? promotionId
            ? await sellerUpdatePromotionAction({ id: promotionId, input })
            : await sellerCreatePromotionAction(input)
          : promotionId
            ? await adminUpdatePromotionAction({ id: promotionId, input })
            : await adminCreatePromotionAction(input);
      if (!res.ok) {
        setErrors(normalizeFieldErrors(res.fieldErrors));
        setFormError(res.error);
        toast.error(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Promoção salva.");
      if (!promotionId) router.replace(basePath);
      else router.refresh();
    });

  const cancel = () =>
    start(async () => {
      if (!promotionId) return;
      const res = mode === "seller" ? await sellerCancelPromotionAction({ id: promotionId }) : await adminCancelPromotionAction({ id: promotionId });
      if (!res.ok) return toast.error(res.error);
      toast.success(res.message ?? "Promoção encerrada.");
      setConfirmCancel(false);
      router.refresh();
    });

  const startDate = parseLocalDateTime(s.startsAt);
  const endDate = parseLocalDateTime(s.endsAt);
  const targets = [products.length ? `${products.length} produto(s)` : null, s.categoryIds.length ? `${s.categoryIds.length} categoria(s)` : null].filter(Boolean).join(" + ") || "Nenhum produto selecionado";

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Promoções
          </Link>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight break-words sm:text-2xl">{promotionId ? initial.name : "Nova promoção"}</h1>
          {promotionId ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
              {state ? <StateBadge meta={PROMOTION_STATE[state]} /> : null}
              {initial.isFlash ? <FlashBadge size="sm" /> : null}
              {storeName ? <span>Loja: {storeName}</span> : null}
              {soldCount > 0 ? <span>· {soldCount} unidade(s) vendida(s) com esta promoção</span> : null}
            </p>
          ) : null}
        </div>
        {promotionId ? (
          <div className="flex flex-wrap gap-2">
            {allowDuplicate ? (
              <ButtonLink href={`${basePath}/nova?copiar=${promotionId}`} variant="outline" size="sm" leftIcon={<Copy className="size-4" />}>
                Duplicar
              </ButtonLink>
            ) : null}
            {canCancel ? (
              <Button variant="outline" size="sm" className="text-danger-700 hover:border-danger-600 hover:text-danger-700" leftIcon={<Ban className="size-4" />} onClick={() => setConfirmCancel(true)}>
                Encerrar promoção
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {readOnlyReason ? <Alert tone="warning" title="Somente leitura">{readOnlyReason}</Alert> : null}
      <FormErrorBox message={formError} errors={errors} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={readOnly || pending} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Dados da promoção</legend>
          <FormSection id="desconto" title="Desconto">
            <div className="grid gap-4">
              <Field label="Nome da promoção" required error={err("name")} hint="Uso interno e exibido em selos da oferta. Ex.: Semana do Notebook">
                <Input value={s.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-fg">Tipo de desconto</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(PROMOTION_TYPE) as PromotionKind[]).map((t) => (
                    <RadioCard key={t} name="promotion-type" value={t} checked={s.type === t} onChange={() => set("type", t)} label={PROMOTION_TYPE[t].label} description={PROMOTION_TYPE[t].description} />
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                {s.type === "PERCENT_OFF" ? (
                  <Field label="Percentual de desconto" required error={err("value")} hint="Entre 1% e 90%">
                    <Input type="number" inputMode="numeric" min={1} max={90} step={1} value={s.percent} trailing={<span className="pr-1 text-sm font-medium text-fg-muted">%</span>} onChange={(e) => set("percent", e.target.value)} />
                  </Field>
                ) : (
                  <Field label={s.type === "FIXED_PRICE" ? "Preço promocional" : "Valor do desconto"} required error={err("value")} hint={s.type === "FIXED_PRICE" ? "Deve ser menor que o preço atual de cada produto" : "Deve ser menor que o preço de cada produto"}>
                    <PriceInput key={s.type} defaultCents={s.cents} onCentsChange={(c) => set("cents", c)} />
                  </Field>
                )}
                <div className="flex flex-col justify-end">
                  <p className="rounded-field bg-brand-50 px-3 py-2.5 text-sm text-brand-900" aria-live="polite">
                    <span className="font-semibold">Prévia: </span>
                    {preview}
                  </p>
                </div>
              </div>
              {invalidFor.length ? (
                <Alert tone="warning" title="Valor maior que o preço de alguns produtos">
                  {invalidFor
                    .slice(0, 3)
                    .map((p) => `${p.name} (${formatBRL(p.minPriceCents)})`)
                    .join(", ")}
                  {invalidFor.length > 3 ? ` e mais ${invalidFor.length - 3}` : ""}. Ajuste o valor ou remova esses produtos.
                </Alert>
              ) : null}
              <p className="flex items-start gap-2 text-xs text-fg-muted">
                <Layers className="mt-px size-4 shrink-0 text-brand-700" aria-hidden />
                {NO_STACKING} Se um produto estiver em mais de uma promoção, o cliente paga o menor preço.
              </p>
              <Switch
                checked={s.isFlash}
                onChange={(e) => set("isFlash", e.target.checked)}
                label="Oferta relâmpago"
                description="Destaque com contagem regressiva na página de ofertas. Exige produtos específicos (não vale só por categoria)."
                className="rounded-md border border-line p-3"
              />
            </div>
          </FormSection>

          <FormSection id="periodo" title="Período" description="Horário de Brasília. A promoção entra e sai do ar automaticamente.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início" required error={err("startsAt")}>
                <Input type="datetime-local" value={s.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Término" required error={err("endsAt")}>
                <Input type="datetime-local" value={s.endsAt} min={s.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Duração rápida">
              <span className="text-xs font-medium text-fg-muted">Duração:</span>
              {DURATIONS.map((d) => (
                <button key={d.hours} type="button" onClick={() => setDuration(d.hours)} className="h-8 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-fg-muted hover:border-brand-400 hover:text-brand-800 focus-ring disabled:opacity-50">
                  {d.label}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection id="produtos" title="Produtos participantes" description="Escolha produtos específicos, categorias inteiras ou ambos.">
            <div className="grid gap-5">
              <ProductPicker mode={mode} value={products} onChange={setProducts} disabled={readOnly || pending} label="Produtos" error={err("productIds")} hint={mode === "seller" ? "Somente produtos da sua loja." : "Produtos de qualquer loja. Promoções da plataforma são custeadas pela Mercatto."} />
              <CategoryMultiSelect options={categories} value={s.categoryIds} onChange={(v) => set("categoryIds", v)} disabled={readOnly || pending} label="Categorias (opcional)" hint={mode === "seller" ? "Aplica a todos os produtos da sua loja nessas categorias (e subcategorias)." : "Aplica a todos os produtos dessas categorias (e subcategorias)."} error={err("categoryIds")} />
            </div>
          </FormSection>

          <FormSection id="limites" title="Limites" description="Opcional. Deixe em branco para não limitar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estoque promocional" error={err("stockLimit")} hint={soldCount > 0 ? `Total de unidades com desconto. Já vendidas: ${soldCount}.` : "Total de unidades vendidas com o desconto. Depois disso, volta o preço normal."}>
                <Input type="number" inputMode="numeric" min={Math.max(1, soldCount)} value={s.stockLimit} onChange={(e) => set("stockLimit", e.target.value)} />
              </Field>
              <Field label="Limite por cliente" error={err("perCustomerLimit")} hint="Unidades por cliente com o preço promocional">
                <Input type="number" inputMode="numeric" min={1} max={1000} value={s.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} />
              </Field>
              {mode === "admin" ? (
                <>
                  <Field label="Prioridade" error={err("priority")} hint="0 a 100. Em empate de desconto, vence a maior prioridade.">
                    <Input type="number" inputMode="numeric" min={0} max={100} value={s.priority} onChange={(e) => set("priority", e.target.value)} />
                  </Field>
                  <Field label="Campanha" error={err("campaignId")} hint="Vincula a promoção à página da campanha">
                    <Select value={s.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
                      <option value="">Sem campanha</option>
                      {(campaigns ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              ) : null}
            </div>
          </FormSection>
        </fieldset>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <section aria-labelledby="resumo-promo" className="rounded-card border border-line bg-surface p-4">
            <h2 id="resumo-promo" className="mb-3 font-bold">
              Resumo
            </h2>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Desconto</dt>
                <dd className="font-semibold">{value > 0 ? formatPromotionValue(s.type, value) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Período</dt>
                <dd>{startDate && endDate ? `${formatDateTime(startDate)} → ${formatDateTime(endDate)}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Participantes</dt>
                <dd>{targets}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 rounded-md bg-surface-muted p-2.5 text-xs text-fg-muted">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden /> {NO_STACKING}
            </p>
            {!readOnly ? (
              <Button className="mt-4 hidden xl:inline-flex" fullWidth loading={pending} onClick={save}>
                {promotionId ? "Salvar alterações" : "Criar promoção"}
              </Button>
            ) : null}
          </section>
        </aside>
      </div>

      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur xl:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-3xl gap-2">
            <ButtonLink href={basePath} variant="outline" className="flex-1">
              Voltar
            </ButtonLink>
            <Button onClick={save} loading={pending} className="flex-1">
              {promotionId ? "Salvar" : "Criar promoção"}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Encerrar promoção?"
        description="Os preços voltam ao normal imediatamente e a promoção não poderá ser reativada (você pode duplicá-la depois)."
        confirmLabel="Encerrar promoção"
        loading={pending}
        onConfirm={cancel}
      />
    </div>
  );
}
