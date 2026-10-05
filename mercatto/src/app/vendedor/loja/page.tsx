import Link from "next/link";
import { Ban, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import type { StoreStatus } from "@/generated/prisma/enums";
import { requireSellerPage } from "@/server/auth/guards";
import { env } from "@/server/env";
import { getStoreSettingsForSeller } from "@/features/seller/service";
import { ShippingRulesEditor, StoreProfileForm } from "@/features/seller/components/store-forms";
import { RatingStars } from "@/components/commerce/rating";
import { OfficialBadge } from "@/components/commerce/badges";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Dados e frete" };

const STATUS: Record<StoreStatus, { label: string; tone: BadgeTone; icon: React.ReactNode; description: string }> = {
  ACTIVE: { label: "Ativa", tone: "success", icon: <CheckCircle2 className="size-3.5" aria-hidden />, description: "Sua loja e seus anúncios publicados estão visíveis na vitrine." },
  PENDING: { label: "Em análise", tone: "warning", icon: <Clock className="size-3.5" aria-hidden />, description: "A equipe Mercatto está analisando seu cadastro. Os produtos poderão ser publicados após a aprovação." },
  SUSPENDED: { label: "Suspensa", tone: "danger", icon: <Ban className="size-3.5" aria-hidden />, description: "Seus anúncios não aparecem na vitrine. Fale com o suporte para regularizar a loja." },
};

export default async function SellerStorePage() {
  const user = await requireSellerPage("/vendedor/loja");
  const store = await getStoreSettingsForSeller(user.storeId);
  const status = STATUS[store.status];
  const publicPath = store.isOfficial ? "/oficial" : `/loja/${store.slug}`;
  const publicUrl = `${env.APP_URL.replace(/\/$/, "")}${publicPath}`;
  const closed = store.salesCount + store.cancelledCount;
  const cancelRate = closed ? (store.cancelledCount / closed) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeading className="mb-0" title="Dados e frete" description="Status da loja, reputação, dados de contato e tabela de frete." />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-lg font-bold break-words">{store.name}</h2>
            {store.isOfficial ? <OfficialBadge /> : null}
            <Badge tone={status.tone} size="sm" icon={status.icon}>
              {status.label}
            </Badge>
          </div>
          <p className="-mt-2 text-sm text-fg-muted">{status.description}</p>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-md bg-surface-muted/60 p-3">
              <dt className="text-xs font-medium text-fg-muted">Avaliação</dt>
              <dd className="mt-1">{store.ratingCount ? <RatingStars value={store.ratingAvg} count={store.ratingCount} showValue /> : <span className="text-sm text-fg-subtle">Ainda sem avaliações</span>}</dd>
            </div>
            <div className="rounded-md bg-surface-muted/60 p-3">
              <dt className="text-xs font-medium text-fg-muted">Vendas concluídas</dt>
              <dd className="mt-1 text-lg font-bold tabular">{formatNumber(store.salesCount)}</dd>
            </div>
            <div className="rounded-md bg-surface-muted/60 p-3">
              <dt className="text-xs font-medium text-fg-muted">Taxa de cancelamento</dt>
              <dd className="mt-1 text-lg font-bold tabular">
                {cancelRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                <span className="ml-1 text-xs font-normal text-fg-subtle">({formatNumber(store.cancelledCount)} cancelado(s))</span>
              </dd>
            </div>
            <div className="rounded-md bg-surface-muted/60 p-3">
              <dt className="text-xs font-medium text-fg-muted">Na Mercatto desde</dt>
              <dd className="mt-1 text-lg font-bold tabular">{formatDate(store.createdAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-muted">Endereço público da loja</p>
              <p className="text-sm font-semibold break-all">{publicUrl}</p>
              {store.status !== "ACTIVE" ? <p className="text-xs text-fg-subtle">{store.status === "PENDING" ? "Disponível após a aprovação da loja." : "Indisponível enquanto a loja estiver suspensa."}</p> : null}
            </div>
            {store.status === "ACTIVE" ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyButton value={publicUrl} variant="outline" size="sm" label="Copiar link" />
                <ButtonLink href={publicPath} target="_blank" rel="noopener" variant="secondary" size="sm" rightIcon={<ExternalLink className="size-4" aria-hidden />}>
                  Ver loja
                  <span className="sr-only"> (abre em nova aba)</span>
                </ButtonLink>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card id="dados">
        <CardHeader title="Dados da loja" description="Exibidos na página da loja e usados para envios e repasses." />
        <CardBody>
          <StoreProfileForm
            mode="edit"
            initial={{
              name: store.name,
              description: store.description ?? "",
              document: store.document ?? "",
              contactEmail: store.contactEmail ?? "",
              contactPhone: store.contactPhone ?? "",
              originCep: store.originCep,
              originCity: store.originCity ?? "",
              originState: store.originState?.trim() ?? "",
            }}
          />
        </CardBody>
      </Card>

      <Card id="frete">
        <CardHeader title="Tabela de frete" description="Preços e prazos por destino e faixa de peso, calculados a partir do seu CEP de origem." />
        <CardBody className="flex flex-col gap-4">
          {store.isOfficial ? (
            <Alert tone="info" title="Loja oficial: frete e regras gerenciados pela administração">
              A loja oficial Mercatto é operada pela equipe administrativa. Políticas como frete grátis a partir de um valor mínimo e as demais regras da loja oficial são definidas no <Link href="/admin/configuracoes">painel administrativo</Link>; a tabela abaixo ({formatNumber(store.shippingRules.length)} regra(s)) define preços e prazos dos envios dos produtos oficiais.
            </Alert>
          ) : null}
          <ShippingRulesEditor
            initial={store.shippingRules.map((r) => ({
              name: r.name,
              regionCode: r.regionCode,
              maxWeightGrams: r.maxWeightGrams,
              priceCents: r.priceCents,
              additionalKgCents: r.additionalKgCents,
              minDays: r.minDays,
              maxDays: r.maxDays,
              isActive: r.isActive,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
