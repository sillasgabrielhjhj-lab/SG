'use client';

import Link from 'next/link';
import { BarChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { JobsTable } from '@/components/jobs-table';
import { NotificationsList } from '@/components/notifications-list';
import { IntegrationBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DefList, PageHeader, Stat } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatBRL, formatDateTime, formatNumber, formatRelative, formatSeriesDate, formatTime } from '@/lib/format';
import { CHANNEL_TYPE } from '@/lib/labels';
import type { DashboardData } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

const POLL_MS = 15_000;

function monitoringBadge(m: DashboardData['monitoring']) {
  if (!m.enabled) return <Badge tone="neutral">Monitoramento desligado</Badge>;
  if (m.status === 'RUNNING') return <Badge tone="info">Executando agora</Badge>;
  if (m.status === 'FAILED' || (m.lastError && !m.lastSuccessAt)) return <Badge tone="danger">Última execução falhou</Badge>;
  if (!m.lastRunAt) return <Badge tone="warning">Aguardando a 1ª execução</Badge>;
  return <Badge tone="success">Ativo</Badge>;
}

export function DashboardView() {
  const dash = useFetch('dashboard', (s) => api.dashboard(s), { intervalMs: POLL_MS });
  const notifs = useFetch('dashboard-notifications', (s) => api.notifications(s), { intervalMs: POLL_MS });
  const report = useFetch('report-30', (s) => api.reportSummary(30, s), { intervalMs: 60_000 });
  const d = dash.data;
  const unread = (notifs.data ?? []).filter((n) => !n.read);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral do monitoramento, das integrações e das publicações. Atualiza sozinho a cada 15 segundos."
        actions={
          <>
            {dash.updatedAt ? <span className="text-xs text-muted">Atualizado às {formatTime(dash.updatedAt)}</span> : null}
            <Button size="sm" onClick={() => void dash.reload()} loading={dash.fetching && !!d} icon={<Icon name="refresh" size={14} />}>
              Atualizar
            </Button>
          </>
        }
      />

      {dash.loading ? (
        <Card>
          <LoadingBlock rows={6} label="Carregando o dashboard…" />
        </Card>
      ) : dash.error && !d ? (
        <Card>
          <ErrorState error={dash.error} onRetry={() => void dash.reload()} title="Não foi possível carregar o dashboard" />
        </Card>
      ) : d ? (
        <div className="space-y-6">
          {dash.error ? (
            <Notice tone="warning" title="Falha ao atualizar">
              Exibindo os últimos dados recebidos. {dash.error.message}
            </Notice>
          ) : null}

          {/* Status */}
          <section aria-label="Status do sistema" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Monitoramento" actions={monitoringBadge(d.monitoring)} />
              <CardBody>
                <DefList
                  items={[
                    { label: 'Intervalo', value: `${d.monitoring.intervalMinutes} min` },
                    { label: 'Última execução', value: <span title={formatDateTime(d.monitoring.lastRunAt)}>{d.monitoring.lastRunAt ? formatRelative(d.monitoring.lastRunAt) : 'Nunca executou'}</span> },
                    { label: 'Último sucesso', value: <span title={formatDateTime(d.monitoring.lastSuccessAt)}>{d.monitoring.lastSuccessAt ? formatRelative(d.monitoring.lastSuccessAt) : 'Nunca'}</span> },
                  ]}
                />
                {d.monitoring.lastError ? (
                  <Notice tone="danger" title="Último erro" className="mt-3">
                    <span className="break-words">{d.monitoring.lastError}</span>
                  </Notice>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Publicação automática" actions={<Badge tone={d.autoPublish ? 'success' : 'neutral'}>{d.autoPublish ? 'Ligada' : 'Desligada'}</Badge>} />
              <CardBody className="space-y-2 text-sm text-muted">
                <p>
                  {d.autoPublish
                    ? 'Ofertas aprovadas com link de afiliado validado são enviadas respeitando horários e limites.'
                    : 'Nada é enviado sozinho: ofertas aguardam sua aprovação e publicação manual.'}
                </p>
                <p className="text-xs">Nenhuma oferta é publicada sem link de afiliado validado.</p>
                <Link href="/automacao" className="link inline-block text-sm">
                  Ajustar em Automação
                </Link>
              </CardBody>
            </Card>

            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader title="Fonte de ofertas" actions={<IntegrationBadge status={d.source.status} />} />
              <CardBody className="space-y-2">
                <p className="text-sm font-medium">{d.source.name}</p>
                {/fixture/i.test(d.source.name) ? <Notice tone="warning">Fonte de teste (fixture): os dados NÃO são ofertas reais.</Notice> : null}
                <p className="break-words text-sm text-muted">{d.source.detail ?? 'Sem detalhes de status.'}</p>
                <Link href="/integracoes" className="link inline-block text-sm">
                  Ver integrações
                </Link>
              </CardBody>
            </Card>
          </section>

          {/* Hoje */}
          <section aria-labelledby="hoje-titulo">
            <h2 id="hoje-titulo" className="mb-3 text-sm font-semibold">
              Hoje <span className="font-normal text-muted">(fuso de São Paulo)</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <Stat label="Ofertas descobertas" value={formatNumber(d.today.discovered)} />
              <Stat label="Aprovadas" value={formatNumber(d.today.approved)} />
              <Stat label="Publicadas" value={formatNumber(d.today.published)} hint="com confirmação" tone="success" />
              <Stat label="Pendentes" value={formatNumber(d.today.pending)} hint="aguardando envio" />
              <Stat label="Erros" value={formatNumber(d.today.failed)} hint="falhas de publicação" tone={d.today.failed > 0 ? 'danger' : undefined} />
            </div>
          </section>

          {/* Série + pendências */}
          <section className="grid items-start gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Últimos 14 dias" description="Ofertas descobertas, aprovadas e publicadas por dia." />
              <CardBody>
                {d.series.length === 0 ? (
                  <EmptyState title="Sem dados no período" description="A série aparece depois da primeira busca de ofertas." />
                ) : (
                  <BarChart
                    ariaLabel="Gráfico de barras: ofertas descobertas, aprovadas e publicadas nos últimos 14 dias"
                    data={d.series.map((p) => ({ label: formatSeriesDate(p.date), values: { discovered: p.discovered, approved: p.approved, published: p.published } }))}
                    series={[
                      { key: 'discovered', label: 'Descobertas', className: 'fill-info' },
                      { key: 'approved', label: 'Aprovadas', className: 'fill-primary' },
                      { key: 'published', label: 'Publicadas', className: 'fill-success' },
                    ]}
                  />
                )}
              </CardBody>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="Links de afiliado pendentes" />
                <CardBody className="space-y-3">
                  <p className="text-3xl font-semibold tabular-nums">{formatNumber(d.pendingAffiliateLinks)}</p>
                  <p className="text-sm text-muted">
                    {d.pendingAffiliateLinks > 0
                      ? 'Produtos qualificados aguardando link de afiliado validado. Sem o link, não há publicação.'
                      : 'Nenhum produto aguardando link de afiliado.'}
                  </p>
                  <Link href="/afiliados" className={buttonClass(d.pendingAffiliateLinks > 0 ? 'primary' : 'secondary', 'sm')}>
                    Abrir Afiliados
                  </Link>
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Notificações"
                  description={unread.length > 0 ? `${unread.length} não lida(s)` : 'Tudo em dia'}
                  actions={
                    <Link href="/configuracoes?tab=alertas" className="link text-xs">
                      Ver todas
                    </Link>
                  }
                />
                {notifs.error && !notifs.data ? (
                  <ErrorState compact error={notifs.error} onRetry={() => void notifs.reload()} title="Não foi possível carregar as notificações" />
                ) : (
                  <NotificationsList items={unread} limit={4} onChanged={() => void notifs.reload()} emptyText="Nenhuma notificação não lida." />
                )}
              </Card>
            </div>
          </section>

          {/* Integrações + jobs */}
          <section className="grid items-start gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Integrações" description="Status real, vindo dos últimos testes de conexão." actions={<Link href="/integracoes" className="link text-xs">Gerenciar</Link>} />
              {d.integrations.length === 0 ? (
                <EmptyState title="Nenhuma integração configurada" description="Configure a fonte de ofertas e ao menos um canal em Integrações." />
              ) : (
                <ul className="divide-y divide-line">
                  {d.integrations.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{i.name}</p>
                        <p className="text-xs text-muted">{CHANNEL_TYPE[i.type as keyof typeof CHANNEL_TYPE]?.label ?? i.type}</p>
                        {i.statusDetail ? <p className="mt-1 break-words text-xs text-muted">{i.statusDetail}</p> : null}
                        <p className="mt-1 text-[11px] text-muted">{i.lastCheckedAt ? `Verificado ${formatRelative(i.lastCheckedAt)}` : 'Nunca verificado'}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <IntegrationBadge status={i.status} />
                        {!i.enabled ? <Badge tone="neutral">Desativado</Badge> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Tarefas e jobs" description="Execuções agendadas em segundo plano." />
              <JobsTable jobs={d.jobs} />
            </Card>
          </section>

          {/* Relatório 30 dias */}
          <section aria-labelledby="rel-titulo">
            <h2 id="rel-titulo" className="mb-3 text-sm font-semibold">
              Resumo dos últimos 30 dias
            </h2>
            {report.loading ? (
              <Card>
                <LoadingBlock rows={2} />
              </Card>
            ) : report.error && !report.data ? (
              <Card>
                <ErrorState compact error={report.error} onRetry={() => void report.reload()} title="Não foi possível carregar o resumo" />
              </Card>
            ) : report.data ? (
              <div className="grid items-start gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Encontradas" value={formatNumber(report.data.found)} />
                      <Stat label="Aprovadas" value={formatNumber(report.data.approved)} />
                      <Stat label="Publicadas" value={formatNumber(report.data.published)} tone="success" />
                      <Stat label="Falhas" value={formatNumber(report.data.failed)} tone={report.data.failed > 0 ? 'danger' : undefined} />
                    </div>
                  </CardBody>
                  {report.data.byCategory.length > 0 ? (
                    <Table caption="Desempenho por categoria nos últimos 30 dias">
                      <THead>
                        <Tr>
                          <Th>Categoria</Th>
                          <Th className="text-right">Encontradas</Th>
                          <Th className="text-right">Qualificadas</Th>
                          <Th className="text-right">Publicadas</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {report.data.byCategory.map((c) => (
                          <Tr key={c.categoryId}>
                            <Td>{c.name}</Td>
                            <Td className="text-right tabular-nums">{formatNumber(c.found)}</Td>
                            <Td className="text-right tabular-nums">{formatNumber(c.qualified)}</Td>
                            <Td className="text-right tabular-nums">{formatNumber(c.published)}</Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  ) : null}
                </Card>
                <div className="space-y-4">
                  <Card>
                    <CardHeader title="Cliques, vendas e comissões" />
                    <CardBody>
                      {report.data.affiliateMetrics.available ? (
                        <p className="text-sm text-muted">Métricas disponíveis.</p>
                      ) : (
                        <Notice tone="info" title="Indisponível">
                          {report.data.affiliateMetrics.reason ?? 'Não há fonte autorizada para estes números; por isso o painel não exibe valores.'}
                        </Notice>
                      )}
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader title="Quedas de preço recentes" />
                    {report.data.recentPriceDrops.length === 0 ? (
                      <EmptyState title="Nenhuma queda registrada" />
                    ) : (
                      <ul className="divide-y divide-line">
                        {report.data.recentPriceDrops.slice(0, 5).map((p) => (
                          <li key={`${p.productId}-${p.at}`} className="px-4 py-3 sm:px-5">
                            <p className="line-clamp-2 text-sm">{p.title}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {formatBRL(p.fromCents)} → <span className="font-medium text-fg">{formatBRL(p.toCents)}</span> ({p.pct}% menor) · {formatDateTime(p.at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
