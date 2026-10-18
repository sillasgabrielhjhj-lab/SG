'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { ProductThumb } from '@/components/product-thumb';
import { PublicationStatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DefList, PageHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { Drawer } from '@/components/ui/overlay';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { copyText, downloadFile } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/format';
import { CHANNEL_TYPE, OFFER_KIND } from '@/lib/labels';
import type { PublicationDetail, PublicationDTO, PublicationStatus } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type TabId = 'sent' | 'pending' | 'scheduled' | 'failed' | 'manual';

const RETRYABLE: PublicationStatus[] = ['FAILED', 'DEAD'];
const CANCELLABLE: PublicationStatus[] = ['PENDING', 'SCHEDULED', 'FAILED', 'MANUAL_READY'];

type Act = 'retry' | 'cancel' | 'mark-sent';

function usePublicationActions(onDone: () => void) {
  const toast = useToast();
  const [act, setAct] = useState<{ kind: Act; pub: Pick<PublicationDTO, 'id' | 'productTitle' | 'channelName'> } | null>(null);

  const open = (kind: Act, pub: PublicationDTO) => setAct({ kind, pub: { id: pub.id, productTitle: pub.productTitle, channelName: pub.channelName } });

  const confirm = async () => {
    if (!act) return;
    const { kind, pub } = act;
    if (kind === 'retry') {
      const r = await api.retryPublication(pub.id);
      if (r.status === 'SENT') toast.success('Enviada e confirmada pelo canal');
      else if (r.status === 'MANUAL_READY') toast.success('Pronta na Fila manual');
      else if (r.status === 'FAILED' || r.status === 'DEAD') toast.warning('A nova tentativa falhou', r.lastError ?? undefined);
      else toast.info('Reenvio solicitado', 'Acompanhe o status na lista.');
    } else if (kind === 'cancel') {
      await api.cancelPublication(pub.id);
      toast.success('Publicação cancelada');
    } else {
      await api.markPublicationSent(pub.id);
      toast.success('Marcada como publicada', 'Registrado como publicação manual feita por você.');
    }
    onDone();
  };

  const text = {
    retry: { title: 'Reenviar publicação', confirm: 'Reenviar', danger: false, desc: 'Uma nova tentativa de envio será feita. O sistema impede envio duplicado: se a mensagem já tiver sido confirmada, nada é enviado de novo.' },
    cancel: { title: 'Cancelar publicação', confirm: 'Cancelar publicação', danger: true, desc: 'A publicação não será mais enviada. A oferta poderá ser publicada novamente depois.' },
    'mark-sent': {
      title: 'Marcar como publicada',
      confirm: 'Sim, já publiquei',
      danger: false,
      desc: 'Confirme apenas se você realmente postou esta mensagem no grupo. O sistema não consegue verificar publicações manuais.',
    },
  } as const;

  const dialog = act ? (
    <ConfirmDialog
      open
      title={text[act.kind].title}
      confirmLabel={text[act.kind].confirm}
      cancelLabel="Voltar"
      danger={text[act.kind].danger}
      onClose={() => setAct(null)}
      onConfirm={confirm}
      description={
        <>
          <span className="block font-medium text-fg">{act.pub.productTitle}</span>
          <span className="block text-xs">Canal: {act.pub.channelName}</span>
          <span className="mt-2 block">{text[act.kind].desc}</span>
        </>
      }
    />
  ) : null;

  return { open, dialog };
}

// ------------------------------------------------------------------ detalhe

function PublicationDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const detail = useFetch(`publication-${id}`, (s) => api.publication(id as string, s), { enabled: !!id });
  const toast = useToast();
  const actions = usePublicationActions(() => {
    void detail.reload();
    onChanged();
  });
  const p = detail.data as PublicationDetail | undefined;

  const copy = async (text: string) => {
    if (await copyText(text)) toast.success('Texto copiado');
    else toast.error('Não foi possível copiar');
  };

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={p?.productTitle ?? 'Detalhes da publicação'}
        footer={
          p ? (
            <>
              {CANCELLABLE.includes(p.status) ? (
                <Button variant="ghost" onClick={() => actions.open('cancel', p)}>
                  Cancelar
                </Button>
              ) : null}
              {RETRYABLE.includes(p.status) ? (
                <Button variant="primary" onClick={() => actions.open('retry', p)}>
                  Reenviar
                </Button>
              ) : null}
              {p.status === 'MANUAL_READY' ? (
                <Button variant="primary" onClick={() => actions.open('mark-sent', p)}>
                  Marcar como publicada
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {detail.loading || (!p && !detail.error) ? (
          <LoadingBlock rows={6} />
        ) : detail.error && !p ? (
          <ErrorState error={detail.error} onRetry={() => void detail.reload()} />
        ) : p ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <PublicationStatusBadge status={p.status} />
              <Badge tone="neutral" dot={false}>
                {OFFER_KIND[p.template] ?? p.template}
              </Badge>
            </div>
            {p.status === 'MANUAL_READY' ? <Notice tone="info">Este canal é manual: nada foi enviado automaticamente. Copie o texto, publique no grupo e marque como publicada.</Notice> : null}
            {p.status === 'DEAD' ? <Notice tone="danger">As tentativas se esgotaram. Corrija a causa (veja o erro abaixo) e use “Reenviar”.</Notice> : null}
            {p.lastError ? (
              <Notice tone="danger" title="Último erro">
                <span className="break-words">{p.lastError}</span>
              </Notice>
            ) : null}
            <DefList
              items={[
                { label: 'Canal', value: `${p.channelName} (${CHANNEL_TYPE[p.channelType]?.label ?? p.channelType})` },
                { label: 'Tentativas', value: p.attemptsCount },
                { label: 'Criada em', value: formatDateTime(p.createdAt) },
                { label: 'Agendada para', value: formatDateTime(p.scheduledFor) },
                { label: 'Enviada (confirmada) em', value: formatDateTime(p.sentAt) },
              ]}
            />

            <Card>
              <CardHeader title="Mensagem" actions={<Button size="sm" icon={<Icon name="copy" size={14} />} onClick={() => void copy(p.messageText)}>Copiar</Button>} />
              <CardBody className="space-y-3">
                {p.imageUrl ? <ProductThumb src={p.imageUrl} alt={`Imagem de ${p.productTitle}`} size={120} /> : null}
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 p-3 font-sans text-sm">{p.messageText}</pre>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Tentativas de envio" />
              {p.attempts.length === 0 ? (
                <EmptyState title="Nenhuma tentativa registrada" description="Publicações manuais e ainda não processadas não têm tentativas." />
              ) : (
                <Table caption="Tentativas de envio">
                  <THead>
                    <Tr>
                      <Th>Início</Th>
                      <Th>Resultado</Th>
                      <Th>HTTP</Th>
                      <Th>Erro</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {p.attempts.map((a) => (
                      <Tr key={a.id}>
                        <Td className="whitespace-nowrap text-xs">{formatDateTime(a.startedAt)}</Td>
                        <Td>{a.success ? <Badge tone="success">Confirmado</Badge> : <Badge tone="danger">Falhou</Badge>}</Td>
                        <Td className="tabular-nums">{a.httpStatus ?? '—'}</Td>
                        <Td className="max-w-[220px] break-words text-xs">{a.error ?? '—'}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>
        ) : null}
      </Drawer>
      {actions.dialog}
    </>
  );
}

// ------------------------------------------------------------------ fila manual

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'imagem';
}

function ManualCard({ pub, onAction, onDetails }: { pub: PublicationDTO; onAction: (k: Act, p: PublicationDTO) => void; onDetails: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copy = async () => {
    if (await copyText(pub.messageText)) {
      setCopied(true);
      toast.success('Texto copiado', 'Cole no grupo do WhatsApp.');
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
    }
  };
  const download = async () => {
    if (!pub.imageUrl) return;
    setDownloading(true);
    try {
      const ext = /\.(jpe?g|png|webp|gif)(?:$|\?)/i.exec(pub.imageUrl)?.[1]?.toLowerCase() ?? 'jpg';
      const r = await downloadFile(pub.imageUrl, `${slug(pub.productTitle)}.${ext}`);
      if (r === 'opened') toast.info('Imagem aberta em nova aba', 'Salve-a a partir de lá (o servidor da imagem bloqueia download direto).');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold">{pub.productTitle}</p>
          <p className="text-xs text-muted">
            {pub.channelName} · criada em {formatDateTime(pub.createdAt)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDetails}>
          Detalhes
        </Button>
      </div>
      <CardBody className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          {pub.imageUrl ? (
            <>
              <ProductThumb src={pub.imageUrl} alt={`Imagem de ${pub.productTitle}`} size={160} className="!h-40 !w-40 max-w-full" />
              <Button size="sm" className="w-full" onClick={() => void download()} loading={downloading} icon={<Icon name="download" size={14} />}>
                Baixar imagem
              </Button>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">Sem imagem disponível para este produto.</p>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <Field label="Texto pronto para publicar">
            <textarea className="input min-h-[180px] resize-y font-sans" readOnly rows={9} value={pub.messageText} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onAction('cancel', pub)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => void copy()} icon={<Icon name={copied ? 'check' : 'copy'} size={14} />}>
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button size="sm" variant="primary" onClick={() => onAction('mark-sent', pub)}>
              Marcar como publicada
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function ManualQueue({ onOpen, onChanged }: { onOpen: (id: string) => void; onChanged: () => void }) {
  const list = useFetch('manual-queue', (s) => api.manualQueue(s), { intervalMs: 15_000 });
  const actions = usePublicationActions(() => {
    void list.reload();
    onChanged();
  });

  if (list.loading) return <LoadingBlock rows={4} label="Carregando a fila manual…" />;
  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar a fila manual" />;
  if (!list.data || list.data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Fila manual vazia"
          description="Quando uma oferta aprovada (com link validado) é publicada num canal manual, a mensagem pronta aparece aqui para você copiar e postar no WhatsApp."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Notice tone="info">
        Canal manual: o sistema <strong>não envia</strong> nada. Copie o texto, baixe a imagem, publique no grupo e só então clique em “Marcar como publicada”.
      </Notice>
      {list.data.map((p) => (
        <ManualCard key={p.id} pub={p} onAction={actions.open} onDetails={() => onOpen(p.id)} />
      ))}
      {actions.dialog}
    </div>
  );
}

// ------------------------------------------------------------------ lista

function PublicationList({ status, channelId, onOpen, onChanged, version }: { status: PublicationStatus; channelId: string; onOpen: (id: string) => void; onChanged: () => void; version: number }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, channelId]);
  const list = useFetch(`pubs-${status}-${channelId}-${page}-${version}`, (s) => api.publications({ status, channelId: channelId || undefined, page }, s), { intervalMs: 20_000 });
  const actions = usePublicationActions(() => {
    void list.reload();
    onChanged();
  });

  if (list.loading) return <LoadingBlock rows={5} label="Carregando publicações…" />;
  if (list.error && !list.data) return <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar as publicações" />;
  if (!list.data || list.data.items.length === 0) {
    return <EmptyState title="Nenhuma publicação neste status" description={status === 'SENT' ? 'Só aparecem aqui as publicações confirmadas pelo canal.' : undefined} />;
  }
  return (
    <>
      <Table caption="Publicações">
        <THead>
          <Tr>
            <Th>Produto</Th>
            <Th>Canal</Th>
            <Th>Status</Th>
            <Th className="hidden md:table-cell">{status === 'SENT' ? 'Enviada em' : status === 'SCHEDULED' ? 'Agendada para' : 'Criada em'}</Th>
            <Th className="hidden lg:table-cell">Tentativas</Th>
            <Th className="text-right">Ações</Th>
          </Tr>
        </THead>
        <TBody>
          {list.data.items.map((p) => (
            <Tr key={p.id}>
              <Td>
                <button type="button" onClick={() => onOpen(p.id)} className="line-clamp-2 min-w-[180px] max-w-sm rounded text-left text-sm font-medium hover:text-primary-ink hover:underline">
                  {p.productTitle}
                </button>
                {p.lastError ? <p className="mt-1 line-clamp-2 max-w-sm break-words text-xs text-danger-ink">{p.lastError}</p> : null}
              </Td>
              <Td>
                <p className="text-sm">{p.channelName}</p>
                <p className="text-xs text-muted">{CHANNEL_TYPE[p.channelType]?.label ?? p.channelType}</p>
              </Td>
              <Td>
                <PublicationStatusBadge status={p.status} />
              </Td>
              <Td className="hidden whitespace-nowrap text-xs text-muted md:table-cell">{formatDateTime(p.status === 'SENT' ? p.sentAt : p.status === 'SCHEDULED' ? p.scheduledFor : p.createdAt)}</Td>
              <Td className="hidden tabular-nums lg:table-cell">{p.attemptsCount}</Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(p.id)}>
                    Detalhes
                  </Button>
                  {RETRYABLE.includes(p.status) ? (
                    <Button size="sm" onClick={() => actions.open('retry', p)}>
                      Reenviar
                    </Button>
                  ) : null}
                  {CANCELLABLE.includes(p.status) && p.status !== 'MANUAL_READY' ? (
                    <Button size="sm" variant="ghost" onClick={() => actions.open('cancel', p)}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} busy={list.fetching} />
      {actions.dialog}
    </>
  );
}

// ------------------------------------------------------------------ view

export function PublicationsView() {
  const [tab, setTab] = useState<TabId>('sent');
  const [failedKind, setFailedKind] = useState<'FAILED' | 'DEAD'>('FAILED');
  const [channelId, setChannelId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const integ = useFetch('integrations-for-filter', (s) => api.integrations(s));
  const manual = useFetch('manual-queue-count', (s) => api.manualQueue(s), { intervalMs: 30_000 });
  const bump = () => {
    setVersion((v) => v + 1);
    void manual.reload();
  };

  const statusFor: Record<Exclude<TabId, 'manual'>, PublicationStatus> = { sent: 'SENT', pending: 'PENDING', scheduled: 'SCHEDULED', failed: failedKind };

  return (
    <>
      <PageHeader title="Publicações" description="Acompanhe envios, falhas e a fila de publicação manual. “Enviada” significa confirmada pelo canal — nunca presumida." />

      <Tabs
        label="Status das publicações"
        idPrefix="pub"
        value={tab}
        onChange={(v) => setTab(v as TabId)}
        items={[
          { id: 'sent', label: 'Enviadas' },
          { id: 'pending', label: 'Pendentes' },
          { id: 'scheduled', label: 'Agendadas' },
          { id: 'failed', label: 'Falhas' },
          { id: 'manual', label: 'Fila manual', count: manual.data ? manual.data.length : null },
        ]}
      />

      {tab === 'manual' ? (
        <TabPanel id="manual" idPrefix="pub" active>
          <ManualQueue onOpen={setOpenId} onChanged={bump} />
        </TabPanel>
      ) : (
        <TabPanel id={tab} idPrefix="pub" active>
          <Card>
            <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3 sm:px-5">
              <Field label="Canal" className="w-full sm:w-64">
                <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                  <option value="">Todos os canais</option>
                  {(integ.data?.channels ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {tab === 'failed' ? (
                <div role="group" aria-label="Tipo de falha" className="flex gap-2 pb-0.5">
                  <Button size="sm" variant={failedKind === 'FAILED' ? 'primary' : 'secondary'} aria-pressed={failedKind === 'FAILED'} onClick={() => setFailedKind('FAILED')}>
                    Com nova tentativa
                  </Button>
                  <Button size="sm" variant={failedKind === 'DEAD' ? 'primary' : 'secondary'} aria-pressed={failedKind === 'DEAD'} onClick={() => setFailedKind('DEAD')}>
                    Falha definitiva
                  </Button>
                </div>
              ) : null}
            </div>
            <PublicationList status={statusFor[tab]} channelId={channelId} onOpen={setOpenId} onChanged={bump} version={version} />
          </Card>
        </TabPanel>
      )}

      <PublicationDrawer id={openId} onClose={() => setOpenId(null)} onChanged={bump} />
    </>
  );
}
