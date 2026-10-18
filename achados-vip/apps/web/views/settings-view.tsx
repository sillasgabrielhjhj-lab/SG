'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { LogLevelBadge } from '@/components/status-badge';
import { NotificationsList } from '@/components/notifications-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, DefList, PageHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NumberField } from '@/components/ui/number-field';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import type { Settings } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type TabId = 'conta' | 'seguranca' | 'logs' | 'auditoria' | 'alertas' | 'mensagens' | 'operacao';
const TAB_IDS: TabId[] = ['conta', 'seguranca', 'logs', 'auditoria', 'alertas', 'mensagens', 'operacao'];

const MIN_PASSWORD = 12;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  let text = '';
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text.length > 4000) text = `${text.slice(0, 4000)}\n… (truncado)`;
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface-2 p-2 font-mono text-[11px]">{text}</pre>;
}

// ------------------------------------------------------------------ conta

function AccountTab() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const errors: Record<string, string> = {};
  if (next && next.length < MIN_PASSWORD) errors.next = `Use ao menos ${MIN_PASSWORD} caracteres.`;
  else if (next && next.length > 128) errors.next = 'Use no máximo 128 caracteres.';
  else if (next && current && next === current) errors.next = 'A nova senha deve ser diferente da atual.';
  else if (next && user && next.toLowerCase() === user.email.toLowerCase()) errors.next = 'A senha não pode ser igual ao e-mail.';
  if (confirm && next !== confirm) errors.confirm = 'As senhas não conferem.';
  const ready = !!current && !!next && !!confirm && Object.keys(errors).length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setErr(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Senha alterada', 'As outras sessões foram encerradas.');
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Conta" />
        <CardBody>
          <DefList items={[{ label: 'E-mail', value: user?.email ?? '—' }, { label: 'Perfil', value: user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'VIEWER' ? 'Somente leitura' : (user?.role ?? '—') }]} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Trocar senha" description={`Mínimo de ${MIN_PASSWORD} caracteres. Ao trocar, as outras sessões são encerradas.`} />
        <CardBody>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            {err ? <Notice tone="danger">{err}</Notice> : null}
            <Field label="Senha atual" required>
              <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Nova senha" error={errors.next} required>
              <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Confirmar nova senha" error={errors.confirm} required>
              <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" loading={busy} disabled={!ready}>
              Alterar senha
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ segurança

function SecurityTab() {
  const { user, logout } = useAuth();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Sessão atual" />
        <CardBody className="space-y-4">
          <p className="text-sm">
            Conectado como <strong>{user?.email}</strong>.
          </p>
          <Button onClick={() => void logout()}>Sair deste dispositivo</Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Como o acesso é protegido" />
        <CardBody>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>A sessão fica em cookie HttpOnly e SameSite=Strict (inacessível a scripts da página).</li>
            <li>Toda alteração exige um token CSRF, renovado a cada verificação de sessão.</li>
            <li>Tentativas repetidas de login com senha incorreta bloqueiam a conta temporariamente.</li>
            <li>Ao trocar a senha, as demais sessões abertas são encerradas.</li>
            <li>Segredos de integrações são criptografados no servidor e nunca exibidos no painel.</li>
            <li>Alterações de configuração ficam registradas na aba Auditoria.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ logs

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function LogsTab() {
  const [level, setLevel] = useState('');
  const [scope, setScope] = useState('');
  const [page, setPage] = useState(1);
  const dScope = useDebounced(scope.trim());
  useEffect(() => setPage(1), [level, dScope]);
  const list = useFetch(`logs-${level}-${dScope}-${page}`, (s) => api.logs({ level: level || undefined, scope: dScope || undefined, page }, s));

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3 sm:px-5">
        <Field label="Nível" className="w-40">
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Todos</option>
            <option value="ERROR">Erro</option>
            <option value="WARN">Aviso</option>
            <option value="INFO">Info</option>
            <option value="DEBUG">Debug</option>
          </select>
        </Field>
        <Field label="Escopo" className="w-48" hint="Ex.: discovery, publishing, auth">
          <input className="input" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="todos" />
        </Field>
        <Button onClick={() => void list.reload()} loading={list.fetching && !!list.data}>
          Atualizar
        </Button>
      </div>
      {list.loading ? (
        <LoadingBlock rows={6} label="Carregando logs…" />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar os logs" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState title="Nenhum log encontrado" description="Ajuste os filtros. Segredos são removidos dos logs antes de serem gravados." />
      ) : (
        <>
          <Table caption="Logs do sistema">
            <THead>
              <Tr>
                <Th>Quando</Th>
                <Th>Nível</Th>
                <Th>Escopo</Th>
                <Th>Mensagem</Th>
              </Tr>
            </THead>
            <TBody>
              {list.data.items.map((l) => (
                <Tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(l.createdAt)}</Td>
                  <Td>
                    <LogLevelBadge level={l.level} />
                  </Td>
                  <Td className="font-mono text-xs">{l.scope}</Td>
                  <Td>
                    <p className="max-w-xl break-words text-sm">{l.message}</p>
                    {l.meta ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Detalhes</summary>
                        <div className="mt-1 max-w-xl">
                          <JsonBlock value={l.meta} />
                        </div>
                      </details>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} busy={list.fetching} />
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ auditoria

function AuditTab() {
  const [page, setPage] = useState(1);
  const list = useFetch(`audit-${page}`, (s) => api.audit({ page }, s));
  return (
    <Card>
      <CardHeader title="Trilha de auditoria" description="Quem alterou o quê. Valores sensíveis nunca são gravados." />
      {list.loading ? (
        <LoadingBlock rows={6} />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.reload()} title="Não foi possível carregar a auditoria" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState title="Nenhum registro de auditoria" />
      ) : (
        <>
          <Table caption="Registros de auditoria">
            <THead>
              <Tr>
                <Th>Quando</Th>
                <Th>Usuário</Th>
                <Th>Ação</Th>
                <Th>Entidade</Th>
              </Tr>
            </THead>
            <TBody>
              {list.data.items.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(a.createdAt)}</Td>
                  <Td className="text-xs">{a.userEmail ?? <span className="text-muted">sistema</span>}</Td>
                  <Td className="font-mono text-xs">{a.action}</Td>
                  <Td>
                    <p className="text-xs">
                      {a.entity}
                      {a.entityId ? <span className="text-muted"> · {a.entityId}</span> : null}
                    </p>
                    {a.before || a.after ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted hover:text-fg">Antes / depois</summary>
                        <div className="mt-1 grid max-w-2xl gap-2 md:grid-cols-2">
                          <div>
                            <p className="mb-0.5 text-[11px] font-medium text-muted">Antes</p>
                            <JsonBlock value={a.before} />
                          </div>
                          <div>
                            <p className="mb-0.5 text-[11px] font-medium text-muted">Depois</p>
                            <JsonBlock value={a.after} />
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} busy={list.fetching} />
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ seções de configuração

function useSettingsSection<K extends 'messages' | 'alerts'>(key: K) {
  const toast = useToast();
  const settings = useFetch('settings', (s) => api.settings(s));
  const [draft, setDraft] = useState<Settings[K] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saved = settings.data?.[key];

  useEffect(() => {
    if (saved && !draft) setDraft(clone(saved));
  }, [saved, draft]);

  const dirty = !!draft && !!saved && !same(draft, saved);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await api.updateSettings({ [key]: draft } as never);
      settings.mutate(res);
      setDraft(clone(res[key]));
      toast.success('Configurações salvas', 'Registrado na auditoria.');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { settings, draft, setDraft, saved, dirty, busy, err, save };
}

function MessagesTab() {
  const s = useSettingsSection('messages');
  const d = s.draft;
  const errors: Record<string, string> = {};
  if (d && d.disclosure.trim().length < 10) errors.disclosure = 'O texto de divulgação é obrigatório (mínimo 10 caracteres).';
  if (d && !d.groupName.trim()) errors.groupName = 'Informe o nome do grupo.';

  if (s.settings.loading || (!d && !s.settings.error)) return <Card><LoadingBlock rows={4} /></Card>;
  if (!d) return <Card><ErrorState error={s.settings.error} onRetry={() => void s.settings.reload()} /></Card>;

  return (
    <Card>
      <CardHeader title="Preferências de mensagem" description="Valem para todas as mensagens geradas (WhatsApp e Telegram)." />
      <CardBody className="space-y-5">
        {s.err ? <Notice tone="danger">{s.err}</Notice> : null}
        <Field label="Divulgação (rodapé da mensagem)" error={errors.disclosure} hint="Aparece no final de toda mensagem. Mantenha a informação de que o link é de afiliado.">
          <textarea className="input" rows={3} maxLength={300} value={d.disclosure} onChange={(e) => s.setDraft({ ...d, disclosure: e.target.value })} />
        </Field>
        <Field label="Nome do grupo" error={errors.groupName} className="max-w-md">
          <input className="input" maxLength={80} value={d.groupName} onChange={(e) => s.setDraft({ ...d, groupName: e.target.value })} />
        </Field>
        <Toggle label="Mostrar parcelamento" description="Só aparece quando a fonte informa o parcelamento; nunca é inventado." checked={d.showInstallments} onChange={(v) => s.setDraft({ ...d, showInstallments: v })} />
        <Notice tone="info">O preço original e o percentual de desconto só entram na mensagem quando o desconto é verificado pelo histórico.</Notice>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void s.save()} loading={s.busy} disabled={!s.dirty || Object.keys(errors).length > 0}>
            Salvar
          </Button>
          {s.dirty ? (
            <Button onClick={() => s.saved && s.setDraft(clone(s.saved))} disabled={s.busy}>
              Descartar
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function AlertsTab() {
  const toast = useToast();
  const notifs = useFetch('settings-notifications', (s) => api.notifications(s), { intervalMs: 30_000 });
  const s = useSettingsSection('alerts');
  const [marking, setMarking] = useState(false);
  const d = s.draft;
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;

  const markAll = async () => {
    setMarking(true);
    try {
      await api.markAllNotificationsRead();
      await notifs.reload();
    } catch (e) {
      toast.fromError(e, 'Não foi possível marcar como lidas');
    } finally {
      setMarking(false);
    }
  };

  const errors: Record<string, string> = {};
  if (d) {
    if (!Number.isInteger(d.stuckJobMinutes) || d.stuckJobMinutes < 1) errors.job = 'Use um inteiro ≥ 1.';
    if (!Number.isInteger(d.stuckPublicationMinutes) || d.stuckPublicationMinutes < 1) errors.pub = 'Use um inteiro ≥ 1.';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Notificações"
          description={unread > 0 ? `${unread} não lida(s)` : 'Nenhuma não lida'}
          actions={
            unread > 0 ? (
              <Button size="sm" onClick={() => void markAll()} loading={marking}>
                Marcar todas como lidas
              </Button>
            ) : null
          }
        />
        {notifs.loading ? (
          <LoadingBlock rows={3} />
        ) : notifs.error && !notifs.data ? (
          <ErrorState error={notifs.error} onRetry={() => void notifs.reload()} title="Não foi possível carregar as notificações" />
        ) : (
          <NotificationsList items={notifs.data ?? []} onChanged={() => void notifs.reload()} emptyText="Nenhuma notificação." />
        )}
      </Card>

      <Card>
        <CardHeader title="Quando alertar" description="Tempo parado a partir do qual um job ou publicação gera alerta." />
        <CardBody>
          {s.settings.loading || (!d && !s.settings.error) ? (
            <LoadingBlock rows={2} />
          ) : !d ? (
            <ErrorState compact error={s.settings.error} onRetry={() => void s.settings.reload()} />
          ) : (
            <div className="space-y-4">
              {s.err ? <Notice tone="danger">{s.err}</Notice> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Job travado após" suffix="min" value={d.stuckJobMinutes} onChange={(v) => s.setDraft({ ...d, stuckJobMinutes: v ?? 0 })} error={errors.job} />
                <NumberField label="Publicação travada após" suffix="min" value={d.stuckPublicationMinutes} onChange={(v) => s.setDraft({ ...d, stuckPublicationMinutes: v ?? 0 })} error={errors.pub} />
              </div>
              <Button variant="primary" onClick={() => void s.save()} loading={s.busy} disabled={!s.dirty || Object.keys(errors).length > 0}>
                Salvar
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ operação (somente leitura)

function OperationTab() {
  const settings = useFetch('settings', (s) => api.settings(s));
  const s = settings.data;
  return (
    <Card>
      <CardHeader title="Variáveis operacionais" description="Somente leitura. Chaves e segredos ficam no servidor (variáveis de ambiente) e não aparecem aqui." actions={<Badge tone="neutral" dot={false}>Somente leitura</Badge>} />
      {settings.loading ? (
        <LoadingBlock rows={4} />
      ) : settings.error && !s ? (
        <ErrorState error={settings.error} onRetry={() => void settings.reload()} />
      ) : s ? (
        <CardBody className="space-y-6">
          <DefList
            items={[
              { label: 'Exigir link de afiliado validado', value: <Badge tone="success">Sempre (não editável)</Badge> },
              { label: 'Seguir redirecionamentos na validação', value: s.affiliate.resolveRedirects ? 'Sim (com proteção SSRF)' : 'Não' },
              { label: 'Retenção de logs', value: `${s.retention.logDays} dias` },
              { label: 'Retenção do histórico de preços', value: `${s.retention.priceHistoryDays} dias` },
              { label: 'Fonte de ofertas configurada', value: s.monitoring.source === 'fixture' ? 'fixture (dados de teste)' : 'Mercado Livre (API oficial)' },
            ]}
          />
          <div>
            <h3 className="mb-2 text-sm font-semibold">Domínios permitidos para links de afiliado</h3>
            <ul className="flex flex-wrap gap-2">
              {s.affiliate.allowedHosts.map((h) => (
                <li key={h} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------ view

function Inner() {
  const params = useSearchParams();
  const fromUrl = params.get('tab');
  const [tab, setTab] = useState<TabId>(TAB_IDS.includes(fromUrl as TabId) ? (fromUrl as TabId) : 'conta');
  const items = useMemo(
    () => [
      { id: 'conta', label: 'Conta' },
      { id: 'seguranca', label: 'Segurança' },
      { id: 'logs', label: 'Logs' },
      { id: 'auditoria', label: 'Auditoria' },
      { id: 'alertas', label: 'Alertas' },
      { id: 'mensagens', label: 'Mensagens' },
      { id: 'operacao', label: 'Variáveis operacionais' },
    ],
    [],
  );
  const change = (id: string) => {
    setTab(id as TabId);
    try {
      window.history.replaceState(null, '', `?tab=${id}`);
    } catch {
      /* ignora */
    }
  };

  return (
    <>
      <PageHeader title="Configurações" description="Conta, segurança, logs, auditoria, alertas e preferências de mensagem." />
      <Tabs label="Seções de configurações" idPrefix="cfg" items={items} value={tab} onChange={change} />
      <TabPanel id={tab} idPrefix="cfg" active>
        {tab === 'conta' ? <AccountTab /> : null}
        {tab === 'seguranca' ? <SecurityTab /> : null}
        {tab === 'logs' ? <LogsTab /> : null}
        {tab === 'auditoria' ? <AuditTab /> : null}
        {tab === 'alertas' ? <AlertsTab /> : null}
        {tab === 'mensagens' ? <MessagesTab /> : null}
        {tab === 'operacao' ? <OperationTab /> : null}
      </TabPanel>
    </>
  );
}

export function SettingsView() {
  return (
    <Suspense fallback={<LoadingBlock rows={4} />}>
      <Inner />
    </Suspense>
  );
}
