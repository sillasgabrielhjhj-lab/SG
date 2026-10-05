"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { adminToggleCouponAction, sellerToggleCouponAction } from "@/features/marketing/actions";
import { COUPON_STATE, StateBadge, formatCouponValue, type CouponKind, type CouponState, type MarketingMode } from "@/features/marketing/components/marketing-ui";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: CouponKind;
  value: number;
  maxDiscountCents: number | null;
  minOrderCents: number;
  startsAt: string | null;
  endsAt: string | null;
  usedCount: number;
  usageLimit: number | null;
  state: CouponState;
  isActive: boolean;
  isPublic: boolean;
  storeName: string | null;
  /** false => cupom de loja visto pelo admin (somente leitura + ativar/desativar). */
  editable: boolean;
};

function Validity({ r }: { r: CouponRow }) {
  if (!r.startsAt && !r.endsAt) return <span className="text-fg-muted">Sem prazo</span>;
  return (
    <>
      {r.startsAt ? <span className="block">de {formatDate(r.startsAt)}</span> : null}
      {r.endsAt ? <span className="block">até {formatDate(r.endsAt)}</span> : null}
    </>
  );
}

function Usage({ r }: { r: CouponRow }) {
  const pct = r.usageLimit ? Math.min(100, Math.round((r.usedCount / r.usageLimit) * 100)) : null;
  return (
    <span className="inline-flex min-w-16 flex-col items-end gap-1">
      <span className="tabular">
        {r.usedCount}
        <span className="text-fg-muted">/{r.usageLimit ?? "∞"}</span>
      </span>
      {pct !== null ? (
        <span className="h-1 w-16 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-warning-600" : "bg-brand-600")} style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  );
}

/** Tabela de cupons (colapsa em cards no mobile): copiar código, ativar/desativar, editar. */
export function CouponTable({ rows, mode, basePath }: { rows: CouponRow[]; mode: MarketingMode; basePath: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(rows, (state, patch: { id: string; isActive: boolean }) => state.map((r) => (r.id === patch.id ? { ...r, isActive: patch.isActive } : r)));

  const toggle = (r: CouponRow, isActive: boolean) =>
    start(async () => {
      setOptimistic({ id: r.id, isActive });
      const res = mode === "seller" ? await sellerToggleCouponAction({ id: r.id, isActive }) : await adminToggleCouponAction({ id: r.id, isActive });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Pronto.");
      router.refresh();
    });

  const editLink = (r: CouponRow, compact?: boolean) => (
    <ButtonLink href={`${basePath}/${r.id}`} variant="ghost" size={compact ? "icon-sm" : "sm"} aria-label={`${r.editable ? "Editar" : "Ver"} cupom ${r.code}`} leftIcon={r.editable ? <Pencil className="size-4" /> : <Eye className="size-4" />}>
      {compact ? null : r.editable ? "Editar" : "Ver"}
    </ButtonLink>
  );

  const activeSwitch = (r: CouponRow) => <Switch checked={r.isActive} disabled={pending} onChange={(e) => toggle(r, e.target.checked)} aria-label={`Cupom ${r.code} ativo`} />;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-3">
                Código
              </th>
              {mode === "admin" ? (
                <th scope="col" className="px-3 py-3">
                  Loja
                </th>
              ) : null}
              <th scope="col" className="px-3 py-3">
                Benefício
              </th>
              <th scope="col" className="px-3 py-3">
                Validade
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Usos
              </th>
              <th scope="col" className="px-3 py-3">
                Situação
              </th>
              <th scope="col" className="px-3 py-3">
                Ativo
              </th>
              <th scope="col" className="px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className={cn("divide-y divide-line", pending && "opacity-80")}>
            {optimistic.map((r) => (
              <tr key={r.id} className="align-top hover:bg-surface-muted/50">
                <td className="max-w-72 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`${basePath}/${r.id}`} className="font-mono font-bold tracking-wide break-all hover:underline">
                      {r.code}
                    </Link>
                    <CopyButton value={r.code} label="" copiedLabel="" variant="ghost" size="icon-sm" className="gap-0" aria-label={`Copiar código ${r.code}`} />
                  </div>
                  {r.description ? <p className="line-clamp-2 text-xs text-fg-muted">{r.description}</p> : null}
                  {r.isPublic ? <p className="text-2xs font-semibold text-brand-700">Divulgado aos clientes</p> : null}
                </td>
                {mode === "admin" ? <td className="px-3 py-3 text-xs">{r.storeName ?? <span className="font-semibold text-brand-800">Mercatto (plataforma)</span>}</td> : null}
                <td className="px-3 py-3">
                  <span className="font-semibold whitespace-nowrap">{formatCouponValue(r.type, r.value, r.maxDiscountCents)}</span>
                  <span className="block text-xs text-fg-muted">{r.minOrderCents ? `Mínimo ${formatBRL(r.minOrderCents)}` : "Sem pedido mínimo"}</span>
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">
                  <Validity r={r} />
                </td>
                <td className="px-3 py-3 text-right">
                  <Usage r={r} />
                </td>
                <td className="px-3 py-3">
                  <StateBadge meta={COUPON_STATE[r.state]} />
                </td>
                <td className="px-3 py-3">{activeSwitch(r)}</td>
                <td className="px-3 py-3 text-right">{editLink(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={cn("divide-y divide-line lg:hidden", pending && "opacity-80")}>
        {optimistic.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`${basePath}/${r.id}`} className="font-mono text-base font-bold tracking-wide break-all">
                  {r.code}
                </Link>
                {r.description ? <p className="line-clamp-2 text-xs text-fg-muted">{r.description}</p> : null}
              </div>
              <StateBadge meta={COUPON_STATE[r.state]} size="xs" />
            </div>
            <p className="text-sm">
              <span className="font-semibold">{formatCouponValue(r.type, r.value, r.maxDiscountCents)}</span>
              <span className="text-fg-muted"> · {r.minOrderCents ? `mínimo ${formatBRL(r.minOrderCents)}` : "sem mínimo"}</span>
            </p>
            <p className="text-xs text-fg-muted">
              Usos {r.usedCount}/{r.usageLimit ?? "∞"} · {r.startsAt || r.endsAt ? `${r.startsAt ? `de ${formatDate(r.startsAt)} ` : ""}${r.endsAt ? `até ${formatDate(r.endsAt)}` : ""}` : "sem prazo"}
              {mode === "admin" ? ` · ${r.storeName ?? "Mercatto (plataforma)"}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CopyButton value={r.code} variant="outline" size="sm" label="Copiar" aria-label={`Copiar código ${r.code}`} />
                {editLink(r, true)}
              </div>
              <Switch checked={r.isActive} disabled={pending} onChange={(e) => toggle(r, e.target.checked)} label="Ativo" aria-label={`Cupom ${r.code} ativo`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
