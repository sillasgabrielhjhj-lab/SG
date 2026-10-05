"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/masked-input";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { uploadImages } from "@/features/media/client-upload";
import { adminCreateProductAction, adminUpdateProductAction, sellerCreateProductAction, sellerUpdateProductAction } from "@/features/products/actions";
import type { ProductInput } from "@/features/products/schemas";

type Attr = { id: string; categoryId: string; name: string; key: string; type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"; options: string[]; unit: string | null; isRequired: boolean };
export type EditorOptions = { categories: { id: string; name: string; depth: number; path: string }[]; brands: { id: string; name: string }[]; attributesByCategory: Record<string, Attr[]> };

type ImageState = { id?: string; url: string; storageKey?: string | null; alt: string; width?: number | null; height?: number | null };
type VariantState = {
  id?: string;
  sku: string;
  gtin: string;
  optionValues: Record<string, string>;
  priceCents: number | null;
  compareAtPriceCents: number | null;
  costCents: number | null;
  stock: string;
  stockBaseline?: number;
  minStock: string;
  imageIndex: number | null;
  status: "ACTIVE" | "INACTIVE";
};
type OptionState = { name: string; values: string[] };

export type EditorInitial = {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  categoryId: string;
  brandId: string | null;
  condition: "NEW" | "USED" | "REFURBISHED";
  status: "DRAFT" | "ACTIVE" | "PAUSED";
  sku: string;
  gtin?: string;
  tags: string[];
  warrantyMonths: number | null;
  warrantyText: string | null;
  includedItems: string[];
  specifications: { group: string; items: { name: string; value: string }[] }[];
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  freeShipping: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  isFeatured: boolean;
  attributes: { attributeId: string; value: string }[];
  images: { id?: string; url: string; storageKey?: string | null; alt?: string | null; width?: number | null; height?: number | null }[];
  options: OptionState[];
  variants: { id?: string; sku: string; gtin?: string; optionValues: Record<string, string>; priceCents: number; compareAtPriceCents: number | null; costCents: number | null; stock: number; stockBaseline?: number; minStock: number; imageIndex: number | null; status: "ACTIVE" | "INACTIVE" }[];
};

const comboKey = (options: OptionState[], values: Record<string, string>) => options.map((o) => values[o.name] ?? "").join("|");

function cartesian(options: OptionState[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.name]: v }))), [{}]);
}

function blankVariant(sku: string, base?: VariantState): VariantState {
  return { sku, gtin: "", optionValues: {}, priceCents: base?.priceCents ?? null, compareAtPriceCents: base?.compareAtPriceCents ?? null, costCents: base?.costCents ?? null, stock: "0", minStock: base?.minStock ?? "0", imageIndex: null, status: "ACTIVE" };
}

