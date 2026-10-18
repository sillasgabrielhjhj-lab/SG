'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { LinkStatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader, Stat } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { formatDateTime, formatNumber, hostOf, safeHref } from '@/lib/format';
import { LINK_KIND } from '@/lib/labels';
import type { AffiliateLinkDTO, ImportResult, PendingProduct } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type TabId = 'links' | 'importar' | 'pendentes' | 'historico';
interface ProductRef {
  id: string;
  title?: string;
}

// ------------------------------------------------------------------ tabela de links

function LinksTable({
  query,
  onProduct,
  onChanged,
  emptyTitle,
  emptyDescription,
  idKey,
}: {
  query: { status?: string; productId?: string };
  onProduct?: (p: ProductRef) => void;
  onChanged: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  idKey: string;
}) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const queryKey = JSON.stringify(query);
  useEffect(() => setPage(1), [queryKey]);
  const key = `links-${idKey}-${queryKey}-${page}`;
  const list = useFetch(key, (s) => api.affiliateLinks({ ...query, page }, s));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AffiliateLinkDTO | null>(null);

  const validate = async (l: AffiliateLinkDTO) => {
    setBusyId(l.id);
    try {
      const r = await api.validateAffiliateLink(l.id);
      if (r.status === 'VALIDATED') toast.success('Link validado');
      else if (r.status === 'INVALID') toast.warning('Link inválido', r.lastError ?? r.validationNote ?? undefined);
      else toast.info('Link continua pendente', r.validationNote ?? undefined);
      await list.reload();
      onChanged();
    } catch (e) {
      toast.fromError(e, 'Não foi possível validar');
    } finally {
      setBusyId(null);
    }
  };

  if (list.loading) return <LoadingBlock rows={5} label="Carregando links…" />;
  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar os links" />;
  if (!list.data || list.data.items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <>
      <Table caption="Links de afiliado">
        <THead>
          <Tr>
            <Th>Produto</Th>
            <Th>Link</Th>
            <Th>Status</Th>
            <Th className="hidden lg:table-cell">Cadastro</Th>
            <Th className="text-right">Ações</Th>
          </Tr>
        </THead>
        <TBody>
          {list.data.items.map((l) => (
            <Tr key={l.id}>
              <Td>
                <div className="min-w-[180px] max-w-xs">
                  {onProduct ? (
                    <button type="button" className="line-clamp-2 rounded text-left text-sm font-medium hover:text-primary-ink hover:underline" onClick={() => onProduct({ id: l.productId, title: l.productTitle })} title="Ver histórico deste produto">
                      {l.productTitle}
                    </button>
                  ) : (
                    <p className="line-clamp-2 text-sm font-medium">{l.productTitle}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted">{LINK_KIND[l.kind] ?? l.kind}</p>
                </div>
              </Td>
              <Td>
                <p className="max-w-[240px] truncate font-mono text-xs" title={l.url}>
                  {l.url}
                </p>
                {l.status === 'INVALID' && (l.lastError || l.validationNote) ? <p className="mt-1 max-w-[260px] break-words text-xs text-danger-ink">{l.lastError ?? l.validationNote}</p> : null}
                {l.status !== 'INVALID' && l.validationNote ? <p className="mt-1 max-w-[260px] break-words text-xs text-muted">{l.validationNote}</p> : null}
              </Td>
              <Td>
                <LinkStatusBadge status={l.status} />
                {l.validatedAt ? <p className="mt-1 text-[11px] text-muted">{formatDateTime(l.validatedAt)}</p> : null}
              </Td>
              <Td className="hidden whitespace-nowrap text-xs text-muted lg:table-cell">{formatDateTime(l.createdAt)}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  {l.status !== 'VALIDATED' ? (
                    <Button size="sm" onClick={() => void validate(l)} loading={busyId === l.id}>
                      Validar
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(l)} aria-label={`Remover link de ${l.productTitle}`}>
                    <Icon name="trash" size={14} />
                    Remover
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} busy={list.fetching} />

      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Remover link de afiliado"
        confirmLabel="Remover"
        description={
          toDelete?.status === 'VALIDATED'
            ? 'Este link está validado. Ao removê-lo, o produto volta a ficar sem link e não poderá ser publicado até um novo link ser validado.'
            : 'O link será removido. Esta ação não pode ser desfeita.'
        }
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await api.deleteAffiliateLink(toDelete.id);
          toast.success('Link removido');
          await list.reload();
          onChanged();
        }}
      />
    </>
  );
}

// ------------------------------------------------------------------ importação

function ImportPanel({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 1_000_000) {
      toast.error('Arquivo muito grande', 'Use um arquivo de até 1 MB.');
      return;
    }
    const content = await f.text();
    setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${content}` : content));
    toast.info('Arquivo carregado', `${f.name} — revise o conteúdo e clique em Importar.`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.importAffiliateLinks(text);
      setResult(r);
      onDone();
      if (r.imported > 0) toast.success(`${r.imported} link(s) importado(s)`, `${r.validated} validado(s).`);
      else toast.warning('Nenhum link importado', 'Veja o detalhe das linhas abaixo.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Importar links em lote" description="Cole as linhas ou envie um arquivo CSV/TXT. Cada link importado é validado antes de liberar publicação." />
        <CardBody>
          <form onSubmit={submit} className="space-y-3">
            <Notice tone="info" title="Formato aceito (uma linha por produto)">
              <code className="block break-all font-mono text-xs">URL_DO_ANUNCIO_ML ; URL_DE_AFILIADO</code>
              <code className="block break-all font-mono text-xs">MLB123456789 ; URL_DE_AFILIADO</code>
              <span className="mt-1 block">Separadores aceitos: ponto e vírgula, vírgula ou TAB. Gere os links no portal oficial de afiliados — o sistema não automatiza o portal.</span>
            </Notice>
            <Field label="Linhas para importar" hint={`${formatNumber(lines)} linha(s) não vazia(s)`}>
              <textarea className="input min-h-[180px] font-mono text-xs" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://www.mercadolivre.com.br/…/p/MLB123 ; https://meli.la/abc123'} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
                Importar
              </Button>
              <label className={buttonClass('secondary', 'md', 'cursor-pointer')}>
                <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e)} />
                Carregar arquivo CSV…
              </label>
              {text ? (
                <Button variant="ghost" onClick={() => { setText(''); setResult(null); setError(null); }}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      {error ? <Notice tone="danger" title="Falha na importação">{error}</Notice> : null}

      {result ? (
        <Card>
          <CardHeader title="Resultado da importação" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Importados" value={formatNumber(result.imported)} />
              <Stat label="Validados" value={formatNumber(result.validated)} tone="success" />
              <Stat label="Inválidos" value={formatNumber(result.invalid.length)} tone={result.invalid.length ? 'danger' : undefined} />
              <Stat label="Sem produto" value={formatNumber(result.unmatched.length)} hint="não encontrados" tone={result.unmatched.length ? 'warning' : undefined} />
            </div>
            {result.imported > result.validated ? (
              <Notice tone="warning">
                {result.imported - result.validated} link(s) foram importados mas ainda <strong>não validados</strong>. Eles ficam pendentes e não liberam publicação; revise na aba Links.
              </Notice>
            ) : null}
            <IssueTable title="Linhas inválidas" rows={result.invalid} />
            <IssueTable title="Linhas sem produto correspondente" rows={result.unmatched} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function IssueTable({ title, rows }: { title: string; rows: { line: number; reason: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        {title} ({rows.length})
      </h3>
      <div className="overflow-hidden rounded-lg border border-line">
        <Table caption={title}>
          <THead>
            <Tr>
              <Th className="w-20">Linha</Th>
              <Th>Motivo</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r, i) => (
              <Tr key={`${r.line}-${i}`}>
                <Td className="tabular-nums">{r.line}</Td>
                <Td className="break-words">{r.reason}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pendentes

function PendingPanel({ onProduct, onChanged }: { onProduct: (p: ProductRef) => void; onChanged: () => void }) {
  const toast = useToast();
  const list = useFetch('affiliate-pending', (s) => api.affiliatePending(s));
  const [adding, setAdding] = useState<PendingProduct | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const copyLink = async (p: PendingProduct) => {
    if (await copyText(p.permalink)) toast.success('Link do anúncio copiado');
    else toast.error('Não foi possível copiar');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!adding) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.addAffiliateLink(adding.productId, url.trim());
      if (r.status === 'VALIDATED') toast.success('Link cadastrado e validado');
      else if (r.status === 'INVALID') toast.warning('Link cadastrado, mas inválido', r.lastError ?? r.validationNote ?? undefined);
      else toast.info('Link cadastrado — validação pendente', r.validationNote ?? undefined);
      setAdding(null);
      setUrl('');
      await list.reload();
      onChanged();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Produtos aguardando link de afiliado"
        description="Aprovados/qualificados sem link validado. Exporte, gere os links no portal oficial e importe de volta."
        actions={
          <a href={api.affiliatePendingCsvUrl} download="pendentes-afiliado.csv" className={buttonClass('secondary', 'sm')}>
            <Icon name="download" size={14} />
            Exportar CSV
          </a>
        }
      />
      {list.loading ? (
        <LoadingBlock rows={4} />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.reload()} />
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState title="Nenhum produto pendente" description="Todos os produtos qualificados já têm link de afiliado validado." />
      ) : (
        <Table caption="Produtos pendentes de link de afiliado">
          <THead>
            <Tr>
              <Th>Produto</Th>
              <Th className="hidden sm:table-cell">Score</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {list.data.map((p) => (
              <Tr key={p.productId}>
                <Td>
                  <p className="line-clamp-2 min-w-[200px] text-sm font-medium">{p.title}</p>
                  {safeHref(p.permalink) ? (
                    <a href={safeHref(p.permalink)} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 text-xs">
                      Abrir anúncio ({hostOf(p.permalink)}) <Icon name="external" size={12} />
                    </a>
                  ) : null}
                </Td>
                <Td className="hidden tabular-nums sm:table-cell">{p.score ?? '—'}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void copyLink(p)} icon={<Icon name="copy" size={13} />}>
                      Copiar URL ML
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onProduct({ id: p.productId, title: p.title })}>
                      Histórico
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => { setAdding(p); setUrl(''); setErr(null); }}>
                      Adicionar link
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={!!adding}
        onClose={() => !busy && setAdding(null)}
        title="Adicionar link de afiliado"
        description={adding?.title}
        dismissible={!busy}
        footer={
          <>
            <Button onClick={() => setAdding(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-add-link" loading={busy} disabled={!url.trim()}>
              Cadastrar e validar
            </Button>
          </>
        }
      >
        <form id="form-add-link" onSubmit={submit} className="space-y-3">
          {err ? <Notice tone="danger">{err}</Notice> : null}
          <Field label="URL de afiliado" hint="Link gerado no portal oficial de afiliados do Mercado Livre (https)." required>
            <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meli.la/…" autoComplete="off" />
          </Field>
          <p className="text-xs text-muted">O link será validado (domínio permitido, formato e produto de destino). Só links validados liberam a publicação.</p>
        </form>
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ histórico

function HistoryPanel({ product, onSelect, onChanged }: { product: ProductRef | null; onSelect: (p: ProductRef | null) => void; onChanged: () => void }) {
  const [manualId, setManualId] = useState('');
  if (!product) {
    return (
      <Card>
        <EmptyState
          title="Escolha um produto"
          description="Clique no nome de um produto nas abas Links ou Pendentes (ou em “Gerenciar” no detalhe de uma oferta) para ver todos os links já cadastrados para ele, em qualquer status."
          action={
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualId.trim()) onSelect({ id: manualId.trim() });
              }}
            >
              <Field label="Ou informe o ID do produto">
                <input className="input" value={manualId} onChange={(e) => setManualId(e.target.value)} autoComplete="off" />
              </Field>
              <Button type="submit" disabled={!manualId.trim()}>
                Buscar
              </Button>
            </form>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Histórico de links"
        description={product.title ?? `Produto ${product.id}`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
            Trocar produto
          </Button>
        }
      />
      <LinksTable idKey="hist" query={{ productId: product.id }} onChanged={onChanged} emptyTitle="Nenhum link para este produto" emptyDescription="Cadastre um link na aba Pendentes ou importe em lote." />
    </Card>
  );
}

// ------------------------------------------------------------------ view

const STATUS_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'PENDING', label: 'Pendentes' },
  { id: 'VALIDATED', label: 'Validados' },
  { id: 'INVALID', label: 'Inválidos' },
];

function Inner() {
  const params = useSearchParams();
  const qProduct = params.get('productId');
  const [tab, setTab] = useState<TabId>(qProduct ? 'historico' : 'links');
  const [product, setProduct] = useState<ProductRef | null>(qProduct ? { id: qProduct } : null);
  const [statusFilter, setStatusFilter] = useState('');
  const status = useFetch('affiliate-status', (s) => api.affiliateStatus(s), { intervalMs: 30_000 });
  const s = status.data;

  const openProduct = (p: ProductRef | null) => {
    setProduct(p);
    setTab('historico');
  };
  const refresh = () => void status.reload();

  return (
    <>
      <PageHeader title="Afiliados" description="Links de afiliado validados são obrigatórios para publicar. A geração automática não está disponível: o fluxo é exportar pendentes, gerar no portal oficial e importar." />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Geração automática de links"
            actions={s ? <Badge tone={s.generation.available ? 'success' : 'warning'}>{s.generation.available ? 'Disponível' : 'Indisponível'}</Badge> : null}
          />
          <CardBody className="space-y-2 text-sm">
            {status.loading ? (
              <LoadingBlock rows={2} />
            ) : status.error && !s ? (
              <ErrorState compact error={status.error} onRetry={() => void status.reload()} title="Status indisponível" />
            ) : s ? (
              <>
                <p className="text-muted">{s.generation.available ? 'Geração por método oficial habilitada.' : (s.generation.reason ?? 'Sem método oficial/autorizado para gerar links automaticamente.')}</p>
                <p className="flex items-center gap-2">
                  <span className="text-muted">Credenciais do programa:</span>
                  <Badge tone={s.credentialsConfigured ? 'success' : 'neutral'}>{s.credentialsConfigured ? 'Configuradas' : 'Não configuradas'}</Badge>
                </p>
              </>
            ) : null}
          </CardBody>
        </Card>
        <div className="grid grid-cols-3 gap-3 lg:col-span-2">
          <Stat label="Pendentes" value={s ? formatNumber(s.counts.pending) : '—'} hint="aguardando validação" tone={s && s.counts.pending > 0 ? 'warning' : undefined} />
          <Stat label="Validados" value={s ? formatNumber(s.counts.validated) : '—'} hint="liberam publicação" tone="success" />
          <Stat label="Inválidos" value={s ? formatNumber(s.counts.invalid) : '—'} hint="precisam de correção" tone={s && s.counts.invalid > 0 ? 'danger' : undefined} />
        </div>
      </div>

      <Tabs
        label="Seções de afiliados"
        idPrefix="afil"
        value={tab}
        onChange={(v) => setTab(v as TabId)}
        items={[
          { id: 'links', label: 'Links' },
          { id: 'importar', label: 'Importar em lote' },
          { id: 'pendentes', label: 'Pendentes', count: s ? s.counts.pending : null },
          { id: 'historico', label: 'Histórico por produto' },
        ]}
      />

      <TabPanel id="links" idPrefix="afil" active={tab === 'links'}>
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5" role="group" aria-label="Filtrar por status">
            {STATUS_FILTERS.map((f) => (
              <Button key={f.id} size="sm" variant={statusFilter === f.id ? 'primary' : 'secondary'} aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id)}>
                {f.label}
              </Button>
            ))}
          </div>
          <LinksTable
            idKey="all"
            query={{ status: statusFilter || undefined }}
            onProduct={openProduct}
            onChanged={refresh}
            emptyTitle="Nenhum link cadastrado"
            emptyDescription="Exporte os pendentes, gere os links no portal oficial de afiliados e importe em lote."
          />
        </Card>
      </TabPanel>
      <TabPanel id="importar" idPrefix="afil" active={tab === 'importar'}>
        <ImportPanel onDone={refresh} />
      </TabPanel>
      <TabPanel id="pendentes" idPrefix="afil" active={tab === 'pendentes'}>
        <PendingPanel onProduct={openProduct} onChanged={refresh} />
      </TabPanel>
      <TabPanel id="historico" idPrefix="afil" active={tab === 'historico'}>
        <HistoryPanel product={product} onSelect={setProduct} onChanged={refresh} />
      </TabPanel>
    </>
  );
}

export function AffiliatesView() {
  return (
    <Suspense fallback={<LoadingBlock rows={4} />}>
      <Inner />
    </Suspense>
  );
}
