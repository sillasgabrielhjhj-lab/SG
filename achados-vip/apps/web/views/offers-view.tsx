'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PriceLineChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { PriceCell, DiscountSeal } from '@/components/price';
import { ProductThumb } from '@/components/product-thumb';
import { ScoreBar, ScoreBreakdownList } from '@/components/score';
import { LinkStatusBadge, OfferStatusBadge, PublicationStatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { Drawer } from '@/components/ui/overlay';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { ApiError, api, errorMessage } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { formatBRL, formatDateTime, hostOf, safeHref } from '@/lib/format';
import { CHANNEL_TYPE, OFFER_KIND, OFFER_STATUS, OFFER_TIER, PUBLISH_BLOCK_HELP } from '@/lib/labels';
import type { OfferDetail, OfferDTO } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

const PAGE_SIZE = 20;

/** Explica erros de publicação (409 com `code`) em linguagem clara. */
export function formatPublishError(err: unknown): { title?: string; message: ReactNode } {
  if (err instanceof ApiError) {
    const known = PUBLISH_BLOCK_HELP[err.code];
    if (known) {
      return {
        title: known.title,
        message: (
          <>
            <span>{known.help}</span>
            {err.message && err.message !== known.help ? <span className="mt-1 block text-xs opacity-80">Detalhe do servidor: {err.message}</span> : null}
          </>
        ),
      };
    }
    if (err.status === 409) return { title: PUBLISH_BLOCK_HELP.CONFLICT!.title, message: err.message || PUBLISH_BLOCK_HELP.CONFLICT!.help };
  }
  return { message: errorMessage(err) };
}

// ------------------------------------------------------------------ ações

type ActionKind = 'approve' | 'reject' | 'publish';

const CAN: Record<ActionKind, (o: Pick<OfferDTO, 'status' | 'hasValidatedLink'>) => { ok: boolean; why?: string }> = {
  approve: (o) =>
    ['DISCOVERED', 'REJECTED', 'EXPIRED'].includes(o.status) ? { ok: true } : { ok: false, why: `Oferta já está "${OFFER_STATUS[o.status].label}".` },
  reject: (o) =>
    ['DISCOVERED', 'APPROVED', 'SUSPENDED', 'EXPIRED'].includes(o.status) ? { ok: true } : { ok: false, why: `Não é possível descartar uma oferta "${OFFER_STATUS[o.status].label}".` },
  publish: (o) => {
    if (o.status !== 'APPROVED') return { ok: false, why: 'Aprove a oferta antes de publicar.' };
    if (!o.hasValidatedLink) return { ok: false, why: 'Sem link de afiliado validado — cadastre e valide em Afiliados.' };
    return { ok: true };
  },
};

function useOfferActions(onDone: () => void) {
  const toast = useToast();
  const [action, setAction] = useState<{ kind: ActionKind; offer: Pick<OfferDTO, 'id' | 'status' | 'hasValidatedLink'> & { title: string } } | null>(null);
  const [note, setNote] = useState('');
  const [channelId, setChannelId] = useState('');
  const integ = useFetch('integrations-for-publish', (s) => api.integrations(s), { enabled: action?.kind === 'publish' });
  const channels = (integ.data?.channels ?? []).filter((c) => c.enabled);

  const open = (kind: ActionKind, offer: OfferDTO | OfferDetail) => {
    setNote('');
    setChannelId('');
    setAction({ kind, offer: { id: offer.id, status: offer.status, hasValidatedLink: offer.hasValidatedLink, title: offer.product.title } });
  };

  const confirm = async () => {
    if (!action) return;
    const { kind, offer } = action;
    if (kind === 'approve') {
      await api.approveOffer(offer.id, note.trim());
      toast.success('Oferta aprovada', 'Agora ela pode ser publicada.');
    } else if (kind === 'reject') {
      await api.rejectOffer(offer.id, note.trim());
      toast.success('Oferta descartada');
    } else {
      const res = await api.publishOffer(offer.id, channelId);
      const manual = res.publications.filter((p) => p.status === 'MANUAL_READY').length;
      const total = res.publications.length;
      if (total === 0) toast.info('Nenhuma publicação criada', 'O servidor não enfileirou envios para esta oferta.');
      else
        toast.success(
          `${total} publicação(ões) criada(s)`,
          manual > 0 ? `${manual} pronta(s) na Fila manual: copie o texto e marque como publicada depois de postar.` : 'Os envios seguem os horários e limites configurados.',
        );
    }
    onDone();
  };

  const labels = {
    approve: { title: 'Aprovar oferta', confirm: 'Aprovar', danger: false },
    reject: { title: 'Descartar oferta', confirm: 'Descartar', danger: true },
    publish: { title: 'Publicar oferta', confirm: 'Publicar', danger: false },
  } as const;

  const dialog = action ? (
    <ConfirmDialog
      open
      title={labels[action.kind].title}
      confirmLabel={labels[action.kind].confirm}
      danger={labels[action.kind].danger}
      onClose={() => setAction(null)}
      onConfirm={confirm}
      formatError={formatPublishError}
      description={<span className="line-clamp-3 font-medium text-fg">{action.offer.title}</span>}
    >
      {action.kind === 'publish' ? (
        <>
          <Notice tone="info">
            A publicação só é criada com link de afiliado validado. Canais manuais geram uma mensagem pronta na Fila manual (nada é enviado sozinho); sucesso só é registrado quando o canal confirma o envio.
          </Notice>
          <Field label="Canal" hint="Em branco: todos os canais ativos.">
            <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Todos os canais ativos</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {CHANNEL_TYPE[c.type]?.label ?? c.type}
                  {c.automatic ? '' : ' (manual)'}
                </option>
              ))}
            </select>
          </Field>
          {integ.error ? <p className="text-xs text-muted">Não foi possível listar os canais; a oferta será enviada para todos os canais ativos.</p> : null}
          {!integ.loading && channels.length === 0 && !integ.error ? (
            <Notice tone="warning">Nenhum canal ativo. Ative um canal em Integrações (ex.: Fila manual) para publicar.</Notice>
          ) : null}
        </>
      ) : (
        <Field label="Observação (opcional)">
          <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
    </ConfirmDialog>
  ) : null;

  return { open, dialog };
}

