import Link from "next/link";
import { ExternalLink, Megaphone, Pencil, Plus } from "lucide-react";
import { listCampaigns } from "@/features/marketing/queries";
import { CAMPAIGN_STATE, StateBadge, buildListHref, campaignState } from "@/features/marketing/components/marketing-ui";
import { PageHeading } from "@/components/layout/page-heading";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";

function Swatch({ color }: { color: string | null }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full border border-line" style={{ backgroundColor: color ?? "var(--color-brand-800)" }} />;
}

/** Lista de campanhas (admin) com link para a página pública /campanha/<slug>. */
export async function CampaignListView({ basePath, searchParams }: { basePath: string; searchParams: Record<string, string | undefined> }) {
  const page = Math.max(1, Number.parseInt(searchParams.pagina ?? "1", 10) || 1);
  const data = await listCampaigns(page);
  const now = new Date();
  const rows = data.items.map((c) => ({ ...c, state: campaignState(c, now) }));

  return (
    <div>
      <PageHeading
        title="Campanhas"
        description="Páginas temáticas (ex.: Semana Mercatto) que agrupam promoções da plataforma."
        actions={
          <ButtonLink href={`${basePath}/nova`} leftIcon={<Plus className="size-4" />}>
            Nova campanha
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState icon={<Megaphone />} title="Nenhuma campanha criada" description="Crie uma campanha e vincule promoções da plataforma a ela para ganhar uma página própria na loja." action={<ButtonLink href={`${basePath}/nova`}>Criar campanha</ButtonLink>} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Campanha
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Período
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Promoções
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Situação
                  </th>
                  <th scope="col" className="px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-surface-muted/50">
                    <td className="max-w-96 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Swatch color={c.themeColor} />
                        <Link href={`${basePath}/${c.id}`} className="font-semibold hover:underline">
                          {c.name}
                        </Link>
                      </div>
                      <Link href={`/campanha/${c.slug}`} target="_blank" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                        /campanha/{c.slug} <ExternalLink className="size-3" aria-hidden />
                        <span className="sr-only">(abre em nova aba)</span>
                      </Link>
                      {c.description ? <p className="line-clamp-1 text-xs text-fg-muted">{c.description}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <span className="block">{formatDateTime(c.startsAt)}</span>
                      <span className="block">até {formatDateTime(c.endsAt)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular">{c._count.promotions}</td>
                    <td className="px-3 py-3">
                      <StateBadge meta={CAMPAIGN_STATE[c.state]} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ButtonLink href={`${basePath}/${c.id}`} variant="ghost" size="sm" leftIcon={<Pencil className="size-4" />} aria-label={`Editar campanha ${c.name}`}>
                        Editar
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`${basePath}/${c.id}`} className="flex min-w-0 items-center gap-2 font-semibold">
                    <Swatch color={c.themeColor} />
                    <span className="min-w-0 break-words">{c.name}</span>
                  </Link>
                  <StateBadge meta={CAMPAIGN_STATE[c.state]} size="xs" />
                </div>
                <p className="text-xs text-fg-muted">
                  {formatDateTime(c.startsAt)} até {formatDateTime(c.endsAt)} · {c._count.promotions} promoção(ões)
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/campanha/${c.slug}`} target="_blank" className="inline-flex min-w-0 items-center gap-1 text-xs font-medium break-all text-brand-700 hover:underline">
                    /campanha/{c.slug} <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="sr-only">(abre em nova aba)</span>
                  </Link>
                  <Link href={`${basePath}/${c.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                    Editar<span className="sr-only"> {c.name}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Pagination className="mt-6" page={data.page} totalPages={data.totalPages} buildHref={(p) => buildListHref(basePath, { pagina: p })} />
    </div>
  );
}
