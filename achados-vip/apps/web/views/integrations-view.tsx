'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { IntegrationBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { CHANNEL_CONFIG_FIELDS, CHANNEL_PROVIDER, CREDENTIAL_PROVIDERS } from '@/lib/channel-fields';
import { formatDateTime, formatRelative } from '@/lib/format';
import { CHANNEL_TYPE } from '@/lib/labels';
import type { ChannelDTO, ChannelType, CredentialSummary, IntegrationsData, TestResult } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

// Textos explicativos dos modos (baseados em docs/VIABILIDADE.md). O status vem da API quando disponível.
const MODE_INFO: Record<'A' | 'B' | 'C', { label: string; text: string }> = {
  A: {
    label: 'Modo A — WhatsApp Groups API (oficial)',
    text: 'Envia para grupos criados via API da WhatsApp Business Platform: máximo de 8 participantes, entrada só por link de convite. Não serve para um grupo grande já existente. Exige conta/número da plataforma e é “a validar” com suas credenciais.',
  },
  B: {
    label: 'Modo B — Fila manual',
    text: 'O sistema busca, classifica, valida o link e deixa a mensagem pronta (texto + imagem). Você copia, publica no grupo e marca como publicada. Funciona hoje, sem credenciais, e nunca registra envio sem a sua confirmação.',
  },
  C: {
    label: 'Modo C — Telegram / Webhook',
    text: 'Automação total para audiência grande via Bot API do Telegram, ou webhook assinado (HMAC) para ferramentas como n8n/Make. Confirme que a divulgação de links de afiliado está de acordo com os termos do programa.',
  },
};

const TYPES: ChannelType[] = ['WHATSAPP_CLOUD_GROUP', 'WHATSAPP_MANUAL_QUEUE', 'TELEGRAM', 'WEBHOOK'];

type TestMap = Record<string, (TestResult & { at: Date }) | { error: string; at: Date }>;

// ------------------------------------------------------------------ credenciais

function CredentialModal({
  provider,
  presetName,
  existing,
  onClose,
  onSaved,
}: {
  provider: string;
  presetName?: string;
  existing: CredentialSummary[];
  onClose: () => void;
  onSaved: (c: CredentialSummary) => void;
}) {
  const toast = useToast();
  const def = CREDENTIAL_PROVIDERS[provider];
  const [name, setName] = useState(presetName ?? 'principal');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!def) return null;

  const replacing = existing.some((c) => c.provider === provider && c.name === name.trim());
  const missing = def.fields.some((f) => !values[f.key]?.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (missing || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const cleaned = Object.fromEntries(def.fields.map((f) => [f.key, values[f.key]!.trim()]));
      const saved = await api.saveCredential({ provider, name: name.trim(), values: cleaned });
      setValues({}); // nunca manter segredos em memória depois de enviados
      toast.success('Credencial salva', 'Os valores foram criptografados e não podem mais ser exibidos.');
      onSaved(saved);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`Credenciais — ${def.label}`}
      dismissible={!busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="form-credencial" variant="primary" loading={busy} disabled={missing || !name.trim()}>
            {replacing ? 'Substituir valores' : 'Salvar credencial'}
          </Button>
        </>
      }
    >
      <form id="form-credencial" onSubmit={submit} className="space-y-4" autoComplete="off">
        <Notice tone="info">
          Somente escrita: os valores são criptografados no servidor (AES-256-GCM) e <strong>nunca</strong> voltam para o navegador. Para trocar, salve novamente com o mesmo nome.
        </Notice>
        {err ? <Notice tone="danger">{err}</Notice> : null}
        <Field label="Nome da credencial" hint={replacing ? 'Já existe uma credencial com este nome: ela será substituída.' : 'Identifica a credencial na lista (ex.: principal).'} required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        {def.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} required>
            <input
              className="input font-mono text-xs"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </Field>
        ))}
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ canal