/** Card de seção do editor. */
function Section({ id, title, description, children, aside }: { id: string; title: string; description?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${id}-t`} className="font-bold">
            {title}
          </h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Campo de lista de valores (chips): Enter ou vírgula adiciona. */
function ChipsInput({ values, onChange, placeholder, max = 30, ariaLabel }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; ariaLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...values];
    for (const item of items) if (!next.some((v) => v.toLowerCase() === item.toLowerCase()) && next.length < max) next.push(item.slice(0, 40));
    onChange(next);
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-field border border-line-strong bg-surface px-2 py-1.5 focus-within:border-brand-600 focus-within:shadow-focus">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-sm font-medium text-brand-900">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full hover:bg-brand-100 focus-ring" aria-label={`Remover ${v}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={values.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
      />
    </div>
  );
}

export function ProductEditor({ mode, options, productId, initial, storeName, backHref, publicSlug }: { mode: "seller" | "admin"; options: EditorOptions; productId?: string; initial?: EditorInitial; storeName: string; backHref: string; publicSlug?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const fileRef = useRef<HTMLInputElement>(null);

  const [s, setS] = useState(() => ({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    shortDescription: initial?.shortDescription ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    brandId: initial?.brandId ?? "",
    condition: initial?.condition ?? ("NEW" as const),
    status: initial?.status ?? ("DRAFT" as const),
    sku: initial?.sku ?? "",
    gtin: initial?.gtin ?? "",
    tags: initial?.tags ?? [],
    warrantyMonths: initial?.warrantyMonths?.toString() ?? "",
    warrantyText: initial?.warrantyText ?? "",
    includedItems: initial?.includedItems ?? [],
    specifications: initial?.specifications ?? [],
    weightGrams: initial?.weightGrams?.toString() ?? "",
    heightCm: initial?.heightCm?.toString() ?? "",
    widthCm: initial?.widthCm?.toString() ?? "",
    lengthCm: initial?.lengthCm?.toString() ?? "",
    freeShipping: initial?.freeShipping ?? false,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
    isFeatured: initial?.isFeatured ?? false,
    attributes: Object.fromEntries((initial?.attributes ?? []).map((a) => [a.attributeId, a.value])) as Record<string, string>,
  }));
  const [images, setImages] = useState<ImageState[]>(() => (initial?.images ?? []).map((i) => ({ ...i, alt: i.alt ?? "" })));
  const [opts, setOpts] = useState<OptionState[]>(initial?.options ?? []);
  const [variants, setVariants] = useState<VariantState[]>(() =>
    initial?.variants.length
      ? initial.variants.map((v) => ({ ...v, gtin: v.gtin ?? "", stock: String(v.stock), minStock: String(v.minStock) }))
      : [blankVariant("")],
  );

  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (path: string) => errors[path];
  const attrs = s.categoryId ? (options.attributesByCategory[s.categoryId] ?? []) : [];

  /** Regenera a matriz de variações preservando as combinações existentes. */
  const applyOptions = (next: OptionState[]) => {
    setOpts(next);
    const valid = next.filter((o) => o.name.trim() && o.values.length);
    setVariants((current) => {
      if (valid.length === 0) {
        const first = current[0] ?? blankVariant(s.sku);
        return [{ ...first, optionValues: {} }];
      }
      const byKey = new Map(current.map((v) => [comboKey(valid, v.optionValues), v]));
      const base = current[0];
      return cartesian(valid).map((combo, i) => {
        const existing = byKey.get(comboKey(valid, combo));
        if (existing) return { ...existing, optionValues: combo };
        const suffix = Object.values(combo)
          .map((v) => slugify(v).toUpperCase().replace(/-/g, "").slice(0, 6))
          .join("-");
        return { ...blankVariant(s.sku ? `${s.sku}-${suffix}` : `VAR-${i + 1}`, base), optionValues: combo };
      });
    });
  };

  const updateVariant = (i: number, patch: Partial<VariantState>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    setImages((imgs) => {
      const next = [...imgs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
    setVariants((vs) => vs.map((v) => (v.imageIndex === from ? { ...v, imageIndex: to } : v.imageIndex === to ? { ...v, imageIndex: from } : v)));
  };
  const removeImage = (i: number) => {
    setImages((imgs) => imgs.filter((_, j) => j !== i));
    setVariants((vs) => vs.map((v) => (v.imageIndex === i ? { ...v, imageIndex: null } : v.imageIndex !== null && v.imageIndex > i ? { ...v, imageIndex: v.imageIndex - 1 } : v)));
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const slots = 12 - images.length;
    if (slots <= 0) return toast.error("Limite de 12 fotos atingido.");
    const selected = Array.from(files).slice(0, slots);
    setUploading(true);
    const res = await uploadImages(selected, "products");
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return toast.error(res.error);
    const added: ImageState[] = [];
    for (const f of res.data.files) if (f.ok) added.push({ url: f.url, storageKey: f.key, alt: "", width: f.width, height: f.height });
    setImages((imgs) => [...imgs, ...added].slice(0, 12));
    const failed = res.data.files.filter((f) => !f.ok);
    if (failed.length) toast.error(`${failed.length} imagem(ns) recusada(s)`, { description: failed.map((f) => (f.ok ? "" : `${f.name}: ${f.error}`)).join(" · ") });
  };

  const margin = useMemo(() => {
    const v = variants[0];
    if (!v?.priceCents || !v.costCents) return null;
    return Math.round(((v.priceCents - v.costCents) / v.priceCents) * 100);
  }, [variants]);

  const toInput = (status: "DRAFT" | "ACTIVE" | "PAUSED"): ProductInput => {
    const n = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const validOpts = opts.filter((o) => o.name.trim() && o.values.length).map((o) => ({ name: o.name.trim(), values: o.values }));
    return {
      name: s.name,
      slug: s.slug || undefined,
      shortDescription: s.shortDescription || null,
      description: s.description,
      categoryId: s.categoryId,
      brandId: s.brandId || null,
      condition: s.condition,
      status,
      sku: s.sku,
      gtin: s.gtin || undefined,
      tags: s.tags,
      warrantyMonths: n(s.warrantyMonths) ?? null,
      warrantyText: s.warrantyText || null,
      includedItems: s.includedItems,
      specifications: s.specifications
        .map((g) => ({ group: g.group.trim(), items: g.items.filter((i) => i.name.trim() && i.value.trim()) }))
        .filter((g) => g.group && g.items.length),
      weightGrams: n(s.weightGrams) as number,
      heightCm: n(s.heightCm) as number,
      widthCm: n(s.widthCm) as number,
      lengthCm: n(s.lengthCm) as number,
      freeShipping: s.freeShipping,
      seoTitle: s.seoTitle || null,
      seoDescription: s.seoDescription || null,
      isFeatured: mode === "admin" ? s.isFeatured : undefined,
      attributes: Object.entries(s.attributes)
        .filter(([id, v]) => v !== "" && attrs.some((a) => a.id === id))
        .map(([attributeId, value]) => ({ attributeId, value })),
      images: images.map((i) => ({ id: i.id, url: i.url, storageKey: i.storageKey ?? null, alt: i.alt || null, width: i.width ?? null, height: i.height ?? null })),
      options: validOpts,
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        gtin: v.gtin || undefined,
        optionValues: validOpts.length ? v.optionValues : {},
        priceCents: v.priceCents ?? 0,
        compareAtPriceCents: v.compareAtPriceCents || null,
        costCents: v.costCents ?? null,
        stock: Number(v.stock) || 0,
        stockBaseline: v.stockBaseline,
        minStock: Number(v.minStock) || 0,
        weightGrams: null,
        imageIndex: v.imageIndex,
        status: v.status,
      })),
    };
  };

  const save = (status: "DRAFT" | "ACTIVE" | "PAUSED") =>
    start(async () => {
      setFormError(null);
      const input = toInput(status);
      const res =
        mode === "seller"
          ? productId
            ? await sellerUpdateProductAction({ productId, input })
            : await sellerCreateProductAction(input)
          : productId
            ? await adminUpdateProductAction({ productId, input })
            : await adminCreateProductAction({ input });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      toast.success(res.message ?? "Salvo.");
      set("status", status);
      if (!productId) router.replace(`${backHref}/${res.data.id}`);
      else router.refresh();
    });

  const errorList = Object.entries(errors).slice(0, 6);
  const hasOptions = opts.length > 0;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Produtos
          </Link>
          <h1 className="mt-1 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{productId ? s.name || "Editar produto" : "Novo produto"}</h1>
          <p className="text-sm text-fg-muted">
            {storeName}
            {productId ? (
              <>
                {" · "}
                <Badge tone={s.status === "ACTIVE" ? "success" : s.status === "PAUSED" ? "warning" : "neutral"} size="xs">
                  {s.status === "ACTIVE" ? "Publicado" : s.status === "PAUSED" ? "Pausado" : "Rascunho"}
                </Badge>
              </>
            ) : null}
          </p>
        </div>
        {publicSlug && s.status === "ACTIVE" ? (
          <Link href={`/produto/${publicSlug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Ver na loja <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      {formError ? (
        <div role="alert" className="rounded-card border border-danger-600/30 bg-danger-50 p-4 text-sm text-danger-700">
          <p className="font-semibold">{formError}</p>
          {errorList.length ? (
            <ul className="mt-1 list-disc pl-5">
              {errorList.map(([k, v]) => (
                <li key={k}>{v[0]}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section id="basico" title="Informações básicas">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do produto" required error={err("name")} className="sm:col-span-2" hint="Inclua marca, modelo e característica principal. Ex.: Fone Bluetooth JBL Tune 520BT Preto">
                <Input
                  value={s.name}
                  maxLength={160}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="URL do produto" error={err("slug")} hint={`/produto/${s.slug || "…"}`} className="sm:col-span-2">
                <Input value={s.slug} maxLength={120} onChange={(e) => (setSlugTouched(true), set("slug", e.target.value.toLowerCase()))} />
              </Field>
              <Field label="Categoria" required error={err("categoryId")}>
                <Select value={s.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">Selecione…</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"  ".repeat(c.depth)}
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Marca" error={err("brandId")}>
                <Select value={s.brandId} onChange={(e) => set("brandId", e.target.value)}>
                  <option value="">Sem marca / genérico</option>
                  {options.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Condição" required>
                <Select value={s.condition} onChange={(e) => set("condition", e.target.value as typeof s.condition)}>
                  <option value="NEW">Novo</option>
                  <option value="USED">Usado</option>
                  <option value="REFURBISHED">Recondicionado</option>
                </Select>
              </Field>
              <Field label="SKU do produto" required error={err("sku")} hint="Código interno único na sua loja">
                <Input value={s.sku} maxLength={64} onChange={(e) => set("sku", e.target.value.toUpperCase())} className="font-mono uppercase" />
              </Field>
              <Field label="EAN / GTIN" error={err("gtin")} hint="Código de barras (opcional)">
                <Input value={s.gtin} inputMode="numeric" maxLength={14} onChange={(e) => set("gtin", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Palavras-chave" hint="Ajudam a busca. Enter ou vírgula para adicionar." error={err("tags")}>
                <ChipsInput values={s.tags} onChange={(v) => set("tags", v)} max={20} ariaLabel="Palavras-chave" placeholder="ex.: bluetooth, sem fio" />
              </Field>
              <Field label="Resumo" hint="Aparece perto do preço (até 300 caracteres)" error={err("shortDescription")} className="sm:col-span-2">
                <Textarea value={s.shortDescription} maxLength={300} showCount rows={2} onChange={(e) => set("shortDescription", e.target.value)} />
              </Field>
              <Field label="Descrição completa" required error={err("description")} className="sm:col-span-2" hint="Benefícios, materiais, compatibilidade e cuidados. Quebras de linha são preservadas.">
                <Textarea value={s.description} maxLength={10000} showCount rows={8} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="fotos" title="Fotos" description="Até 12 imagens (JPG, PNG, WebP ou AVIF, máx. 8 MB). A primeira é a capa. Fundo claro e produto centralizado convertem melhor.">
            {err("images") ? <p className="mb-2 text-sm text-danger-700">{err("images")?.[0]}</p> : null}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((img, i) => (
                <li key={img.url} className="flex flex-col gap-1.5 rounded-md border border-line p-1.5">
                  <div className="relative aspect-square overflow-hidden rounded bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização no editor */}
                    <img src={img.url} alt="" className="size-full object-contain" />
                    {i === 0 ? (
                      <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-brand-800 px-2 py-0.5 text-2xs font-bold text-white">
                        <Star className="size-3" aria-hidden /> Capa
                      </span>
                    ) : null}
                  </div>
                  <input value={img.alt} onChange={(e) => setImages((imgs) => imgs.map((x, j) => (j === i ? { ...x, alt: e.target.value.slice(0, 160) } : x)))} placeholder="Texto alternativo" aria-label={`Descrição da imagem ${i + 1}`} className="h-8 rounded border border-line px-2 text-xs focus:border-brand-600 focus:outline-none" />
                  <div className="flex items-center justify-between">
                    <div className="flex">
                      <button type="button" disabled={i === 0} onClick={() => moveImage(i, i - 1)} className="grid size-8 place-items-center rounded text-fg-muted hover:bg-surface-muted disabled:opacity-30 focus-ring" aria-label="Mover para a esquerda">
                        <ArrowLeft className="size-4" />
                      </button>
                      <button type="button" disabled={i === images.length - 1} onClick={() => moveImage(i, i + 1)} className="grid size-8 place-items-center rounded text-fg-muted hover:bg-surface-muted disabled:opacity-30 focus-ring" aria-label="Mover para a direita">
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeImage(i)} className="grid size-8 place-items-center rounded text-danger-600 hover:bg-danger-50 focus-ring" aria-label={`Remover imagem ${i + 1}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
              {images.length < 12 ? (
                <li>
                  <label className={cn("flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-strong p-3 text-center text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 focus-within:outline-2 focus-within:outline-brand-600", uploading && "pointer-events-none opacity-60")}>
                    <ImagePlus className="size-7" aria-hidden />
                    {uploading ? "Enviando…" : "Adicionar fotos"}
                    <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => upload(e.target.files)} />
                  </label>
                </li>
              ) : null}
            </ul>
          </Section>

          <Section
            id="variacoes"
            title="Preço, estoque e variações"
            description={hasOptions ? "Cada combinação tem SKU, preço, estoque e foto próprios." : "Produto sem variações (ex.: cor ou tamanho único)."}
            aside={
              <Switch
                checked={hasOptions}
                onChange={(e) => applyOptions(e.target.checked ? [{ name: "Cor", values: [] }] : [])}
                label="Tem variações"
              />
            }
          >
            {err("variants") || err("options") ? <p className="mb-3 text-sm text-danger-700">{(err("variants") ?? err("options"))?.[0]}</p> : null}
            {hasOptions ? (
              <div className="mb-4 flex flex-col gap-3">
                {opts.map((o, i) => (
                  <div key={i} className="grid gap-2 rounded-md bg-surface-muted p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
                    <Input value={o.name} maxLength={40} aria-label={`Nome da variação ${i + 1}`} placeholder="Ex.: Cor, Tamanho, Voltagem" onChange={(e) => applyOptions(opts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <ChipsInput values={o.values} ariaLabel={`Valores de ${o.name || "variação"}`} placeholder="Digite e pressione Enter (ex.: Preto, Branco)" onChange={(values) => applyOptions(opts.map((x, j) => (j === i ? { ...x, values } : x)))} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remover variação ${o.name}`} onClick={() => applyOptions(opts.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {opts.length < 3 ? (
                  <Button type="button" variant="outline" size="sm" className="self-start" leftIcon={<Plus className="size-4" />} onClick={() => applyOptions([...opts, { name: "", values: [] }])}>
                    Adicionar tipo de variação
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-xs font-semibold text-fg-muted">
                  <tr className="border-b border-line">
                    {hasOptions ? <th className="py-2 pr-2">Variação</th> : null}
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2">Preço de venda</th>
                    <th className="py-2 pr-2">Preço anterior</th>
                    <th className="py-2 pr-2">Custo</th>
                    <th className="py-2 pr-2">Estoque</th>
                    <th className="py-2 pr-2">Mín.</th>
                    {images.length ? <th className="py-2 pr-2">Foto</th> : null}
                    <th className="py-2">Ativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {variants.map((v, i) => {
                    const key = comboKey(opts, v.optionValues) || "single";
                    const e = (f: string) => errors[`variants.${i}.${f}`]?.[0];
                    return (
                      <tr key={key} className={cn("align-top", v.status === "INACTIVE" && "opacity-60")}>
                        {hasOptions ? <td className="py-2 pr-2 pt-4 font-semibold whitespace-nowrap">{opts.map((o) => v.optionValues[o.name]).filter(Boolean).join(" / ") || "—"}</td> : null}
                        <td className="py-2 pr-2">
                          <Input value={v.sku} aria-label="SKU da variação" aria-invalid={Boolean(e("sku")) || undefined} maxLength={64} className="h-10 w-36 font-mono text-xs uppercase" onChange={(ev) => updateVariant(i, { sku: ev.target.value.toUpperCase() })} />
                          {e("sku") ? <p className="mt-1 text-2xs text-danger-700">{e("sku")}</p> : null}
                        </td>
                        <td className="py-2 pr-2">
                          <PriceInput defaultCents={v.priceCents} aria-label="Preço de venda" aria-invalid={Boolean(e("priceCents")) || undefined} className="h-10 w-32" onCentsChange={(c) => updateVariant(i, { priceCents: c })} />
                          {e("priceCents") ? <p className="mt-1 text-2xs text-danger-700">{e("priceCents")}</p> : null}
                        </td>
                        <td className="py-2 pr-2">
                          <PriceInput defaultCents={v.compareAtPriceCents} aria-label="Preço anterior (de)" className="h-10 w-32" onCentsChange={(c) => updateVariant(i, { compareAtPriceCents: c })} />
                          {e("compareAtPriceCents") ? <p className="mt-1 max-w-32 text-2xs text-danger-700">{e("compareAtPriceCents")}</p> : null}
                        </td>
                        <td className="py-2 pr-2">
                          <PriceInput defaultCents={v.costCents} aria-label="Custo" className="h-10 w-28" onCentsChange={(c) => updateVariant(i, { costCents: c })} />
                        </td>
                        <td className="py-2 pr-2">
                          <Input type="number" min={0} max={1000000} inputMode="numeric" aria-label="Estoque" value={v.stock} className="h-10 w-24" onChange={(ev) => updateVariant(i, { stock: ev.target.value })} />
                          {e("stock") ? <p className="mt-1 text-2xs text-danger-700">{e("stock")}</p> : null}
                        </td>
                        <td className="py-2 pr-2">
                          <Input type="number" min={0} inputMode="numeric" aria-label="Estoque mínimo" value={v.minStock} className="h-10 w-20" onChange={(ev) => updateVariant(i, { minStock: ev.target.value })} />
                        </td>
                        {images.length ? (
                          <td className="py-2 pr-2">
                            <Select aria-label="Foto da variação" value={v.imageIndex ?? ""} className="h-10 w-28" onChange={(ev) => updateVariant(i, { imageIndex: ev.target.value === "" ? null : Number(ev.target.value) })}>
                              <option value="">Padrão</option>
                              {images.map((_, j) => (
                                <option key={j} value={j}>
                                  Foto {j + 1}
                                </option>
                              ))}
                            </Select>
                          </td>
                        ) : null}
                        <td className="py-2 pt-4">
                          <input type="checkbox" className="size-5 accent-brand-700" aria-label="Variação ativa" checked={v.status === "ACTIVE"} onChange={(ev) => updateVariant(i, { status: ev.target.checked ? "ACTIVE" : "INACTIVE" })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-fg-muted">
              O preço anterior (riscado) só deve ser usado se o produto foi realmente vendido por esse valor — exigência do CDC.
              {margin !== null ? ` Margem bruta estimada da primeira variação: ${margin}%.` : ""}
              {variants[0]?.priceCents ? ` Preço exibido: ${formatBRL(variants[0].priceCents)}.` : ""}
            </p>
          </Section>

          <Section id="especificacoes" title="Ficha técnica" description="Atributos da categoria alimentam os filtros da busca.">
            {attrs.length ? (
              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                {attrs.map((a) => (
                  <Field key={a.id} label={`${a.name}${a.unit ? ` (${a.unit})` : ""}`} required={a.isRequired} error={err(`attributes`)}>
                    {a.type === "SELECT" ? (
                      <Select value={s.attributes[a.id] ?? ""} onChange={(e) => set("attributes", { ...s.attributes, [a.id]: e.target.value })}>
                        <option value="">—</option>
                        {a.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : a.type === "BOOLEAN" ? (
                      <Select value={s.attributes[a.id] ?? ""} onChange={(e) => set("attributes", { ...s.attributes, [a.id]: e.target.value })}>
                        <option value="">—</option>
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </Select>
                    ) : (
                      <Input type={a.type === "NUMBER" ? "number" : "text"} value={s.attributes[a.id] ?? ""} maxLength={120} onChange={(e) => set("attributes", { ...s.attributes, [a.id]: e.target.value })} />
                    )}
                  </Field>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-fg-muted">{s.categoryId ? "Esta categoria não tem atributos padronizados." : "Escolha a categoria para ver os atributos."}</p>
            )}

            <div className="flex flex-col gap-3">
              {s.specifications.map((g, gi) => (
                <div key={gi} className="rounded-md border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Input value={g.group} maxLength={60} aria-label="Grupo" placeholder="Grupo (ex.: Tela, Bateria)" className="h-10 font-semibold" onChange={(e) => set("specifications", s.specifications.map((x, j) => (j === gi ? { ...x, group: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remover grupo" onClick={() => set("specifications", s.specifications.filter((_, j) => j !== gi))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {g.items.map((it, ii) => (
                    <div key={ii} className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-2">
                      <Input value={it.name} maxLength={80} aria-label="Característica" placeholder="Característica" className="h-10" onChange={(e) => set("specifications", s.specifications.map((x, j) => (j === gi ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, name: e.target.value } : y)) } : x)))} />
                      <Input value={it.value} maxLength={300} aria-label="Valor" placeholder="Valor" className="h-10" onChange={(e) => set("specifications", s.specifications.map((x, j) => (j === gi ? { ...x, items: x.items.map((y, k) => (k === ii ? { ...y, value: e.target.value } : y)) } : x)))} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remover linha" onClick={() => set("specifications", s.specifications.map((x, j) => (j === gi ? { ...x, items: x.items.filter((_, k) => k !== ii) } : x)))}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="link" size="sm" onClick={() => set("specifications", s.specifications.map((x, j) => (j === gi ? { ...x, items: [...x.items, { name: "", value: "" }] } : x)))}>
                    + Adicionar linha
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" leftIcon={<Plus className="size-4" />} onClick={() => set("specifications", [...s.specifications, { group: "", items: [{ name: "", value: "" }] }])}>
                Adicionar grupo de especificações
              </Button>
            </div>
          </Section>

          <Section id="garantia" title="Garantia e itens inclusos">
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <Field label="Garantia (meses)" error={err("warrantyMonths")}>
                <Input type="number" min={0} max={120} value={s.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} />
              </Field>
              <Field label="Detalhes da garantia" error={err("warrantyText")}>
                <Input value={s.warrantyText} maxLength={500} placeholder="Ex.: 12 meses com o fabricante" onChange={(e) => set("warrantyText", e.target.value)} />
              </Field>
              <Field label="Itens inclusos" className="sm:col-span-2" hint="Enter ou vírgula para adicionar">
                <ChipsInput values={s.includedItems} onChange={(v) => set("includedItems", v)} max={20} ariaLabel="Itens inclusos" placeholder="Ex.: Cabo USB-C, Manual" />
              </Field>
            </div>
          </Section>

          <Section id="envio" title="Embalagem e envio" description="Medidas da embalagem são usadas no cálculo do frete (peso cúbico).">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Peso (g)" required error={err("weightGrams")}>
                <Input type="number" min={1} inputMode="numeric" value={s.weightGrams} onChange={(e) => set("weightGrams", e.target.value)} />
              </Field>
              <Field label="Altura (cm)" required error={err("heightCm")}>
                <Input type="number" min={1} inputMode="numeric" value={s.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
              </Field>
              <Field label="Largura (cm)" required error={err("widthCm")}>
                <Input type="number" min={1} inputMode="numeric" value={s.widthCm} onChange={(e) => set("widthCm", e.target.value)} />
              </Field>
              <Field label="Comprimento (cm)" required error={err("lengthCm")}>
                <Input type="number" min={1} inputMode="numeric" value={s.lengthCm} onChange={(e) => set("lengthCm", e.target.value)} />
              </Field>
            </div>
            <Checkbox className="mt-4" checked={s.freeShipping} onChange={(e) => set("freeShipping", e.target.checked)} label="Oferecer frete grátis" description="O custo do frete será absorvido pela loja." />
          </Section>

          <Section id="seo" title="Aparência no Google" description="Opcional. Se vazio, usamos o nome e o resumo do produto.">
            <div className="grid gap-4">
              <Field label="Título SEO" error={err("seoTitle")}>
                <Input value={s.seoTitle} maxLength={70} onChange={(e) => set("seoTitle", e.target.value)} />
              </Field>
              <Field label="Descrição SEO" error={err("seoDescription")}>
                <Textarea value={s.seoDescription} maxLength={160} showCount rows={2} onChange={(e) => set("seoDescription", e.target.value)} />
              </Field>
              <div className="rounded-md border border-line bg-white p-3">
                <p className="truncate text-xs text-success-700">mercatto · produto › {s.slug || "…"}</p>
                <p className="truncate text-base text-[#1a0dab]">{s.seoTitle || s.name || "Título do produto"}</p>
                <p className="line-clamp-2 text-sm text-fg-muted">{s.seoDescription || s.shortDescription || s.description.slice(0, 160) || "Descrição do produto"}</p>
              </div>
            </div>
          </Section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <section className="rounded-card border border-line bg-surface p-4">
            <h2 className="mb-3 font-bold">Publicação</h2>
            <Field label="Status">
              <Select value={s.status} onChange={(e) => set("status", e.target.value as typeof s.status)}>
                <option value="DRAFT">Rascunho (não aparece na loja)</option>
                <option value="ACTIVE">Publicado</option>
                <option value="PAUSED">Pausado</option>
              </Select>
            </Field>
            {mode === "admin" ? <Checkbox className="mt-3" checked={s.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} label="Destacar na home" /> : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => save(s.status)} loading={pending} disabled={uploading} fullWidth>
                {productId ? "Salvar alterações" : s.status === "ACTIVE" ? "Publicar produto" : "Salvar rascunho"}
              </Button>
              {s.status === "DRAFT" ? (
                <Button variant="outline" onClick={() => save("ACTIVE")} disabled={pending || uploading} fullWidth>
                  Salvar e publicar
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-fg-muted">Para publicar: ao menos uma foto, uma variação ativa com preço e a loja ativa.</p>
          </section>
          <nav aria-label="Seções do editor" className="hidden rounded-card border border-line bg-surface p-2 xl:block">
            {[
              ["basico", "Informações básicas"],
              ["fotos", "Fotos"],
              ["variacoes", "Preço, estoque e variações"],
              ["especificacoes", "Ficha técnica"],
              ["garantia", "Garantia"],
              ["envio", "Embalagem e envio"],
              ["seo", "Google"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-surface-muted hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
        </aside>
      </div>

      {/* Barra fixa (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur xl:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-3xl gap-2">
          {s.status === "DRAFT" ? (
            <Button variant="outline" onClick={() => save("ACTIVE")} disabled={pending || uploading} className="flex-1">
              Publicar
            </Button>
          ) : null}
          <Button onClick={() => save(s.status)} loading={pending} disabled={uploading} className="flex-1">
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
