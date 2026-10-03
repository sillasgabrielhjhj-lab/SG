import { productSchema } from "@/lib/validation/product";

/** Parse e validação compartilhados entre o formulário de produto do
 * vendedor (src/lib/actions/seller.ts) e o do admin pros produtos oficiais
 * da Mercatto (src/lib/actions/admin-products.ts) — o <form> é o mesmo
 * componente (ProductForm) nos dois casos, só muda quem pode chamar a
 * action e qual sellerId recebe o produto. Fica fora de um arquivo "use
 * server" de propósito: toda exportação de um módulo assim vira Server
 * Action e precisa ser async, o que essa função (síncrona) não é. */
export function parseProductFormData(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId") || null,
    sku: formData.get("sku"),
    priceCents: Math.round(Number(formData.get("price") ?? 0) * 100),
    compareAtPriceCents: formData.get("compareAtPrice")
      ? Math.round(Number(formData.get("compareAtPrice")) * 100)
      : null,
    costCents: formData.get("costPrice") ? Math.round(Number(formData.get("costPrice")) * 100) : null,
    // O <input type="datetime-local"> manda "AAAA-MM-DDTHH:mm" sem timezone;
    // tratamos como horário de Brasília (UTC-3, fixo), simétrico ao que
    // toDatetimeLocal() mostra nas páginas de edição de produto.
    promotionStartsAt: formData.get("promotionStartsAt")
      ? new Date(`${formData.get("promotionStartsAt")}:00-03:00`)
      : null,
    promotionEndsAt: formData.get("promotionEndsAt")
      ? new Date(`${formData.get("promotionEndsAt")}:00-03:00`)
      : null,
    weightGrams: formData.get("weightGrams") ? Number(formData.get("weightGrams")) : null,
    heightCm: formData.get("heightCm") ? Number(formData.get("heightCm")) : null,
    widthCm: formData.get("widthCm") ? Number(formData.get("widthCm")) : null,
    lengthCm: formData.get("lengthCm") ? Number(formData.get("lengthCm")) : null,
    stock: Number(formData.get("stock") ?? 0),
    images: JSON.parse((formData.get("imagesJson") as string) || "[]"),
    attributes: JSON.parse((formData.get("attributesJson") as string) || "[]"),
    variants: JSON.parse((formData.get("variantsJson") as string) || "[]"),
  };
  return productSchema.safeParse(raw);
}
