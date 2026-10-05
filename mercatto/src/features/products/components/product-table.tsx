"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Copy, ExternalLink, MoreHorizontal, Pause, Pencil, Play, RotateCcw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/commerce/product-image";
import { DemoBadge } from "@/components/commerce/badges";
import {
  adminArchiveProductAction,
  adminDuplicateProductAction,
  adminRestoreProductAction,
  adminSetProductStatusAction,
  adminToggleFeaturedAction,
  sellerArchiveProductAction,
  sellerDuplicateProductAction,
  sellerRestoreProductAction,
  sellerSetProductStatusAction,
} from "@/features/products/actions";

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "OUT_OF_STOCK" | "ARCHIVED";
  isFeatured: boolean;
  isDemo: boolean;
  minPriceCents: number;
  effectivePriceCents: number;
  totalStock: number;
  salesCount: number;
  updatedAt: string;
  imageUrl: string | null;
  categoryName: string;
  storeName: string;
  isOfficial: boolean;
  variantCount: number;
  lowStock: boolean;
};

const STATUS: Record<ProductRow["status"], { label: string; cls: string }> = {
  ACTIVE: { label: "Publicado", cls: "bg-success-50 text-success-700" },
  DRAFT: { label: "Rascunho", cls: "bg-surface-muted text-fg-muted" },
  PAUSED: { label: "Pausado", cls: "bg-warning-50 text-warning-700" },
  OUT_OF_STOCK: { label: "Sem estoque", cls: "bg-danger-50 text-danger-700" },
  ARCHIVED: { label: "Arquivado", cls: "bg-surface-muted text-fg-subtle" },
};

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function ProductTable({ rows, mode, basePath }: { rows: ProductRow[]; mode: "seller" | "admin"; basePath: string }) {
  const [pending, start] = useTransition();
  const [archiving, setArchiving] = useState<ProductRow | null>(null);
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<Result>, after?: (r: Result) => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Pronto.");
        after?.(res);
        router.refresh();
      } else toast.error(res.error);
    });

  const A = mode === "seller"
    ? { status: sellerSetProductStatusAction, archive: sellerArchiveProductAction, restore: sellerRestoreProductAction, duplicate: sellerDuplicateProductAction }
    : { status: adminSetProductStatusAction, archive: adminArchiveProductAction, restore: adminRestoreProductAction, duplicate: adminDuplicateProductAction };

  const menu = (p: ProductRow): DropdownItem[] => [
    { type: "link", label: "Editar", href: `${basePath}/${p.id}`, icon: <Pencil /> },
    ...(p.status === "ACTIVE" || p.status === "OUT_OF_STOCK" ? [{ type: "link" as const, label: "Ver na loja", href: `/produto/${p.slug}`, icon: <ExternalLink /> }] : []),
    ...(p.status === "ACTIVE" || p.status === "OUT_OF_STOCK"
      ? [{ type: "button" as const, label: "Pausar anúncio", icon: <Pause />, onSelect: () => run(() => A.status({ productId: p.id, status: "PAUSED" })) }]
      : p.status === "PAUSED" || p.status === "DRAFT"
        ? [{ type: "button" as const, label: "Publicar", icon: <Play />, onSelect: () => run(() => A.status({ productId: p.id, status: "ACTIVE" })) }]
        : []),
    { type: "button", label: "Duplicar", icon: <Copy />, onSelect: () => run(() => A.duplicate({ productId: p.id })) },
    ...(mode === "admin" ? [{ type: "button" as const, label: p.isFeatured ? "Remover destaque" : "Destacar na home", icon: <Star />, onSelect: () => run(() => adminToggleFeaturedAction({ productId: p.id, featured: !p.isFeatured })) }] : []),
    { type: "separator" },
    p.status === "ARCHIVED"
      ? { type: "button", label: "Restaurar", icon: <RotateCcw />, onSelect: () => run(() => A.restore({ productId: p.id })) }
      : { type: "button", label: p.status === "DRAFT" ? "Excluir/arquivar" : "Arquivar", icon: <Archive />, danger: true, onSelect: () => setArchiving(p) },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {/* Desktop */}
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
            <tr>
              <th className="px-4 py-3">Produto</th>
              {mode === "admin" ? <th className="px-3 py-3">Loja</th> : null}
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Preço</th>
              <th className="px-3 py-3 text-right">Estoque</th>
              <th className="px-3 py-3 text-right">Vendas</th>
              <th className="px-3 py-3">Atualizado</th>
              <th className="px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className={cn("divide-y divide-line", pending && "opacity-70")}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                      <ProductImage src={p.imageUrl} alt="" sizes="48px" />
                    </span>
                    <div className="min-w-0">
                      <Link href={`${basePath}/${p.id}`} className="line-clamp-2 font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                        <span className="font-mono">{p.sku}</span> · {p.categoryName} · {p.variantCount} var.
                        {p.isFeatured ? <Star className="size-3.5 fill-sun-400 text-sun-500" aria-label="Destaque" /> : null}
                        {p.isDemo ? <DemoBadge /> : null}
                      </p>
                    </div>
                  </div>
                </td>
                {mode === "admin" ? <td className="px-3 py-2.5 text-xs">{p.isOfficial ? <span className="font-semibold text-brand-800">Oficial Mercatto</span> : p.storeName}</td> : null}
                <td className="px-3 py-2.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular">
                  {p.effectivePriceCents < p.minPriceCents ? <span className="block text-xs text-fg-subtle line-through">{formatBRL(p.minPriceCents)}</span> : null}
                  <span className="font-semibold">{formatBRL(p.effectivePriceCents || p.minPriceCents)}</span>
                </td>
                <td className={cn("px-3 py-2.5 text-right font-semibold tabular", p.totalStock === 0 ? "text-danger-700" : p.lowStock ? "text-warning-700" : "")}>{p.totalStock}</td>
                <td className="px-3 py-2.5 text-right tabular">{p.salesCount}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap text-fg-muted">{formatDate(p.updatedAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  <DropdownMenu label={`Ações para ${p.name}`} items={menu(p)} trigger={() => <MoreHorizontal className="size-5" />} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile */}
        <ul className={cn("divide-y divide-line md:hidden", pending && "opacity-70")}>
          {rows.map((p) => (
            <li key={p.id} className="flex items-start gap-3 p-3">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-md border border-line bg-white">
                <ProductImage src={p.imageUrl} alt="" sizes="64px" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`${basePath}/${p.id}`} className="line-clamp-2 text-sm font-semibold">
                  {p.name}
                </Link>
                <p className="text-xs text-fg-muted">
                  {formatBRL(p.effectivePriceCents || p.minPriceCents)} · estoque <strong className={p.totalStock === 0 ? "text-danger-700" : ""}>{p.totalStock}</strong> · {p.salesCount} vendas
                </p>
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-2xs font-semibold", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
              </div>
              <DropdownMenu label={`Ações para ${p.name}`} items={menu(p)} trigger={() => <MoreHorizontal className="size-5" />} />
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title={archiving?.status === "DRAFT" ? "Excluir ou arquivar produto?" : "Arquivar produto?"}
        description="Rascunhos que nunca foram vendidos são excluídos definitivamente. Produtos com vendas são arquivados (saem da loja, mas o histórico dos pedidos é mantido)."
        confirmLabel="Confirmar"
        loading={pending}
        onConfirm={() => {
          const p = archiving;
          if (p) run(() => A.archive({ productId: p.id }), () => setArchiving(null));
        }}
      />
    </>
  );
}
