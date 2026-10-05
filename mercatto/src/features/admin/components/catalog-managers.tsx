"use client";

import { useState } from "react";
import { ChevronRight, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import { toLocalInputValue } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/layout/category-icon";
import { deleteAttributeAction, deleteBannerAction, deleteBrandAction, deleteCategoryAction, saveAttributeAction, saveBannerAction, saveBrandAction, saveCategoryAction } from "@/features/admin/actions";
import { ImageField } from "@/features/admin/components/image-field";
import { useAdminAction } from "@/features/admin/components/use-admin-action";

// ---------------------------------------------------------------------------
// Categorias + atributos
// ---------------------------------------------------------------------------

export type AttributeRow = { id: string; categoryId: string; name: string; key: string; type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"; options: string[]; unit: string | null; isFilterable: boolean; isRequired: boolean; position: number };
export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  depth: number;
  productCount: number;
  childCount: number;
  attributes: AttributeRow[];
};

const TYPE_LABEL = { TEXT: "Texto", NUMBER: "Número", SELECT: "Lista de opções", BOOLEAN: "Sim/Não" } as const;

function descendantsOf(rows: CategoryRow[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        changed = true;
      }
    }
  }
  return out;
}

function CategoryForm({ initial, rows, icons, onDone }: { initial: CategoryRow | null; rows: CategoryRow[]; icons: string[]; onDone: () => void }) {
  const [v, setV] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    icon: initial?.icon ?? "",
    imageUrl: initial?.imageUrl ?? "",
    parentId: initial?.parentId ?? "",
    position: String(initial?.position ?? 0),
    isActive: initial?.isActive ?? true,
    isFeatured: initial?.isFeatured ?? false,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
  });
  const { pending, run, err } = useAdminAction();
  const blocked = initial ? descendantsOf(rows, initial.id) : new Set<string>();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCategoryAction({ id: initial?.id, input: { ...v, position: Number(v.position) || 0 } }), onDone);
      }}
    >
      <Field label="Nome" required error={err("name")}>
        <Input value={v.name} maxLength={60} onChange={(e) => setV((p) => ({ ...p, name: e.target.value, slug: initial ? p.slug : slugify(e.target.value) }))} />
      </Field>
      <Field label="Slug (URL)" error={err("slug")} hint={`/categoria/${v.slug || "…"}`}>
        <Input value={v.slug} maxLength={80} onChange={set("slug")} />
      </Field>
      <Field label="Categoria pai" error={err("parentId")}>
        <Select value={v.parentId} onChange={set("parentId")}>
          <option value="">— Raiz —</option>
          {rows
            .filter((r) => !blocked.has(r.id))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {"  ".repeat(r.depth)}
                {r.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Ícone" error={err("icon")}>
        <div className="flex items-center gap-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <CategoryIcon name={v.icon} className="size-5" />
          </span>
          <Select value={v.icon} onChange={set("icon")}>
            <option value="">Padrão</option>
            {icons.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>
      </Field>
      <Field label="Descrição" error={err("description")} className="sm:col-span-2">
        <Textarea value={v.description} maxLength={500} rows={2} onChange={set("description")} />
      </Field>
      <div className="sm:col-span-2">
        <ImageField label="Imagem (opcional)" folder="categories" value={v.imageUrl} onChange={(url) => setV((p) => ({ ...p, imageUrl: url }))} />
      </div>
      <Field label="Posição" error={err("position")} hint="Menor aparece primeiro">
        <Input type="number" min={0} value={v.position} onChange={set("position")} />
      </Field>
      <div className="flex flex-col justify-end gap-2">
        <Checkbox checked={v.isActive} onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))} label="Ativa" />
        <Checkbox checked={v.isFeatured} onChange={(e) => setV((p) => ({ ...p, isFeatured: e.target.checked }))} label="Destaque na home" />
      </div>
      <Field label="Título SEO" error={err("seoTitle")}>
        <Input value={v.seoTitle} maxLength={70} onChange={set("seoTitle")} />
      </Field>
      <Field label="Descrição SEO" error={err("seoDescription")}>
        <Input value={v.seoDescription} maxLength={160} onChange={set("seoDescription")} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar categoria
        </Button>
      </div>
    </form>
  );
}