function ChannelModal({
  type,
  channel,
  data,
  onClose,
  onSaved,
  onNewCredential,
}: {
  type: ChannelType;
  channel: ChannelDTO | null;
  data: IntegrationsData;
  onClose: () => void;
  onSaved: () => void;
  onNewCredential: (provider: string, onCreated: (c: CredentialSummary) => void) => void;
}) {
  const toast = useToast();
  const fields = CHANNEL_CONFIG_FIELDS[type];
  const provider = CHANNEL_PROVIDER[type];
  const [name, setName] = useState(channel?.name ?? (type === 'WHATSAPP_MANUAL_QUEUE' ? 'Fila manual — ACHADOS VIP' : ''));
  const [cfg, setCfg] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, String(channel?.config?.[f.key] ?? '')])));
  const [credentialId, setCredentialId] = useState(channel?.credentialId ?? '');
  const [enabled, setEnabled] = useState(channel?.enabled ?? type === 'WHATSAPP_MANUAL_QUEUE');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [extraCreds, setExtraCreds] = useState<CredentialSummary[]>([]);

  const creds = [...data.credentials, ...extraCreds.filter((c) => !data.credentials.some((d) => d.id === c.id))].filter((c) => c.provider === provider);
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Informe um nome.';
  for (const f of fields) {
    const v = cfg[f.key]?.trim() ?? '';
    if (f.required && !v) errors[f.key] = 'Campo obrigatório.';
    else if (v && f.validate) {
      const m = f.validate(v);
      if (m) errors[f.key] = m;
    }
  }
  if (provider && !credentialId && enabled) errors.credentialId = 'Selecione uma credencial para ativar o canal.';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (Object.keys(errors).length) return;
    setBusy(true);
    setErr(null);
    try {
      const config = { ...(channel?.config ?? {}), ...Object.fromEntries(fields.map((f) => [f.key, cfg[f.key]!.trim()])) };
      if (channel) {
        await api.updateChannel(channel.id, { name: name.trim(), config, credentialId: provider ? credentialId || null : null, enabled });
        toast.success('Canal atualizado', 'Teste a conexão para confirmar o status.');
      } else {
        await api.createChannel({ type, name: name.trim(), config, credentialId: provider ? credentialId || null : null, enabled });
        toast.success('Canal criado', enabled ? 'Teste a conexão para confirmar o status.' : 'Ele começa desativado: teste a conexão e ative quando estiver pronto.');
      }
      onSaved();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`${channel ? 'Editar' : 'Novo'} canal — ${CHANNEL_TYPE[type].label}`}
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="form-canal" variant="primary" loading={busy} disabled={Object.keys(errors).length > 0}>
            {channel ? 'Salvar' : 'Criar canal'}
          </Button>
        </>
      }
    >
      <form id="form-canal" onSubmit={submit} className="space-y-4" noValidate>
        {err ? <Notice tone="danger">{err}</Notice> : null}
        {type === 'TELEGRAM' ? <Notice tone="info">Confirme que a divulgação de links de afiliado do Mercado Livre no canal está de acordo com os termos do programa.</Notice> : null}
        {type === 'WHATSAPP_CLOUD_GROUP' ? <Notice tone="warning">A Groups API só envia para grupos criados via API (máx. 8 participantes). Não envia para um grupo comum já existente.</Notice> : null}
        {type === 'WHATSAPP_MANUAL_QUEUE' ? <Notice tone="info">Este canal não envia nada: gera a mensagem pronta na Fila manual para você publicar.</Notice> : null}
        <Field label="Nome do canal" error={errors.name} required>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]} required={f.required}>
            <input className="input" value={cfg[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setCfg((c) => ({ ...c, [f.key]: e.target.value }))} spellCheck={false} />
          </Field>
        ))}
        {provider ? (
          <div className="space-y-2">
            <Field label="Credencial" error={errors.credentialId} hint="Os valores ficam guardados no servidor; aqui você só escolhe qual usar.">
              <select className="input" value={credentialId} onChange={(e) => setCredentialId(e.target.value)}>
                <option value="">— Nenhuma —</option>
                {creds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.hint ? `(••••${c.hint})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              size="sm"
              onClick={() =>
                onNewCredential(provider, (c) => {
                  setExtraCreds((l) => [...l, c]);
                  setCredentialId(c.id);
                })
              }
            >
              Nova credencial…
            </Button>
          </div>
        ) : null}
        <Toggle
          label="Canal ativo"
          description={type === 'WHATSAPP_MANUAL_QUEUE' ? 'Ativo: publicações para este canal entram na Fila manual.' : 'Só ative depois de testar a conexão com sucesso.'}
          checked={enabled}
          onChange={setEnabled}
        />
      </form>
    </Modal>
  );
}

function ChannelRow({
  ch,
  tests,
  busy,
  onToggle,
  onTest,
  onEdit,
  onDelete,
}: {
  ch: ChannelDTO;
  tests: TestMap;
  busy: string | null;
  onToggle: (v: boolean) => void;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = tests[ch.id];
  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{ch.name}</p>
            <IntegrationBadge status={ch.status} />
            {!ch.enabled ? <Badge tone="neutral">Desativado</Badge> : null}
            <Badge tone="neutral" dot={false}>
              {ch.automatic ? 'Automático' : 'Manual'}
            </Badge>
          </div>
          {ch.statusDetail ? <p className="mt-1 break-words text-xs text-muted">{ch.statusDetail}</p> : null}
          <p className="mt-1 text-[11px] text-muted" title={formatDateTime(ch.lastCheckedAt)}>
            {ch.lastCheckedAt ? `Verificado ${formatRelative(ch.lastCheckedAt)}` : 'Nunca testado'}
          </p>
        </div>
        <div className="w-44">
          <Toggle label="Ativo" checked={ch.enabled} busy={busy === ch.id} onChange={onToggle} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onTest} loading={busy === `test-${ch.id}`}>
          Testar conexão
        </Button>
        <Button size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Icon name="trash" size={14} />
          Remover
        </Button>
      </div>
      {t ? (
        <div role="status">
          {'error' in t ? (
            <Notice tone="danger" title="Falha ao testar">
              {t.error}
            </Notice>
          ) : (
            <Notice tone={t.ok ? 'success' : t.status === 'AUTH_REQUIRED' ? 'warning' : 'danger'} title={t.ok ? 'Conexão confirmada' : 'Conexão não confirmada'}>
              {t.detail} <span className="opacity-70">({formatDateTime(t.at)})</span>
            </Notice>
          )}
        </div>
      ) : null}
    </li>
  );
}

// ------------------------------------------------------------------ view

export function IntegrationsView() {
  const toast = useToast();
  const integ = useFetch('integrations', (s) => api.integrations(s), { intervalMs: 60_000 });
  const [tests, setTests] = useState<TestMap>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ type: ChannelType; channel: ChannelDTO | null } | null>(null);
  const [cred, setCred] = useState<{ provider: string; presetName?: string; onCreated?: (c: CredentialSummary) => void } | null>(null);
  const [toDelete, setToDelete] = useState<ChannelDTO | null>(null);
  const d = integ.data;

  const testResult = (key: string, r: TestResult) => setTests((m) => ({ ...m, [key]: { ...r, at: new Date() } }));

  const testChannel = async (ch: ChannelDTO) => {
    setBusy(`test-${ch.id}`);
    try {
      testResult(ch.id, await api.testChannel(ch.id));
      await integ.reload();
    } catch (e) {
      setTests((m) => ({ ...m, [ch.id]: { error: errorMessage(e), at: new Date() } }));
    } finally {
      setBusy(null);
    }
  };

  const testSource = async () => {
    setBusy('test-source');
    try {
      testResult('source', await api.testSource());
      await integ.reload();
    } catch (e) {
      setTests((m) => ({ ...m, source: { error: errorMessage(e), at: new Date() } }));
    } finally {
      setBusy(null);
    }
  };

  const toggleChannel = async (ch: ChannelDTO, enabled: boolean) => {
    setBusy(ch.id);
    try {
      await api.updateChannel(ch.id, { enabled });
      toast.success(enabled ? 'Canal ativado' : 'Canal desativado');
      await integ.reload();
    } catch (e) {
      toast.fromError(e, 'Não foi possível alterar o canal');
    } finally {
      setBusy(null);
    }
  };

  const srcTest = tests.source;
  const srcDetail = d?.source.detail ?? d?.source.statusDetail ?? null;
  const isFixture = !!d && /fixture/i.test(d.source.name);

  return (
    <>
      <PageHeader title="Integrações" description="Fonte de ofertas e canais de publicação. O status mostrado vem de testes reais de conexão — “Conectado” só aparece depois de um teste bem-sucedido." />

      {integ.loading ? (
        <Card>
          <LoadingBlock rows={6} label="Carregando integrações…" />
        </Card>
      ) : integ.error && !d ? (
        <Card>
          <ErrorState error={integ.error} onRetry={() => void integ.reload()} title="Não foi possível carregar as integrações" />
        </Card>
      ) : d ? (
        <div className="space-y-6">
          {integ.error ? (
            <Notice tone="warning" title="Falha ao atualizar">
              {integ.error.message}
            </Notice>
          ) : null}

          <section aria-labelledby="modos-titulo">
            <h2 id="modos-titulo" className="mb-3 text-sm font-semibold">
              Modos de publicação
            </h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {(['A', 'B', 'C'] as const).map((k) => {
                const m = d.modes?.find((x) => x.key === k);
                return (
                  <Card key={k}>
                    <CardHeader title={m?.label ?? MODE_INFO[k].label} actions={m?.status ? <Badge tone="neutral">{m.status}</Badge> : null} />
                    <CardBody>
                      <p className="text-sm text-muted">{m?.explanation ?? MODE_INFO[k].text}</p>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>

          <Card>
            <CardHeader
              title="Mercado Livre — fonte de ofertas"
              description="Busca ofertas pela API oficial (OAuth). Sem credenciais válidas o painel mostra “Autenticação necessária” ou “Erro”."
              actions={<IntegrationBadge status={d.source.status} />}
            />
            <CardBody className="space-y-4">
              <div className="text-sm">
                <p className="font-medium">{d.source.name}</p>
                {srcDetail ? <p className="mt-1 break-words text-muted">{srcDetail}</p> : null}
                <p className="mt-1 text-xs text-muted">{d.source.lastCheckedAt ? `Verificada ${formatRelative(d.source.lastCheckedAt)}` : 'Nunca testada'}</p>
              </div>
              {isFixture ? (
                <Notice tone="warning" title="Fonte de teste (fixture)">
                  Os dados são fictícios e servem só para testar o fluxo — não são ofertas reais.
                </Notice>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void testSource()} loading={busy === 'test-source'}>
                  Testar conexão
                </Button>
                <Button onClick={() => setCred({ provider: 'mercadolivre' })}>Credenciais do app…</Button>
                <Link href="/automacao" className="link self-center text-sm">
                  Trocar fonte em Automação
                </Link>
              </div>
              {srcTest ? (
                <div role="status">
                  {'error' in srcTest ? (
                    <Notice tone="danger" title="Falha ao testar">
                      {srcTest.error}
                    </Notice>
                  ) : (
                    <Notice tone={srcTest.ok ? 'success' : srcTest.status === 'AUTH_REQUIRED' ? 'warning' : 'danger'} title={srcTest.ok ? 'Conexão confirmada' : 'Conexão não confirmada'}>
                      {srcTest.detail} <span className="opacity-70">({formatDateTime(srcTest.at)})</span>
                    </Notice>
                  )}
                </div>
              ) : null}
            </CardBody>
          </Card>

          {TYPES.map((type) => {
            const list = d.channels.filter((c) => c.type === type);
            const info = CHANNEL_TYPE[type];
            return (
              <Card key={type}>
                <CardHeader
                  title={info.label}
                  description={MODE_INFO[info.mode].label}
                  actions={
                    <Button size="sm" variant="primary" onClick={() => setEditor({ type, channel: null })} disabled={type === 'WHATSAPP_MANUAL_QUEUE' && list.length > 0} title={type === 'WHATSAPP_MANUAL_QUEUE' && list.length > 0 ? 'Já existe uma fila manual' : undefined}>
                      Adicionar canal
                    </Button>
                  }
                />
                {list.length === 0 ? (
                  <EmptyState
                    title="Não configurado"
                    description={type === 'WHATSAPP_MANUAL_QUEUE' ? 'Crie a fila manual para receber mensagens prontas e publicar você mesmo.' : 'Nenhum canal deste tipo ainda.'}
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {list.map((ch) => (
                      <ChannelRow
                        key={ch.id}
                        ch={ch}
                        tests={tests}
                        busy={busy}
                        onToggle={(v) => void toggleChannel(ch, v)}
                        onTest={() => void testChannel(ch)}
                        onEdit={() => setEditor({ type, channel: ch })}
                        onDelete={() => setToDelete(ch)}
                      />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          <Card>
            <CardHeader
              title="Credenciais salvas"
              description="Somente escrita: o painel mostra apenas o final do valor, nunca o segredo."
              actions={
                <Button size="sm" onClick={() => setCred({ provider: 'telegram' })}>
                  Nova credencial…
                </Button>
              }
            />
            {d.credentials.length === 0 ? (
              <EmptyState title="Nenhuma credencial salva" />
            ) : (
              <ul className="divide-y divide-line">
                {d.credentials.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted">
                        {CREDENTIAL_PROVIDERS[c.provider]?.label ?? c.provider} · <span className="font-mono">{c.hint ? `••••${c.hint}` : '••••'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status ? <IntegrationBadge status={c.status} /> : null}
                      {CREDENTIAL_PROVIDERS[c.provider] ? (
                        <Button size="sm" onClick={() => setCred({ provider: c.provider, presetName: c.name })}>
                          Substituir valores
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {editor && d ? (
        <ChannelModal
          type={editor.type}
          channel={editor.channel}
          data={d}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void integ.reload();
          }}
          onNewCredential={(provider, onCreated) => setCred({ provider, onCreated })}
        />
      ) : null}

      {cred && d ? (
        <CredentialModal
          provider={cred.provider}
          presetName={cred.presetName}
          existing={d.credentials}
          onClose={() => setCred(null)}
          onSaved={(c) => {
            cred.onCreated?.(c);
            setCred(null);
            void integ.reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Remover canal"
        confirmLabel="Remover canal"
        description={
          <>
            <span className="block font-medium text-fg">{toDelete?.name}</span>
            <span className="mt-1 block">Publicações já registradas neste canal podem impedir a remoção; nesse caso, desative o canal em vez de removê-lo.</span>
          </>
        }
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await api.deleteChannel(toDelete.id);
          toast.success('Canal removido');
          await integ.reload();
        }}
      />
    </>
  );
}
