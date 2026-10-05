import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { requirePermissionPage } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import { getProductEditorOptions, getProductForEdit } from "@/features/products/queries";
import { getOfficialStoreId } from "@/features/products/service";
import { ProductEditor } from "@/features/products/components/product-editor";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Editar produto" };

export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermissionPage("admin:catalog", `/admin/produtos/${id}`);
  const officialStoreId = await getOfficialStoreId();
  const [options, product] = await Promise.all([
    getProductEditorOptions(),
    getProductForEdit({ kind: "admin", storeId: officialStoreId }, id).catch((e: unknown) => {
      if (isAppError(e) && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-4 py-2.5 text-sm">
        <Store className="size-4 text-fg-subtle" aria-hidden />
        <span className="text-fg-muted">Loja responsável:</span>
        <strong>{product.store.name}</strong>
        {product.store.isOfficial ? <Badge tone="brand">Oficial Mercatto</Badge> : <Badge tone="outline">Vendedor parceiro</Badge>}
        {product.isDemo ? <Badge tone="sun">DEMO</Badge> : null}
        <Link href={`/admin/produtos?loja=${product.store.id}`} className="ml-auto font-semibold text-brand-700 hover:underline">
          Ver produtos da loja
        </Link>
      </p>
      <ProductEditor key={id} mode="admin" options={options} productId={product.id} initial={{ ...product.input, slug: product.input.slug }} storeName={product.store.name} backHref="/admin/produtos" publicSlug={product.input.slug} />
    </div>
  );
}