function AttributeForm({ categoryId, initial, onDone }: { categoryId: string; initial: AttributeRow | null; onDone: () => void }) {
  const [v, setV] = useState({
    name: initial?.name ?? "",
    key: initial?.key ?? "",
    type: initial?.type ?? ("TEXT" as AttributeRow["type"]),
    optionsText: (initial?.options ?? []).join(", "),
    unit: initial?.unit ?? "",
    isFilterable: initial?.isFilterable ?? true,
    isRequired: initial?.isRequired ?? false,
    position: String(initial?.position ?? 0),
  });
  const { pending, run, err } = useAdminAction();
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const options = v.type === "SELECT" ? v.optionsText.split(",").map((s) => s.trim()).filter(Boolean) : [];
        run(() => saveAttributeAction({ id: initial?.id, input: { categoryId, name: v.name, key: v.key, type: v.type, options, unit: v.unit, isFilterable: v.isFilterable, isRequired: v.isRequired, position: Number(v.position) || 0 } }), onDone);
      }}
    >
      <Field label="Nome" required error={err("name")}>
        <Input value={v.name} maxLength={40} onChange={(e) => setV((p) => ({ ...p, name: e.target.value, key: initial ? p.key : slugify(e.target.value).replace(/-/g, "_").slice(0, 40) }))} />
      </Field>
      <Field label="Chave" required error={err("key")} hint="Usada na URL dos filtros (attr_chave)">
        <Input value={v.key} maxLength={40} className="font-mono" onChange={(e) => setV((p) => ({ ...p, key: e.target.value.toLowerCase() }))} />
      </Field>
      <Field label="Tipo" required>
        <Select value={v.type} onChange={(e) => setV((p) => ({ ...p, type: e.target.value as AttributeRow["type"] }))}>
          {Object.entries(TYPE_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unidade" error={err("unit")} hint="Ex.: GB, pol, W">
        <Input value={v.unit} maxLength={10} onChange={(e) => setV((p) => ({ ...p, unit: e.target.value }))} />
      </Field>
      {v.type === "SELECT" ? (
        <Field label="Opções" required error={err("options")} hint="Separe por vírgula" className="sm:col-span-2">
          <Input value={v.optionsText} onChange={(e) => setV((p) => ({ ...p, optionsText: e.target.value }))} placeholder="128 GB, 256 GB, 512 GB" />
        </Field>
      ) : null}
      <Field label="Posição">
        <Input type="number" min={0} value={v.position} onChange={(e) => setV((p) => ({ ...p, position: e.target.value }))} />
      </Field>
      <div className="flex flex-col justify-end gap-2">
        <Checkbox checked={v.isFilterable} onChange={(e) => setV((p) => ({ ...p, isFilterable: e.target.checked }))} label="Aparece nos filtros da busca" />
        <Checkbox checked={v.isRequired} onChange={(e) => setV((p) => ({ ...p, isRequired: e.target.checked }))} label="Obrigatório no cadastro" />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar atributo
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({ rows, icons }: { rows: CategoryRow[]; icons: string[] }) {
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);
  const [attr, setAttr] = useState<AttributeRow | "new" | null>(null);
  const [removing, setRemoving] = useState<{ kind: "category" | "attribute"; id: string; name: string } | null>(null);
  const { pending, run } = useAdminAction();
  const current = rows.find((r) => r.id === selected) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold">Árvore de categorias</h2>
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            Nova categoria
          </Button>
        </div>
        {rows.length === 0 ? (
          <EmptyState compact title="Nenhuma categoria" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-2 py-2 pr-2", selected === r.id && "bg-brand-50/60")} style={{ paddingLeft: `${16 + r.depth * 20}px` }}>
                <button type="button" onClick={() => setSelected(r.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring" aria-pressed={selected === r.id}>
                  {r.depth > 0 ? <ChevronRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden /> : null}
                  <CategoryIcon name={r.icon} className="size-4 shrink-0 text-brand-700" />
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-fg-subtle">{r.productCount} prod.</span>
                  {!r.isActive ? <Badge size="xs">Inativa</Badge> : null}
                  {r.isFeatured ? <Star className="size-3.5 fill-sun-400 text-sun-500" aria-label="Destaque" /> : null}
                </button>
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${r.name}`} onClick={() => setEditing(r)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${r.name}`} disabled={r.productCount > 0 || r.childCount > 0} onClick={() => setRemoving({ kind: "category", id: r.id, name: r.name })}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="truncate font-bold">Atributos {current ? `— ${current.name}` : ""}</h2>
          {current ? (
            <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setAttr("new")}>
              Novo atributo
            </Button>
          ) : null}
        </div>
        <p className="px-4 pt-3 text-xs text-fg-muted">Atributos alimentam a ficha técnica e os filtros da busca. Subcategorias herdam os atributos das categorias pai.</p>
        {current && current.attributes.length ? (
          <ul className="divide-y divide-line">
            {current.attributes.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {a.name}
                    {a.unit ? <span className="font-normal text-fg-muted"> ({a.unit})</span> : null}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    <span className="font-mono">{a.key}</span> · {TYPE_LABEL[a.type]}
                    {a.options.length ? ` · ${a.options.join(", ")}` : ""}
                    {a.isFilterable ? " · filtro" : ""}
                    {a.isRequired ? " · obrigatório" : ""}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${a.name}`} onClick={() => setAttr(a)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${a.name}`} onClick={() => setRemoving({ kind: "attribute", id: a.id, name: a.name })}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-fg-muted">{current ? "Nenhum atributo nesta categoria." : "Selecione uma categoria."}</p>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nova categoria" : "Editar categoria"} size="lg">
        {editing ? <CategoryForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} rows={rows} icons={icons} onDone={() => setEditing(null)} /> : null}
      </Modal>
      <Modal open={attr !== null && current !== null} onClose={() => setAttr(null)} title={attr === "new" ? "Novo atributo" : "Editar atributo"} size="lg">
        {attr && current ? <AttributeForm key={attr === "new" ? "new" : attr.id} categoryId={current.id} initial={attr === "new" ? null : attr} onDone={() => setAttr(null)} /> : null}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Excluir ${removing?.kind === "attribute" ? "atributo" : "categoria"} "${removing?.name ?? ""}"?`}
        description={removing?.kind === "attribute" ? "Os valores desse atributo nos produtos também serão removidos." : "Só é possível excluir categorias sem produtos e sem subcategorias."}
        confirmLabel="Excluir"
        loading={pending}
        onConfirm={() => {
          const r = removing;
          if (!r) return;
          run(() => (r.kind === "attribute" ? deleteAttributeAction({ id: r.id }) : deleteCategoryAction({ id: r.id })), () => setRemoving(null));
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

export type BrandRow = { id: string; name: string; slug: string; logoUrl: string | null; isFeatured: boolean; productCount: number };

function BrandForm({ initial, onDone }: { initial: BrandRow | null; onDone: () => void }) {
  const [v, setV] = useState({ name: initial?.name ?? "", slug: initial?.slug ?? "", logoUrl: initial?.logoUrl ?? "", isFeatured: initial?.isFeatured ?? false });
  const { pending, run, err } = useAdminAction();
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveBrandAction({ id: initial?.id, input: v }), onDone);
      }}
    >
      <Field label="Nome" required error={err("name")}>
        <Input value={v.name} maxLength={60} onChange={(e) => setV((p) => ({ ...p, name: e.target.value, slug: initial ? p.slug : slugify(e.target.value) }))} />
      </Field>
      <Field label="Slug (URL)" error={err("slug")} hint={`/marca/${v.slug || "…"}`}>
        <Input value={v.slug} maxLength={80} onChange={(e) => setV((p) => ({ ...p, slug: e.target.value }))} />
      </Field>
      <ImageField label="Logo" folder="brands" value={v.logoUrl} onChange={(url) => setV((p) => ({ ...p, logoUrl: url }))} hint="Quadrado, fundo transparente ou branco (mín. 200×200 px)." />
      <Checkbox checked={v.isFeatured} onChange={(e) => setV((p) => ({ ...p, isFeatured: e.target.checked }))} label="Destacar na home" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar marca
        </Button>
      </div>
    </form>
  );
}

export function BrandManager({ rows }: { rows: BrandRow[] }) {
  const [editing, setEditing] = useState<BrandRow | "new" | null>(null);
  const [removing, setRemoving] = useState<BrandRow | null>(null);
  const { pending, run } = useAdminAction();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          Nova marca
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState title="Nenhuma marca encontrada" />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white text-lg font-extrabold text-brand-800">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo enviado */}
                {b.logoUrl ? <img src={b.logoUrl} alt="" className="size-full object-contain" /> : b.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {b.name} {b.isFeatured ? <Star className="inline size-3.5 fill-sun-400 text-sun-500" aria-label="Destaque" /> : null}
                </p>
                <p className="text-xs text-fg-muted">
                  /marca/{b.slug} · {b.productCount} produto(s)
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Editar ${b.name}`} onClick={() => setEditing(b)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${b.name}`} disabled={b.productCount > 0} onClick={() => setRemoving(b)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nova marca" : "Editar marca"}>
        {editing ? <BrandForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Excluir a marca "${removing?.name ?? ""}"?`}
        description="Marcas com produtos não podem ser excluídas."
        confirmLabel="Excluir"
        loading={pending}
        onConfirm={() => {
          const b = removing;
          if (b) run(() => deleteBrandAction({ id: b.id }), () => setRemoving(null));
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  ctaLabel: string | null;
  link: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  theme: string;
  placement: "HOME_HERO" | "HOME_MID" | "HOME_STRIP" | "CATEGORY";
  position: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Calculado no servidor: ativo e dentro do período. */
  live: boolean;
};

export const PLACEMENTS = {
  HOME_HERO: { label: "Home — carrossel principal", size: "1600×560 px (mobile: 800×800 px)" },
  HOME_MID: { label: "Home — banners intermediários", size: "1200×360 px" },
  HOME_STRIP: { label: "Home — faixa", size: "sem imagem (somente texto)" },
  CATEGORY: { label: "Páginas de categoria", size: "1600×400 px" },
} as const;
const THEMES = { brand: "Verde Mercatto", sun: "Amarelo", ink: "Escuro", coral: "Coral", light: "Claro" } as const;

function BannerForm({ initial, onDone }: { initial: BannerRow | null; onDone: () => void }) {
  const [v, setV] = useState({
    title: initial?.title ?? "",
    subtitle: initial?.subtitle ?? "",
    eyebrow: initial?.eyebrow ?? "",
    ctaLabel: initial?.ctaLabel ?? "",
    link: initial?.link ?? "/ofertas",
    imageUrl: initial?.imageUrl ?? "",
    mobileImageUrl: initial?.mobileImageUrl ?? "",
    theme: (initial?.theme ?? "brand") as keyof typeof THEMES,
    placement: initial?.placement ?? ("HOME_HERO" as BannerRow["placement"]),
    position: String(initial?.position ?? 0),
    startsAt: toLocalInputValue(initial?.startsAt),
    endsAt: toLocalInputValue(initial?.endsAt),
    isActive: initial?.isActive ?? true,
  });
  const { pending, run, err } = useAdminAction();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveBannerAction({ id: initial?.id, input: { ...v, position: Number(v.position) || 0 } }), onDone);
      }}
    >
      <Field label="Posição na loja" required>
        <Select value={v.placement} onChange={set("placement")}>
          {Object.entries(PLACEMENTS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tema" hint="Cor de fundo e contraste do texto">
        <Select value={v.theme} onChange={set("theme")}>
          {Object.entries(THEMES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título" required error={err("title")} className="sm:col-span-2">
        <Input value={v.title} maxLength={90} onChange={set("title")} />
      </Field>
      <Field label="Chamada superior" error={err("eyebrow")}>
        <Input value={v.eyebrow} maxLength={40} onChange={set("eyebrow")} placeholder="Ex.: OFERTAS OFICIAIS" />
      </Field>
      <Field label="Texto do botão" error={err("ctaLabel")}>
        <Input value={v.ctaLabel} maxLength={30} onChange={set("ctaLabel")} placeholder="Ver ofertas" />
      </Field>
      <Field label="Subtítulo" error={err("subtitle")} className="sm:col-span-2">
        <Input value={v.subtitle} maxLength={160} onChange={set("subtitle")} />
      </Field>
      <Field label="Link (interno)" required error={err("link")} hint="Ex.: /ofertas, /categoria/celulares, /campanha/semana-mercatto" className="sm:col-span-2">
        <Input value={v.link} maxLength={300} onChange={set("link")} />
      </Field>
      {v.placement !== "HOME_STRIP" ? (
        <>
          <ImageField label="Imagem (desktop)" folder="banners" value={v.imageUrl} onChange={(url) => setV((p) => ({ ...p, imageUrl: url }))} hint={`Recomendado: ${PLACEMENTS[v.placement].size}. O texto é sobreposto à esquerda — deixe a área livre.`} />
          <ImageField label="Imagem (celular, opcional)" folder="banners" value={v.mobileImageUrl} onChange={(url) => setV((p) => ({ ...p, mobileImageUrl: url }))} />
        </>
      ) : null}
      <Field label="Início" error={err("startsAt")} hint="Vazio = imediatamente">
        <Input type="datetime-local" value={v.startsAt} onChange={set("startsAt")} />
      </Field>
      <Field label="Término" error={err("endsAt")} hint="Vazio = sem prazo">
        <Input type="datetime-local" value={v.endsAt} onChange={set("endsAt")} />
      </Field>
      <Field label="Ordem" hint="Menor aparece primeiro">
        <Input type="number" min={0} value={v.position} onChange={set("position")} />
      </Field>
      <div className="flex items-end">
        <Checkbox checked={v.isActive} onChange={(e) => setV((p) => ({ ...p, isActive: e.target.checked }))} label="Ativo" />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          Salvar banner
        </Button>
      </div>
    </form>
  );
}

export function BannerManager({ rows }: { rows: BannerRow[] }) {
  const [editing, setEditing] = useState<BannerRow | "new" | null>(null);
  const [removing, setRemoving] = useState<BannerRow | null>(null);
  const { pending, run } = useAdminAction();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          Novo banner
        </Button>
      </div>
      <div className="flex flex-col gap-5">
        {(Object.keys(PLACEMENTS) as BannerRow["placement"][]).map((placement) => {
          const list = rows.filter((r) => r.placement === placement);
          return (
            <section key={placement} aria-labelledby={`pl-${placement}`}>
              <h2 id={`pl-${placement}`} className="mb-2 text-sm font-bold">
                {PLACEMENTS[placement].label} <span className="font-normal text-fg-muted">· {PLACEMENTS[placement].size}</span>
              </h2>
              {list.length === 0 ? (
                <p className="rounded-card border border-dashed border-line-strong p-4 text-sm text-fg-muted">Nenhum banner nesta posição.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {list.map((b) => (
                    <li key={b.id} className="overflow-hidden rounded-card border border-line bg-surface">
                      <div className="relative aspect-[16/5] bg-brand-50">
                        {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização */}
                        {b.imageUrl ? <img src={b.imageUrl} alt="" className="size-full object-cover" /> : null}
                        <span className="absolute top-2 left-2">
                          <Badge tone={b.live ? "success" : "neutral"} size="xs">
                            {b.live ? "No ar" : b.isActive ? "Fora do período" : "Inativo"}
                          </Badge>
                        </span>
                      </div>
                      <div className="flex items-start gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{b.title}</p>
                          <p className="truncate text-xs text-fg-muted">
                            {b.link} · ordem {b.position}
                          </p>
                        </div>
                        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${b.title}`} onClick={() => setEditing(b)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${b.title}`} onClick={() => setRemoving(b)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo banner" : "Editar banner"} size="lg">
        {editing ? <BannerForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      </Modal>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Excluir o banner "${removing?.title ?? ""}"?`}
        confirmLabel="Excluir"
        loading={pending}
        onConfirm={() => {
          const b = removing;
          if (b) run(() => deleteBannerAction({ id: b.id }), () => setRemoving(null));
        }}
      />
    </>
  );
}
