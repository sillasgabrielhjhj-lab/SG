import Link from "next/link";
import { BadgePercent, Plus, Zap } from "lucide-react";
import { listPromotions } from "@/features/marketing/queries";
import type { MarketingScope } from "@/features/marketing/service";
import { PromotionTable, type PromotionRow } from "@/features/marketing/components/promotion-table";
import { FilterTabs, buildListHref, type MarketingMode, type PromotionState } from "@/features/marketing/components/marketing-ui";
import { PageHeading } from "@/components/layout/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

const TABS: { value: PromotionState | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "SCHEDULED", label: "Agendadas" },
  { value: "EXPIRED", label: "Encerradas" },
  { value: "CANCELLED", label: "Canceladas" },
];
const STATES = new Set<string>(["ACTIVE", "SCHEDULED", "EXPIRED", "CANCELLED"]);

/** Lista de promoções com filtros na URL (?status= ?relampago=1 ?pagina=). */
export async function PromotionListView({ mode, scope, basePath, searchParams }: { mode: MarketingMode; scope: MarketingScope | { kind: "all" }; basePath: string; searchParams: Record<string, string | undefined> }) {
  const status = searchParams.status && STATES.has(searchParams.status) ? (searchParams.status as PromotionState) : undefined;
  const flash = searchParams.relampago === "1";
  const page = Math.max(1, Number.parseInt(searchParams.pagina ?? "1", 10) || 1);
  const data = await listPromotions(scope, { state: status, flash, page });
  const now = new Date();
  const href = (patch: Record<string, string | number | undefined>) => buildListHref(basePath, { status, relampago: flash ? "1" : undefined, ...patch });

  const rows: PromotionRow[] = data.items.map((p) => {
    const platform = p.store === null;
    const open = p.state === "ACTIVE" || p.state === "SCHEDULED";
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      value: p.value,
      isFlash: p.isFlash,
      state: p.state,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      relative: p.state === "ACTIVE" ? `Termina ${formatRelative(p.endsAt, now)}` : p.state === "SCHEDULED" ? `Começa ${formatRelative(p.startsAt, now)}` : p.state === "EXPIRED" ? `Encerrou ${formatRelative(p.endsAt, now)}` : "",
      soldCount: p.soldCount,
      stockLimit: p.stockLimit,
      productCount: p._count.items,
      categoryCount: p.categoryIds.length,
      storeName: p.store?.name ?? null,
      isOfficial: p.store?.isOfficial ?? false,
      campaignName: p.campaign?.name ?? null,
      editable: open && (mode === "seller" || platform),
      canDuplicate: mode === "seller" || platform,
    };
  });

  const filtered = Boolean(status || flash);
  return (
    <div>
      <PageHeading
        title="Promoções"
        description={mode === "seller" ? "Descontos por produto ou categoria da sua loja, com ofertas relâmpago." : `Todas as promoções do marketplace — da Mercatto e das lojas parceiras (${data.total}).`}
        actions={
          <ButtonLink href={`${basePath}/nova`} leftIcon={<Plus className="size-4" />}>
            Nova promoção
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs label="Filtrar por situação" className="min-w-0 flex-1" tabs={TABS.map((t) => ({ key: t.value || "all", label: t.label, href: href({ status: t.value || undefined }), active: (status ?? "") === t.value }))} />
        <Link
          href={href({ relampago: flash ? undefined : "1" })}
          aria-current={flash ? "true" : undefined}
          className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium focus-ring", flash ? "border-sun-500 bg-sun-300 font-semibold text-sun-900" : "border-line bg-surface text-fg-muted hover:border-sun-400")}
        >
          <Zap className="size-4" aria-hidden />
          Só ofertas relâmpago
          {flash ? <span className="sr-only"> (filtro ativo — clique para remover)</span> : null}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={<BadgePercent />}
            title={filtered ? "Nenhuma promoção encontrada" : "Nenhuma promoção criada"}
            description={filtered ? "Ajuste os filtros para ver outras promoções." : "Crie descontos com data para começar e terminar — eles aparecem automaticamente na loja."}
            action={<ButtonLink href={`${basePath}/nova`}>Criar promoção</ButtonLink>}
          />
        </div>
      ) : (
        <PromotionTable rows={rows} mode={mode} basePath={basePath} />
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => href({ pagina: p })} />
    </div>
  );
}