function ActionButtons({ offer, onOpen, size = 'sm', onlyAvailable }: { offer: OfferDTO | OfferDetail; onOpen: (k: ActionKind) => void; size?: 'sm' | 'md'; onlyAvailable?: boolean }) {
  const a = CAN.approve(offer);
  const r = CAN.reject(offer);
  const p = CAN.publish(offer);
  return (
    <>
      {!onlyAvailable || r.ok ? (
        <Button size={size} variant="ghost" disabled={!r.ok} title={r.why} onClick={() => onOpen('reject')}>
          Descartar
        </Button>
      ) : null}
      {!onlyAvailable || a.ok ? (
        <Button size={size} disabled={!a.ok} title={a.why} onClick={() => onOpen('approve')}>
          Aprovar
        </Button>
      ) : null}
      {!onlyAvailable || p.ok ? (
        <Button size={size} variant="primary" disabled={!p.ok} title={p.why} onClick={() => onOpen('publish')}>
          Publicar
        </Button>
      ) : null}
    </>
  );
}

/** Explica por que alguma ação está indisponível (title não é confiável em botões desabilitados). */
function ActionHint({ offer }: { offer: OfferDTO | OfferDetail }) {
  const p = CAN.publish(offer);
  if (p.ok) return null;
  return <p className="mr-auto max-w-xs text-xs text-muted">Publicar indisponível: {p.why}</p>;
}

// ------------------------------------------------------------------ detalhe

function OfferDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const detail = useFetch(`offer-${id}`, (s) => api.offer(id as string, s), { enabled: !!id });
  const toast = useToast();
  const [preview, setPreview] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const actions = useOfferActions(() => {
    void detail.reload();
    onChanged();
  });
  const o = detail.data;

  const latestObs = useMemo(() => {
    if (!o) return null;
    return [...o.priceHistory].sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0] ?? null;
  }, [o]);
  const advertised = latestObs?.originalPriceCents && latestObs.originalPriceCents > (o?.priceCents ?? 0) ? latestObs.originalPriceCents : null;

  const copy = async (text: string) => {
    if (await copyText(text)) toast.success('Texto copiado');
    else toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
  };

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={o?.product.title ?? 'Detalhes da oferta'}
        footer={
          o ? (
            <>
              <ActionHint offer={o} />
              <ActionButtons offer={o} size="md" onOpen={(k) => actions.open(k, o)} />
            </>
          ) : undefined
        }
      >
        {detail.loading || (!o && !detail.error) ? (
          <LoadingBlock rows={6} label="Carregando oferta…" />
        ) : detail.error && !o ? (
          <ErrorState error={detail.error} onRetry={() => void detail.reload()} title="Não foi possível carregar a oferta" />
        ) : o ? (
          <div className="space-y-6">
            <div className="flex gap-4">
              <ProductThumb src={o.product.thumbnail} alt={o.product.title} size={96} />
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <OfferStatusBadge status={o.status} />
                  <Badge tone={OFFER_TIER[o.tier]?.tone ?? 'neutral'}>{OFFER_TIER[o.tier]?.label ?? o.tier}</Badge>
                  <Badge tone="neutral" dot={false}>
                    {OFFER_KIND[o.kind] ?? o.kind}
                  </Badge>
                </div>
                <p className="text-sm text-muted">
                  {o.product.category?.name ?? 'Sem categoria'}
                  {o.product.sellerName ? ` · Vendedor: ${o.product.sellerName}` : ''}
                </p>
                {safeHref(o.product.permalink) ? (
                  <a href={safeHref(o.product.permalink)} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-sm">
                    Ver anúncio original ({hostOf(o.product.permalink)}) <Icon name="external" size={13} />
                  </a>
                ) : null}
                <p className="text-xs text-muted">Descoberta em {formatDateTime(o.discoveredAt)}</p>
              </div>
            </div>

            {o.status === 'SUSPENDED' ? <Notice tone="warning">Oferta suspensa: dados inconsistentes foram detectados. Ela não pode ser publicada até ser revalidada.</Notice> : null}
            {!o.hasValidatedLink ? (
              <Notice tone="warning" title="Sem link de afiliado validado">
                A publicação está bloqueada. Cadastre ou importe o link em{' '}
                <Link className="link font-medium" href={`/afiliados?productId=${encodeURIComponent(o.product.id)}`}>
                  Afiliados
                </Link>
                .
              </Notice>
            ) : null}

            <Card>
              <CardHeader title="Preço" actions={<DiscountSeal offer={o} advertisedOriginalCents={advertised} />} />
              <CardBody className="space-y-2">
                <p className="text-2xl font-semibold tabular-nums">{formatBRL(o.priceCents)}</p>
                {o.discountVerified && o.originalPriceCents != null ? (
                  <p className="text-sm text-muted">
                    Referência verificada: <s className="tabular-nums">{formatBRL(o.originalPriceCents)}</s>
                    {o.discountPct != null ? <span className="ml-2 font-medium text-success-ink">-{o.discountPct}%</span> : null}
                    {o.savingsCents != null ? <span className="ml-2">(economia de {formatBRL(o.savingsCents)})</span> : null}
                  </p>
                ) : advertised ? (
                  <Notice tone="warning">
                    A fonte anunciou preço original de <strong className="tabular-nums">{formatBRL(advertised)}</strong>, mas isso <strong>não foi verificado</strong> pelo histórico. O percentual não é exibido e a mensagem mostra só o preço atual.
                  </Notice>
                ) : (
                  <p className="text-sm text-muted">Sem preço de referência verificado: o percentual de desconto não é exibido.</p>
                )}
                {o.couponCode ? <p className="text-sm">Cupom informado pela fonte: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{o.couponCode}</code></p> : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Score" description="Critérios sem dado real contribuem 0 e são marcados como “sem dado”." />
              <CardBody className="space-y-4">
                <ScoreBar score={o.score} tier={o.tier} showTier />
                <ScoreBreakdownList breakdown={o.scoreBreakdown} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Histórico de preço" description="Observações do próprio sistema (não é histórico do Mercado Livre)." />
              <CardBody>
                {o.priceHistory.length === 0 ? (
                  <EmptyState title="Sem observações" description="O histórico é construído a cada busca. Ainda não há dados." />
                ) : (
                  <>
                    {o.priceHistory.length < 3 ? (
                      <Notice tone="info" className="mb-3">
                        Poucas observações ({o.priceHistory.length}): o histórico ainda é insuficiente para verificar descontos.
                      </Notice>
                    ) : null}
                    <PriceLineChart points={o.priceHistory.map((p) => ({ at: p.observedAt, priceCents: p.priceCents }))} />
                  </>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Links de afiliado" actions={<Link className="link text-xs" href={`/afiliados?productId=${encodeURIComponent(o.product.id)}`}>Gerenciar</Link>} />
              {o.affiliateLinks.length === 0 ? (
                <EmptyState title="Nenhum link cadastrado" description="Gere o link no portal oficial de afiliados e importe em Afiliados." />
              ) : (
                <ul className="divide-y divide-line">
                  {o.affiliateLinks.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm" title={l.url}>
                          {hostOf(l.url)}
                        </p>
                        {l.validationNote || l.lastError ? <p className="mt-0.5 break-words text-xs text-muted">{l.lastError ?? l.validationNote}</p> : null}
                      </div>
                      <LinkStatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Publicações desta oferta" />
              {o.publications.length === 0 ? (
                <EmptyState title="Ainda não publicada" />
              ) : (
                <ul className="divide-y divide-line">
                  {o.publications.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <div>
                        <p className="text-sm font-medium">{p.channelName}</p>
                        <p className="text-xs text-muted">{p.sentAt ? `Enviada em ${formatDateTime(p.sentAt)}` : p.scheduledFor ? `Agendada para ${formatDateTime(p.scheduledFor)}` : `Criada em ${formatDateTime(p.createdAt)}`}</p>
                        {p.lastError ? <p className="mt-0.5 break-words text-xs text-danger-ink">{p.lastError}</p> : null}
                      </div>
                      <PublicationStatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Prévia da mensagem" description="Como a mensagem sairia hoje (inclui o rodapé de divulgação configurado)." />
              <CardBody>
                {o.messagePreview ? (
                  <>
                    <Tabs
                      label="Formato da mensagem"
                      idPrefix="preview"
                      value={preview}
                      onChange={(v) => setPreview(v as 'whatsapp' | 'telegram')}
                      items={[
                        { id: 'whatsapp', label: 'WhatsApp' },
                        { id: 'telegram', label: 'Telegram (HTML)' },
                      ]}
                    />
                    <TabPanel id={preview} idPrefix="preview" active>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 p-3 font-sans text-sm">{o.messagePreview[preview]}</pre>
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" icon={<Icon name="copy" size={14} />} onClick={() => void copy(o.messagePreview![preview])}>
                          Copiar prévia
                        </Button>
                      </div>
                    </TabPanel>
                  </>
                ) : (
                  <p className="text-sm text-muted">Prévia indisponível: a mensagem só é montada com um link de afiliado validado.</p>
                )}
              </CardBody>
            </Card>
          </div>
        ) : null}
      </Drawer>
      {actions.dialog}
    </>
  );
}

// ------------------------------------------------------------------ lista

const STATUS_OPTIONS = Object.entries(OFFER_STATUS) as [keyof typeof OFFER_STATUS, { label: string }][];

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function OffersView() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sort, setSort] = useState('score');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const dq = useDebounced(q);
  const dMin = useDebounced(minScore);
  useEffect(() => setPage(1), [dq, status, categoryId, dMin, sort]);

  const cats = useFetch('categories', (s) => api.categories(s));
  const key = JSON.stringify({ dq, status, categoryId, dMin, sort, page });
  const list = useFetch(`offers-${key}`, (s) => api.offers({ q: dq.trim() || undefined, status: status || undefined, categoryId: categoryId || undefined, minScore: dMin === '' ? undefined : dMin, sort, page, pageSize: PAGE_SIZE }, s), { intervalMs: 30_000 });
  const actions = useOfferActions(() => void list.reload());
  const filtered = !!(dq || status || categoryId || dMin);

  const reset = () => {
    setQ('');
    setStatus('');
    setCategoryId('');
    setMinScore('');
    setSort('score');
  };

  return (
    <>
      <PageHeader title="Ofertas" description="Ofertas descobertas, com score e verificação de desconto. Nada é publicado sem link de afiliado validado." />

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-6">
          <Field label="Buscar" className="lg:col-span-2">
            <input className="input" type="search" placeholder="Título do produto…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoria">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Score mínimo">
            <input className="input" type="number" inputMode="numeric" min={0} max={100} placeholder="0–100" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
          </Field>
          <Field label="Ordenar por">
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score">Maior score</option>
              <option value="discoveredAt">Mais recentes</option>
              <option value="discountPct">Maior desconto verificado</option>
            </select>
          </Field>
        </div>

        {list.loading ? (
          <LoadingBlock rows={6} label="Carregando ofertas…" />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar as ofertas" />
        ) : list.data && list.data.items.length === 0 ? (
          <EmptyState
            title={filtered ? 'Nenhuma oferta com esses filtros' : 'Nenhuma oferta descoberta ainda'}
            description={filtered ? 'Ajuste ou limpe os filtros.' : 'Ative o monitoramento e execute uma busca em Automação. Enquanto não houver busca bem-sucedida, esta lista fica vazia — o painel não exibe exemplos.'}
            action={
              filtered ? (
                <Button size="sm" onClick={reset}>
                  Limpar filtros
                </Button>
              ) : (
                <Link href="/automacao" className="link text-sm">
                  Ir para Automação
                </Link>
              )
            }
          />
        ) : list.data ? (
          <>
            {list.error ? (
              <div className="p-4 pb-0 sm:px-5">
                <Notice tone="warning" title="Falha ao atualizar">
                  {list.error.message}
                </Notice>
              </div>
            ) : null}
            <Table caption="Lista de ofertas">
              <THead>
                <Tr>
                  <Th>Produto</Th>
                  <Th>Preço</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                  <Th className="hidden 2xl:table-cell">Descoberta</Th>
                  <Th className="hidden text-right lg:table-cell">Ações</Th>
                </Tr>
              </THead>
              <TBody>
                {list.data.items.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <div className="flex min-w-[220px] items-start gap-3">
                        <ProductThumb src={o.product.thumbnail} alt={o.product.title} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => setOpenId(o.id)} className="line-clamp-2 rounded text-left text-sm font-medium text-fg hover:text-primary-ink hover:underline">
                            {o.product.title}
                          </button>
                          <p className="mt-0.5 text-xs text-muted">{o.product.category?.name ?? 'Sem categoria'}</p>
                          {!o.hasValidatedLink ? <p className="mt-0.5 text-xs text-warning-ink">Sem link de afiliado validado</p> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <PriceCell offer={o} />
                    </Td>
                    <Td>
                      <ScoreBar score={o.score} tier={o.tier} />
                    </Td>
                    <Td>
                      <OfferStatusBadge status={o.status} />
                    </Td>
                    <Td className="hidden whitespace-nowrap text-xs text-muted 2xl:table-cell">{formatDateTime(o.discoveredAt)}</Td>
                    <Td className="hidden lg:table-cell">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setOpenId(o.id)}>
                          Detalhes
                        </Button>
                        <ActionButtons offer={o} onlyAvailable onOpen={(k) => actions.open(k, o)} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <div className="border-t border-line p-3 lg:hidden">
              <p className="text-xs text-muted">Toque no título para ver detalhes e aprovar, descartar ou publicar.</p>
            </div>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} busy={list.fetching} />
          </>
        ) : null}
      </Card>

      <OfferDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => void list.reload()} />
      {actions.dialog}
    </>
  );
}
