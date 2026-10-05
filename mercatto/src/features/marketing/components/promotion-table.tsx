"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Copy, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { DropdownMenu, type DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminCancelPromotionAction, sellerCancelPromotionAction } from "@/features/marketing/actions";
import { FlashBadge, PROMOTION_STATE, PROMOTION_TYPE, StateBadge, formatPromotionValue, type MarketingMode, type PromotionKind, type PromotionState } from "@/features/marketing/components/marketing-ui";

export type PromotionRow = {
  id: string;
  name: string;
  type: PromotionKind;
  value: number;
  isFlash: boolean;
  state: PromotionState;
  startsAt: string;
  endsAt: string;
  relative: string;
  soldCount: number;
  stockLimit: number | null;
  productCount: number;
  categoryCount: number;
  storeName: string | null;
  isOfficial: boolean;
  campaignName: string | null;
  /** false => abre em modo leitura (encerrada ou promoção de loja vista pelo admin). */
  editable: boolean;
  canDuplicate: boolean;
};

function Targets({ r }: { r: PromotionRow }) {
  const parts = [r.productCount ? `${r.productCount} produto(s)` : null, r.categoryCount ? `${r.categoryCount} categoria(s)` : null].filter(Boolean);
  return <>{parts.length ? parts.join(" + ") : "—"}</>;
}

function Sold({ r }: { r: PromotionRow }) {
  return (
    <span className="tabular">
      {r.soldCount}
      {r.stockLimit !== null ? <span className="text-fg-muted">/{r.stockLimit}</span> : <span className="text-xs text-fg-muted"> (sem limite)</span>}
    </span>
  );
}

function Origin({ r }: { r: PromotionRow }) {
  if (!r.storeName) return <span className="font-semibold text-brand-800">Mercatto (plataforma)</span>;
  return <span className={cn(r.isOfficial && "font-semibold text-brand-800")}>{r.storeName}</span>;
}

/** Tabela de promoções (colapsa em cards no mobile). */
export function PromotionTable({ rows, mode, basePath }: { rows: PromotionRow[]; mode: MarketingMode; basePath: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState<PromotionRow | null>(null);

  const cancel = (r: PromotionRow) =>
    start(async () => {
      const res = mode === "seller" ? await sellerCancelPromotionAction({ id: r.id }) : await adminCancelPromotionAction({ id: r.id });
      if (!res.ok) return toast.error(res.error);
      toast.success(res.message ?? "Promoção encerrada.");
      setCancelling(null);
      router.refresh();
    });

  const menu = (r: PromotionRow): DropdownItem[] => [
    r.editable ? { type: "link", label: "Editar", href: `${basePath}/${r.id}`, icon: <Pencil /> } : { type: "link", label: "Ver detalhes", href: `${basePath}/${r.id}`, icon: <Eye /> },
    ...(r.canDuplicate ? [{ type: "link" as const, label: "Duplicar", href: `${basePath}/nova?copiar=${r.id}`, icon: <Copy /> }] : []),
    ...(r.state === "ACTIVE" || r.state === "SCHEDULED" ? [{ type: "separator" as const }, { type: "button" as const, label: "Encerrar promoção", icon: <Ban />, danger: true, onSelect: () => setCancelling(r) }] : []),
  ];

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Promoção
                </th>
                {mode === "admin" ? (
                  <th scope="col" className="px-3 py-3">
                    Loja
                  </th>
                ) : null}
                <th scope="col" className="px-3 py-3">
                  Desconto
                </th>
                <th scope="col" className="px-3 py-3">
                  Período
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Vendidos
                </th>
                <th scope="col" className="px-3 py-3">
                  Alcance
                </th>
                <th scope="col" className="px-3 py-3">
                  Status
                </th>
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-line", pending && "opacity-70")}>
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-surface-muted/50">
                  <td className="max-w-72 px-4 py-3">
                    <Link href={`${basePath}/${r.id}`} className="line-clamp-2 font-semibold hover:underline">
                      {r.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                      {r.isFlash ? <FlashBadge /> : null}
                      {r.campaignName ? <span>Campanha: {r.campaignName}</span> : null}
                    </div>
                  </td>
                  {mode === "admin" ? (
                    <td className="px-3 py-3 text-xs">
                      <Origin r={r} />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-semibold">{formatPromotionValue(r.type, r.value)}</span>
                    <span className="block text-xs text-fg-muted">{PROMOTION_TYPE[r.type].label}</span>
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    <span className="block">{formatDateTime(r.startsAt)}</span>
                    <span className="block">até {formatDateTime(r.endsAt)}</span>
                    {r.relative ? <span className="block text-fg-muted">{r.relative}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <Sold r={r} />
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <Targets r={r} />
                  </td>
                  <td className="px-3 py-3">
                    <StateBadge meta={PROMOTION_STATE[r.state]} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <DropdownMenu label={`Ações para ${r.name}`} items={menu(r)} trigger={() => <MoreHorizontal className="size-5" />} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className={cn("divide-y divide-line lg:hidden", pending && "opacity-70")}>
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StateBadge meta={PROMOTION_STATE[r.state]} size="xs" />
                  {r.isFlash ? <FlashBadge /> : null}
                </div>
                <Link href={`${basePath}/${r.id}`} className="mt-1 line-clamp-2 text-sm font-semibold">
                  {r.name}
                </Link>
                <p className="text-sm font-semibold text-brand-800">{formatPromotionValue(r.type, r.value)}</p>
                <p className="text-xs text-fg-muted">
                  {formatDateTime(r.startsAt)} até {formatDateTime(r.endsAt)}
                  {r.relative ? ` · ${r.relative}` : ""}
                </p>
                <p className="text-xs text-fg-muted">
                  <Targets r={r} /> · vendidos <Sold r={r} />
                </p>
                {mode === "admin" ? (
                  <p className="text-xs text-fg-muted">
                    Loja: <Origin r={r} />
                  </p>
                ) : null}
              </div>
              <DropdownMenu label={`Ações para ${r.name}`} items={menu(r)} trigger={() => <MoreHorizontal className="size-5" />} />
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Encerrar promoção?"
        description={
          cancelling ? (
            <>
              <strong className="text-fg">{cancelling.name}</strong> sai do ar imediatamente e os preços voltam ao normal. {cancelling.storeName && mode === "admin" ? "A loja verá a promoção como cancelada. " : ""}Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Encerrar promoção"
        loading={pending}
        onConfirm={() => {
          if (cancelling) cancel(cancelling);
        }}
      />
    </>
  );
}
