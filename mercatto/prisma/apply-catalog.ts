/**
 * CATÁLOGO VERSIONADO (prisma/content/catalog/*.json), aplicado no build da Vercel.
 *
 * Produto novo  => criado como RASCUNHO, sem fotos, com todas as variações
 *                  oficiais (Cor × Armazenamento), preço 0 e estoque 0: só pode
 *                  ser publicado depois que o lojista adicionar fotos e preços
 *                  (travas em setProductStatus/carrinho/aggregates).
 * Produto existente (mesmo catalogKey, slug ou legacySlug) => o conteúdo é
 *                  reaplicado SOMENTE quando a versão do arquivo aumenta. Nunca
 *                  altera fotos, status, condição, garantia, preços, estoque,
 *                  frete nem SKUs de variações já existentes. Variações novas de
 *                  um produto já publicado nascem INATIVAS (sem preço).
 * Perguntas frequentes (isFaq) são sincronizadas; perguntas de clientes, nunca.
 *
 * Uso: tsx --conditions=react-server prisma/apply-catalog.ts
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import type { Prisma } from "../src/generated/prisma/client";
import { db, type Tx } from "../src/server/db";
import { normalizeText } from "../src/lib/utils";
import { recomputeProductAggregates } from "../src/features/catalog/aggregates";

type Color = { name: string; hex: string; code: string };
type Entry = {
  key: string;
  version: number;
  legacySlugs?: string[];
  skuCode: string;
  name: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  specifications: { group: string; items: { name: string; value: string }[] }[];
  includedItems: string[];
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  colors: Color[];
  storages: string[];
  attributes: Record<string, string>;
  faq: { q: string; a: string }[];
};
type CatalogFile = {
  brand: { slug: string; name: string };
  category: { slug: string; name: string; parentSlug: string; icon: string; description: string; seoTitle?: string; seoDescription?: string };
  categoryAttributes: { key: string; name: string; filterable: boolean }[];
  packaging: { weightGrams: number; heightCm: number; widthCm: number; lengthCm: number };
  products: Entry[];
};

const COLOR = "Cor";
const STORAGE = "Armazenamento";
const storageCode = (s: string) => s.replace(/\s+/g, "").replace(/GB$/i, "").toUpperCase();
const variantSku = (e: Entry, storage: string, color: Color) => `MCT-APL-${e.skuCode}-${storageCode(storage)}-${color.code}`;
const variantName = (storage: string, color: string) => `${storage} · ${color}`;

/** Identifica cor/armazenamento de uma variação existente (inclusive cadastro manual sem opções). */
function inferCombo(e: Entry, v: { name: string; sku: string; optionValues: unknown }, productName: string) {
  const ov = (v.optionValues ?? {}) as Record<string, string>;
  const haystack = normalizeText([Object.values(ov).join(" "), v.name, v.sku, productName].join(" "));
  const color = [...e.colors].sort((a, b) => b.name.length - a.name.length).find((c) => {
    const n = normalizeText(c.name);
    return normalizeText(ov[COLOR] ?? "") === n || new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(haystack);
  });
  const storage = e.storages.find((s) => {
    const digits = s.replace(/\D/g, "");
    const unit = /TB/i.test(s) ? "tb" : "gb";
    return normalizeText(ov[STORAGE] ?? "").replace(/\s/g, "") === normalizeText(s).replace(/\s/g, "") || new RegExp(`(^|[^0-9])${digits}\\s?${unit}`).test(haystack);
  });
  return color && storage ? { color, storage } : null;
}

async function ensureStructure(file: CatalogFile) {
  const brand = await db.brand.upsert({ where: { slug: file.brand.slug }, update: {}, create: { slug: file.brand.slug, name: file.brand.name } });
  const parent = (await db.category.findUnique({ where: { slug: file.category.parentSlug } })) ?? (await db.category.findUnique({ where: { slug: "celulares" } }));
  if (!parent) throw new Error(`Categoria pai "${file.category.parentSlug}" não encontrada.`);
  const c = file.category;
  const category = await db.category.upsert({
    where: { slug: c.slug },
    update: {},
    create: { slug: c.slug, name: c.name, parentId: parent.id, icon: c.icon, description: c.description, seoTitle: c.seoTitle ?? null, seoDescription: c.seoDescription ?? null, isActive: true },
  });
  for (const [i, a] of file.categoryAttributes.entries()) {
    await db.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: category.id, key: a.key } },
      update: {},
      create: { categoryId: category.id, key: a.key, name: a.name, type: "TEXT", isFilterable: a.filterable, position: 50 + i },
    });
  }
  const store = await db.store.findFirst({ where: { isOfficial: true }, select: { id: true, ownerId: true } });
  if (!store) throw new Error("Loja oficial não encontrada.");
  return { brand, category, store };
}

