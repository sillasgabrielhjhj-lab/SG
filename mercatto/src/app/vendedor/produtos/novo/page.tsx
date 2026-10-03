import type { Metadata } from "next";

import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { createProductAction } from "@/lib/actions/seller";
import { ProductForm, type ProductFormDefaults } from "@/components/seller/product-form";

export const metadata: Metadata = { title: "Novo produto" };

const emptyDefaults: ProductFormDefaults = {
  name: "",
  description: "",
  categoryId: "",
  brandId: "",
  sku: "",
  price: "",
  compareAtPrice: "",
  costPrice: "",
  promotionStartsAt: "",
  promotionEndsAt: "",
  stock: "0",
  weightGrams: "",
  heightCm: "",
  widthCm: "",
  lengthCm: "",
  images: [],
  attributes: [],
  variants: [],
};

export default async function NewProductPage() {
  await requireRole(["SELLER", "ADMIN"]);

  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { name: "asc" }], include: { parent: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.parent ? `${c.parent.name} / ${c.name}` : c.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Novo produto</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados para cadastrar seu produto.</p>
      </div>

      <ProductForm
        categories={categoryOptions}
        brands={brands}
        defaults={emptyDefaults}
        action={createProductAction}
        submitLabel="Cadastrar produto"
      />
    </div>
  );
}
