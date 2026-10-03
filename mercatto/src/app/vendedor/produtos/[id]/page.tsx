import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getSellerByUserId, getSellerProductForEdit } from "@/lib/data/seller";
import { updateProductAction } from "@/lib/actions/seller";
import { ProductForm, type ProductFormDefaults } from "@/components/seller/product-form";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller) notFound();

  const [product, categories, brands] = await Promise.all([
    getSellerProductForEdit(seller.id, id),
    prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { name: "asc" }], include: { parent: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  // datetime-local espera "AAAA-MM-DDTHH:mm" sem timezone — mostramos no
  // horário de Brasília (UTC-3, fixo) independente do fuso do servidor,
  // já que a loja opera só no Brasil. O valor volta com o mesmo offset
  // explícito em parseProductFormData (src/lib/actions/seller.ts).
  function toDatetimeLocal(date: Date | null) {
    if (!date) return "";
    return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
  }

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.parent ? `${c.parent.name} / ${c.name}` : c.name,
  }));

  const defaults: ProductFormDefaults = {
    productId: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId ?? "",
    sku: product.sku,
    price: (product.priceCents / 100).toString(),
    compareAtPrice: product.compareAtPriceCents ? (product.compareAtPriceCents / 100).toString() : "",
    costPrice: product.costCents ? (product.costCents / 100).toString() : "",
    promotionStartsAt: toDatetimeLocal(product.promotionStartsAt),
    promotionEndsAt: toDatetimeLocal(product.promotionEndsAt),
    stock: (product.inventory?.quantity ?? 0).toString(),
    weightGrams: product.weightGrams?.toString() ?? "",
    heightCm: product.heightCm?.toString() ?? "",
    widthCm: product.widthCm?.toString() ?? "",
    lengthCm: product.lengthCm?.toString() ?? "",
    images: product.images.map((img) => ({ url: img.url, altText: img.altText ?? undefined })),
    attributes: product.attributes.map((a) => ({ name: a.name, value: a.value })),
    variants: product.variants.map((v) => ({
      name: v.name,
      sku: v.sku,
      priceCents: v.priceCents,
      stock: v.inventory?.quantity ?? 0,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Editar produto</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>

      <ProductForm
        categories={categoryOptions}
        brands={brands}
        defaults={defaults}
        action={updateProductAction}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