/** Atributos da categoria (e ancestrais) por chave. */
async function attributeIds(categoryId: string) {
  const chain: string[] = [];
  let current: string | null = categoryId;
  while (current) {
    chain.push(current);
    current = (await db.category.findUnique({ where: { id: current }, select: { parentId: true } }))?.parentId ?? null;
  }
  const attrs = await db.categoryAttribute.findMany({ where: { categoryId: { in: chain } }, select: { id: true, key: true } });
  return new Map(attrs.map((a) => [a.key, a.id]));
}

async function syncAttributes(tx: Tx, productId: string, e: Entry, attrIds: Map<string, string>) {
  for (const [key, value] of Object.entries(e.attributes)) {
    const attributeId = attrIds.get(key);
    if (!attributeId) continue;
    await tx.productAttributeValue.upsert({ where: { productId_attributeId: { productId, attributeId } }, update: { value }, create: { productId, attributeId, value } });
  }
}

async function syncFaq(tx: Tx, product: { id: string; storeId: string }, ownerId: string, e: Entry) {
  const existing = await tx.question.findMany({ where: { productId: product.id, isFaq: true }, select: { id: true, body: true, answer: { select: { id: true, body: true } } } });
  const wanted = new Map(e.faq.map((f) => [f.q.trim(), f.a.trim()]));
  for (const q of existing) {
    const answer = wanted.get(q.body);
    if (answer === undefined) await tx.question.delete({ where: { id: q.id } });
    else if (q.answer && q.answer.body !== answer) await tx.answer.update({ where: { id: q.answer.id }, data: { body: answer } });
  }
  const have = new Set(existing.map((q) => q.body));
  // Criadas de trás para frente: a página lista as mais recentes primeiro (ordem do arquivo).
  for (const [q, a] of [...wanted].reverse()) {
    if (have.has(q)) continue;
    await tx.question.create({ data: { productId: product.id, userId: ownerId, body: q, status: "PUBLISHED", isFaq: true, answer: { create: { storeId: product.storeId, userId: ownerId, body: a } } } });
  }
}

function contentData(e: Entry, categoryId: string, brandId: string) {
  return {
    name: e.name,
    shortDescription: e.shortDescription,
    description: e.description,
    highlights: e.highlights,
    specifications: e.specifications as unknown as Prisma.InputJsonValue,
    includedItems: e.includedItems,
    tags: e.tags,
    seoTitle: e.seoTitle,
    seoDescription: e.seoDescription,
    categoryId,
    brandId,
    catalogKey: e.key,
    catalogVersion: e.version,
  };
}

async function createProduct(e: Entry, ctx: Awaited<ReturnType<typeof ensureStructure>>, file: CatalogFile, attrIds: Map<string, string>) {
  const combos = e.storages.flatMap((storage) => e.colors.map((color) => ({ storage, color })));
  await db.$transaction(
    async (tx) => {
      const product = await tx.product.create({
        data: {
          ...contentData(e, ctx.category.id, ctx.brand.id),
          storeId: ctx.store.id,
          slug: e.key,
          sku: `MCT-APL-${e.skuCode}`,
          condition: "NEW",
          status: "DRAFT",
          ...file.packaging,
          options: { create: [{ name: COLOR, values: e.colors.map((c) => c.name), position: 0 }, { name: STORAGE, values: e.storages, position: 1 }] },
          variants: {
            create: combos.map((c, i) => ({
              sku: variantSku(e, c.storage, c.color),
              name: variantName(c.storage, c.color.name),
              optionValues: { [COLOR]: c.color.name, [STORAGE]: c.storage },
              priceCents: 0,
              stock: 0,
              status: "ACTIVE" as const,
              position: i,
            })),
          },
        },
        select: { id: true, storeId: true },
      });
      await syncAttributes(tx, product.id, e, attrIds);
      await syncFaq(tx, product, ctx.store.ownerId, e);
    },
    { timeout: 60_000, maxWait: 20_000 },
  );
  return "criado (rascunho)";
}

async function updateProduct(e: Entry, productId: string, ctx: Awaited<ReturnType<typeof ensureStructure>>, attrIds: Map<string, string>) {
  const notes: string[] = [];
  await db.$transaction(
    async (tx) => {
      const p = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { id: true, slug: true, name: true, status: true, storeId: true, variants: { select: { id: true, sku: true, name: true, optionValues: true, position: true } } },
      });
      // Slug padronizado + redirecionamento 301 do antigo.
      let slug = p.slug;
      if (p.slug !== e.key) {
        const taken = await tx.product.findUnique({ where: { slug: e.key }, select: { id: true } });
        if (!taken) {
          slug = e.key;
          await tx.slugRedirect.deleteMany({ where: { entity: "PRODUCT", fromSlug: e.key } });
          await tx.slugRedirect.upsert({ where: { entity_fromSlug: { entity: "PRODUCT", fromSlug: p.slug } }, update: { toSlug: e.key }, create: { entity: "PRODUCT", fromSlug: p.slug, toSlug: e.key } });
          await tx.slugRedirect.updateMany({ where: { entity: "PRODUCT", toSlug: p.slug }, data: { toSlug: e.key } });
          notes.push(`slug ${p.slug} → ${e.key} (301)`);
        }
      }
      await tx.product.update({ where: { id: p.id }, data: { ...contentData(e, ctx.category.id, ctx.brand.id), slug } });

      // Variações: todas as existentes precisam ser identificáveis; senão, não mexe na estrutura.
      // O nome do anúncio só ajuda a identificar quando há uma única variação (cadastro manual simples).
      const mapped = p.variants.map((v) => ({ v, combo: inferCombo(e, v, p.variants.length === 1 ? p.name : "") }));
      const unknown = mapped.filter((m) => !m.combo);
      if (unknown.length) {
        notes.push(`variações não alteradas: cor/armazenamento não identificados em ${unknown.map((m) => `"${m.v.name}"`).join(", ")}`);
      } else {
        await tx.productOption.deleteMany({ where: { productId: p.id, name: { notIn: [COLOR, STORAGE] } } });
        await tx.productOption.upsert({ where: { productId_name: { productId: p.id, name: COLOR } }, update: { values: e.colors.map((c) => c.name), position: 0 }, create: { productId: p.id, name: COLOR, values: e.colors.map((c) => c.name), position: 0 } });
        await tx.productOption.upsert({ where: { productId_name: { productId: p.id, name: STORAGE } }, update: { values: e.storages, position: 1 }, create: { productId: p.id, name: STORAGE, values: e.storages, position: 1 } });
        const have = new Set<string>();
        for (const { v, combo } of mapped) {
          const id = `${combo!.storage}|${combo!.color.name}`;
          have.add(id);
          await tx.productVariant.update({ where: { id: v.id }, data: { optionValues: { [COLOR]: combo!.color.name, [STORAGE]: combo!.storage }, name: variantName(combo!.storage, combo!.color.name) } });
        }
        let position = Math.max(-1, ...p.variants.map((v) => v.position)) + 1;
        let added = 0;
        for (const storage of e.storages) {
          for (const color of e.colors) {
            if (have.has(`${storage}|${color.name}`)) continue;
            const sku = variantSku(e, storage, color);
            if (await tx.productVariant.findUnique({ where: { sku }, select: { id: true } })) continue;
            await tx.productVariant.create({
              data: {
                productId: p.id,
                sku,
                name: variantName(storage, color.name),
                optionValues: { [COLOR]: color.name, [STORAGE]: storage },
                priceCents: 0,
                stock: 0,
                // Anúncio já publicado: variação nova só entra à venda depois de receber preço.
                status: p.status === "DRAFT" ? "ACTIVE" : "INACTIVE",
                position: position++,
              },
            });
            added++;
          }
        }
        if (added) notes.push(`${added} variações oficiais adicionadas${p.status === "DRAFT" ? "" : " (inativas, sem preço)"}`);
      }
      await syncAttributes(tx, p.id, e, attrIds);
      await syncFaq(tx, p, ctx.store.ownerId, e);
    },
    { timeout: 60_000, maxWait: 20_000 },
  );
  return `atualizado${notes.length ? ` — ${notes.join("; ")}` : ""}`;
}

async function main() {
  const dir = new URL("./content/catalog/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const touched: string[] = [];
  for (const f of files) {
    const file = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as CatalogFile;
    const ctx = await ensureStructure(file);
    const attrIds = await attributeIds(ctx.category.id);
    for (const e of file.products) {
      try {
        const existing =
          (await db.product.findUnique({ where: { catalogKey: e.key }, select: { id: true, catalogVersion: true } })) ??
          (await db.product.findUnique({ where: { slug: e.key }, select: { id: true, catalogVersion: true } })) ??
          (e.legacySlugs?.length ? await db.product.findFirst({ where: { slug: { in: e.legacySlugs } }, select: { id: true, catalogVersion: true } }) : null);
        if (existing && (existing.catalogVersion ?? 0) >= e.version) continue;
        const result = existing ? await updateProduct(e, existing.id, ctx, attrIds) : await createProduct(e, ctx, file, attrIds);
        const id = existing?.id ?? (await db.product.findUniqueOrThrow({ where: { catalogKey: e.key }, select: { id: true } })).id;
        touched.push(id);
        console.info(`[catálogo] ${e.name}: ${result}`);
      } catch (error) {
        console.warn(`[catálogo] ${e.name}: falhou —`, error instanceof Error ? error.message : error);
      }
    }
  }
  if (touched.length) await recomputeProductAggregates(touched);
  console.info(`[catálogo] ${touched.length} produto(s) criado(s)/atualizado(s).`);
}

main()
  .catch((error) => {
    // Conteúdo de catálogo não deve impedir a publicação do site.
    console.warn("[catálogo] Não foi possível aplicar o catálogo:", error instanceof Error ? error.message : error);
  })
  .finally(() => db.$disconnect());
