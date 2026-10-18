'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { JobsTable } from '@/components/jobs-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { NumberField } from '@/components/ui/number-field';
import { Modal } from '@/components/ui/overlay';
import { EmptyState, ErrorState, LoadingBlock, Notice } from '@/components/ui/states';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { WEIGHT_LABELS } from '@/lib/labels';
import { WEIGHT_KEYS, type CategoryDTO, type DeepPartial, type Settings } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

const DEFAULT_WEIGHTS: Record<(typeof WEIGHT_KEYS)[number], number> = {
  discount: 25,
  savings: 10,
  historical: 20,
  seller: 10,
  availability: 8,
  demand: 8,
  category: 5,
  recency: 6,
  listingQuality: 8,
};

const COMMON_TZ = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Cuiaba', 'America/Rio_Branco', 'America/Noronha', 'UTC'];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

type Errors = Record<string, string>;

function range(errors: Errors, key: string, v: number, min: number, max: number, integer = true) {
  if (!Number.isFinite(v)) errors[key] = 'Informe um número.';
  else if (integer && !Number.isInteger(v)) errors[key] = 'Use um número inteiro.';
  else if (v < min || v > max) errors[key] = `Use um valor entre ${min} e ${max}.`;
}

export function validateSettings(s: Settings): Errors {
  const e: Errors = {};
  range(e, 'monitoring.intervalMinutes', s.monitoring.intervalMinutes, 1, 1440);
  range(e, 'monitoring.maxItemsPerCategory', s.monitoring.maxItemsPerCategory, 1, 200);
  range(e, 'monitoring.minPriceDropPct', s.monitoring.minPriceDropPct, 0, 100, false);
  range(e, 'publishing.minIntervalMinutes', s.publishing.minIntervalMinutes, 0, 1440);
  range(e, 'publishing.maxPerHour', s.publishing.maxPerHour, 1, 1000);
  range(e, 'publishing.maxPerDay', s.publishing.maxPerDay, 1, 10000);
  range(e, 'publishing.maxPerCategoryPerDay', s.publishing.maxPerCategoryPerDay, 1, 10000);
  range(e, 'publishing.republishAfterDays', s.publishing.republishAfterDays, 0, 365);
  range(e, 'publishing.republishMinAdditionalDropPct', s.publishing.republishMinAdditionalDropPct, 0, 100, false);
  range(e, 'publishing.maxAttempts', s.publishing.maxAttempts, 1, 10);
  range(e, 'scoring.minScoreToPublish', s.scoring.minScoreToPublish, 0, 100);
  range(e, 'scoring.minHistoryObservations', s.scoring.minHistoryObservations, 1, 1000);
  const t = s.scoring.thresholds;
  range(e, 'scoring.thresholds.exceptional', t.exceptional, 1, 100);
  range(e, 'scoring.thresholds.excellent', t.excellent, 1, 100);
  range(e, 'scoring.thresholds.good', t.good, 1, 100);
  if (!e['scoring.thresholds.excellent'] && t.excellent >= t.exceptional) e['scoring.thresholds.excellent'] = 'Deve ser menor que “Excepcional”.';
  if (!e['scoring.thresholds.good'] && t.good >= t.excellent) e['scoring.thresholds.good'] = 'Deve ser menor que “Excelente”.';
  let sum = 0;
  for (const k of WEIGHT_KEYS) {
    const w = s.scoring.weights[k];
    if (!Number.isFinite(w) || w < 0) e[`scoring.weights.${k}`] = 'Use um valor ≥ 0.';
    else sum += w;
  }
  if (sum <= 0) e['scoring.weights'] = 'A soma dos pesos precisa ser maior que zero.';
  const q = s.publishing.quietHours;
  if (!HHMM.test(q.start)) e['publishing.quietHours.start'] = 'Use HH:MM.';
  if (!HHMM.test(q.end)) e['publishing.quietHours.end'] = 'Use HH:MM.';
  if (!validTz(q.timezone)) e['publishing.quietHours.timezone'] = 'Fuso horário inválido (ex.: America/Sao_Paulo).';
  return e;
}

const SECTIONS = ['monitoring', 'scoring', 'publishing'] as const;

// ------------------------------------------------------------------ categorias

function CategoriesCard() {
  const toast = useToast();
  const cats = useFetch('categories-admin', (s) => api.categories(s));
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (c: CategoryDTO, enabled: boolean) => {
    if (enabled && c.mlCategoryIds.length === 0 && c.searchTerms.length === 0) {
      toast.warning('Informe de onde buscar', 'Para ativar, cadastre ao menos um ID de categoria do Mercado Livre ou um termo de busca.');
      setEditing(c);
      return;
    }
    setBusyId(c.id);
    try {
      const upd = await api.updateCategory(c.id, { enabled });
      cats.mutate((prev) => prev?.map((x) => (x.id === c.id ? { ...x, ...upd } : x)));
      toast.success(enabled ? `Categoria “${c.name}” ativada` : `Categoria “${c.name}” desativada`);
    } catch (e) {
      toast.fromError(e, 'Não foi possível alterar a categoria');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Categorias monitoradas" description="Ative apenas as categorias que deseja monitorar. Cada categoria pode ter limite diário e pontuação mínima próprios." />
      {cats.loading ? (
        <LoadingBlock rows={4} />
      ) : cats.error && !cats.data ? (
        <ErrorState error={cats.error} onRetry={() => void cats.reload()} title="Não foi possível carregar as categorias" />
      ) : !cats.data || cats.data.length === 0 ? (
        <EmptyState title="Nenhuma categoria cadastrada" description="As categorias iniciais são criadas pelo seed do banco de dados." />
      ) : (
        <Table caption="Categorias monitoradas">
          <THead>
            <Tr>
              <Th>Categoria</Th>
              <Th>Ativa</Th>
              <Th className="hidden sm:table-cell">Relevância</Th>
              <Th className="hidden md:table-cell">Limite/dia</Th>
              <Th className="hidden md:table-cell">Score mín.</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {cats.data.map((c) => {
              const noSource = c.mlCategoryIds.length === 0 && c.searchTerms.length === 0;
              return (
                <Tr key={c.id}>
                  <Td>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">
                      {c.mlCategoryIds.length} ID(s) ML · {c.searchTerms.length} termo(s)
                    </p>
                    {c.enabled && noSource ? <p className="text-xs text-warning-ink">Sem IDs nem termos: nada será buscado.</p> : null}
                  </Td>
                  <Td>
                    <Toggle label={<span className="sr-only">{`Ativar categoria ${c.name}`}</span>} checked={c.enabled} busy={busyId === c.id} onChange={(v) => void toggle(c, v)} />
                  </Td>
                  <Td className="hidden tabular-nums sm:table-cell">{c.relevance}</Td>
                  <Td className="hidden tabular-nums md:table-cell">{c.dailyLimit ?? <span className="text-muted">padrão</span>}</Td>
                  <Td className="hidden tabular-nums md:table-cell">{c.minScore ?? <span className="text-muted">global</span>}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setEditing(c)}>
                        Editar
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      {editing ? (
        <CategoryModal
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={(upd) => {
            cats.mutate((prev) => prev?.map((x) => (x.id === upd.id ? { ...x, ...upd } : x)));
            setEditing(null);
          }}
        />
      ) : null}
    </Card>
  );
}

const splitList = (s: string): string[] => [...new Set(s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];

function CategoryModal({ category, onClose, onSaved }: { category: CategoryDTO; onClose: () => void; onSaved: (c: CategoryDTO) => void }) {
  const toast = useToast();
  const [relevance, setRelevance] = useState<number>(category.relevance);
  const [dailyLimit, setDailyLimit] = useState<number | null>(category.dailyLimit);
  const [minScore, setMinScore] = useState<number | null>(category.minScore);
  const [ids, setIds] = useState(category.mlCategoryIds.join('\n'));
  const [terms, setTerms] = useState(category.searchTerms.join('\n'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const errs: Errors = {};
  range(errs, 'relevance', relevance, 0, 100);
  if (dailyLimit !== null) range(errs, 'dailyLimit', dailyLimit, 1, 10000);
  if (minScore !== null) range(errs, 'minScore', minScore, 0, 100);
  const idList = splitList(ids).map((x) => x.toUpperCase());
  if (idList.some((x) => !/^MLB\d+$/.test(x))) errs.ids = 'Use o formato MLB seguido de números (ex.: MLB1055).';
  if (splitList(terms).some((x) => x.length < 2)) errs.terms = 'Cada termo precisa ter ao menos 2 caracteres.';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (Object.keys(errs).length) return;
    setBusy(true);
    setErr(null);
    try {
      const upd = await api.updateCategory(category.id, { relevance, dailyLimit, minScore, mlCategoryIds: idList, searchTerms: splitList(terms) });
      toast.success('Categoria atualizada');
      onSaved(upd);
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
      title={`Editar categoria — ${category.name}`}
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="form-categoria" variant="primary" loading={busy} disabled={Object.keys(errs).length > 0}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-categoria" onSubmit={submit} className="space-y-4">
        {err ? <Notice tone="danger">{err}</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Relevância (0–100)" hint="Entra no score." value={relevance} onChange={(v) => setRelevance(v ?? 0)} error={errs.relevance} />
          <NumberField label="Limite diário" hint="Vazio = limite padrão." value={dailyLimit} nullable onChange={setDailyLimit} error={errs.dailyLimit} />
          <NumberField label="Score mínimo" hint="Vazio = usa o global." value={minScore} nullable onChange={setMinScore} error={errs.minScore} />
        </div>
        <Field label="IDs de categoria do Mercado Livre" hint="Um por linha ou separados por vírgula (ex.: MLB1055)." error={errs.ids}>
          <textarea className="input font-mono text-xs" rows={3} value={ids} onChange={(e) => setIds(e.target.value)} spellCheck={false} />
        </Field>
        <Field label="Termos de busca" hint="Um por linha ou separados por vírgula." error={errs.terms}>
          <textarea className="input" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ view

export function AutomationView() {
  const toast = useToast();
  const settings = useFetch('settings', (s) => api.settings(s));
  const dash = useFetch('automation-dashboard', (s) => api.dashboard(s), { intervalMs: 15_000 });
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [running, setRunning] = useState<'discovery' | 'publisher' | null>(null);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const saved = settings.data;

  useEffect(() => {
    if (saved && !draft) setDraft(clone(saved));
  }, [saved, draft]);

  const errors = useMemo(() => (draft ? validateSettings(draft) : {}), [draft]);
  const dirtySections = useMemo(() => (draft && saved ? SECTIONS.filter((k) => !same(draft[k], saved[k])) : []), [draft, saved]);
  const dirty = dirtySections.length > 0;

  // Avisa ao sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = <S extends (typeof SECTIONS)[number]>(section: S, mut: (s: Settings[S]) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      mut(next[section]);
      return next;
    });

  const applySaved = (s: Settings) => {
    settings.mutate(s);
  };

  const save = async () => {
    if (!draft || !saved || dirtySections.length === 0 || Object.keys(errors).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: DeepPartial<Settings> = {};
      for (const k of dirtySections) (patch as Record<string, unknown>)[k] = clone(draft[k]);
      const res = await api.updateSettings(patch);
      applySaved(res);
      setDraft(clone(res));
      toast.success('Configurações salvas', 'A alteração foi registrada na auditoria.');
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  /** Interruptores principais: salvam na hora, só o campo alterado. */
  const saveToggle = async (section: 'monitoring' | 'publishing', field: 'enabled' | 'autoPublish', value: boolean) => {
    setToggleBusy(field);
    try {
      const res = await api.updateSettings({ [section]: { [field]: value } } as DeepPartial<Settings>);
      applySaved(res);
      setDraft((d) => (d ? { ...d, [section]: { ...d[section], [field]: (res[section] as Record<string, unknown>)[field] } } : d));
      toast.success(
        field === 'enabled' ? (value ? 'Monitoramento ligado' : 'Monitoramento desligado') : value ? 'Publicação automática ligada' : 'Publicação automática desligada',
      );
      void dash.reload();
    } catch (e) {
      toast.fromError(e, 'Não foi possível alterar');
    } finally {
      setToggleBusy(null);
    }
  };

  const run = async (kind: 'discovery' | 'publisher') => {
    setRunning(kind);
    try {
      const r = kind === 'discovery' ? await api.runDiscovery() : await api.runPublisher();
      if (r.queued) toast.success(kind === 'discovery' ? 'Busca enfileirada' : 'Processamento enfileirado', `Job ${r.jobId}. O resultado aparece em “Execuções”.`);
      else toast.warning('A tarefa não foi enfileirada', 'Já existe uma execução em andamento ou o worker está parado.');
      setTimeout(() => void dash.reload(), 2000);
    } catch (e) {
      toast.fromError(e, 'Não foi possível iniciar a tarefa');
    } finally {
      setRunning(null);
    }
  };

  const weightSum = draft ? WEIGHT_KEYS.reduce((a, k) => a + (Number.isFinite(draft.scoring.weights[k]) ? draft.scoring.weights[k] : 0), 0) : 0;
  const err = (k: string) => errors[k];

  return (
    <>
      <PageHeader
        title="Automação"
        description="Controle o monitoramento, a publicação automática e as regras anti-spam. Alterações são registradas na auditoria."
        actions={
          <>
            <Button onClick={() => void run('discovery')} loading={running === 'discovery'} disabled={running !== null} icon={<Icon name="refresh" size={14} />}>
              Executar busca agora
            </Button>
            <Button onClick={() => void run('publisher')} loading={running === 'publisher'} disabled={running !== null} icon={<Icon name="play" size={14} />}>
              Processar publicações
            </Button>
          </>
        }
      />

      {settings.loading || (!draft && !settings.error) ? (
        <Card>
          <LoadingBlock rows={8} label="Carregando configurações…" />
        </Card>
      ) : settings.error && !draft ? (
        <Card>
          <ErrorState error={settings.error} onRetry={() => void settings.reload()} title="Não foi possível carregar as configurações" />
        </Card>
      ) : draft && saved ? (
        <div className="space-y-6 pb-24">
          <Card>
            <CardHeader title="Controles principais" description="Estes interruptores têm efeito imediato." />
            <CardBody className="space-y-5">
              <Toggle
                label="Monitoramento de ofertas"
                description="Busca ofertas na fonte configurada a cada intervalo, pontua e (se elegíveis) aprova."
                checked={saved.monitoring.enabled}
                busy={toggleBusy === 'enabled'}
                onChange={(v) => void saveToggle('monitoring', 'enabled', v)}
              />
              <hr className="border-line" />
              <Toggle
                label="Publicação automática"
                description="Envia sozinho as ofertas aprovadas pelos canais automáticos, respeitando horários e limites. Exige link de afiliado validado."
                checked={saved.publishing.autoPublish}
                busy={toggleBusy === 'autoPublish'}
                onChange={(v) => (v ? setConfirmAuto(true) : void saveToggle('publishing', 'autoPublish', false))}
              />
              {saved.publishing.autoPublish && saved.scoring.minScoreToPublish < 60 ? (
                <Notice tone="warning">A pontuação mínima para publicar está baixa ({saved.scoring.minScoreToPublish}). Isso pode publicar ofertas pouco atrativas.</Notice>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Monitoramento" />
            <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="Intervalo entre buscas" suffix="min" value={draft.monitoring.intervalMinutes} onChange={(v) => set('monitoring', (m) => void (m.intervalMinutes = v ?? 0))} error={err('monitoring.intervalMinutes')} hint="1 a 1440 minutos." />
              <NumberField label="Itens por categoria" value={draft.monitoring.maxItemsPerCategory} onChange={(v) => set('monitoring', (m) => void (m.maxItemsPerCategory = v ?? 0))} error={err('monitoring.maxItemsPerCategory')} hint="Máximo lido por busca (1–200)." />
              <NumberField label="Queda mínima p/ nova oferta" suffix="%" step={0.5} value={draft.monitoring.minPriceDropPct} onChange={(v) => set('monitoring', (m) => void (m.minPriceDropPct = v ?? 0))} error={err('monitoring.minPriceDropPct')} hint="Quedas menores não geram nova oferta." />
              <Field label="Fonte de ofertas" className="sm:col-span-2 lg:col-span-3" hint="Use “Mercado Livre (API oficial)” em produção.">
                <select className="input" value={draft.monitoring.source} onChange={(e) => set('monitoring', (m) => void (m.source = e.target.value as Settings['monitoring']['source']))}>
                  <option value="mercadolivre_api">Mercado Livre (API oficial)</option>
                  <option value="fixture">Fixture — dados de TESTE (não são ofertas reais)</option>
                </select>
              </Field>
              {draft.monitoring.source === 'fixture' ? (
                <Notice tone="warning" title="Fonte de teste" className="sm:col-span-2 lg:col-span-3">
                  Com “fixture” o sistema gera ofertas fictícias apenas para testar o fluxo. Elas ficam marcadas como fixture e <strong>não devem ser publicadas</strong> em canais reais.
                </Notice>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Limites e anti-spam" description="Valem para todos os canais automáticos." />
            <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="Intervalo mínimo entre publicações" suffix="min" value={draft.publishing.minIntervalMinutes} onChange={(v) => set('publishing', (p) => void (p.minIntervalMinutes = v ?? 0))} error={err('publishing.minIntervalMinutes')} />
              <NumberField label="Máximo por hora" value={draft.publishing.maxPerHour} onChange={(v) => set('publishing', (p) => void (p.maxPerHour = v ?? 0))} error={err('publishing.maxPerHour')} />
              <NumberField label="Máximo por dia" value={draft.publishing.maxPerDay} onChange={(v) => set('publishing', (p) => void (p.maxPerDay = v ?? 0))} error={err('publishing.maxPerDay')} />
              <NumberField label="Máximo por categoria/dia" value={draft.publishing.maxPerCategoryPerDay} onChange={(v) => set('publishing', (p) => void (p.maxPerCategoryPerDay = v ?? 0))} error={err('publishing.maxPerCategoryPerDay')} hint="Pode ser refinado por categoria abaixo." />
              <NumberField label="Republicar após" suffix="dias" value={draft.publishing.republishAfterDays} onChange={(v) => set('publishing', (p) => void (p.republishAfterDays = v ?? 0))} error={err('publishing.republishAfterDays')} hint="Antes disso, só com queda adicional." />
              <NumberField label="Queda adicional p/ republicar antes" suffix="%" step={0.5} value={draft.publishing.republishMinAdditionalDropPct} onChange={(v) => set('publishing', (p) => void (p.republishMinAdditionalDropPct = v ?? 0))} error={err('publishing.republishMinAdditionalDropPct')} />
              <NumberField label="Tentativas máximas de envio" value={draft.publishing.maxAttempts} onChange={(v) => set('publishing', (p) => void (p.maxAttempts = v ?? 0))} error={err('publishing.maxAttempts')} hint="Depois disso a publicação vira falha definitiva." />
              {draft.publishing.maxPerHour > draft.publishing.maxPerDay && !err('publishing.maxPerHour') ? (
                <Notice tone="warning" className="sm:col-span-2 lg:col-span-3">
                  O limite por hora é maior que o limite por dia; o limite diário prevalece.
                </Notice>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Horário de silêncio" description="Nenhuma publicação automática é enviada nesse intervalo." />
            <CardBody className="space-y-4">
              <Toggle
                label="Respeitar horário de silêncio"
                checked={draft.publishing.quietHours.enabled}
                onChange={(v) => set('publishing', (p) => void (p.quietHours.enabled = v))}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Início" error={err('publishing.quietHours.start')}>
                  <input className="input" type="time" value={draft.publishing.quietHours.start} onChange={(e) => set('publishing', (p) => void (p.quietHours.start = e.target.value))} disabled={!draft.publishing.quietHours.enabled} />
                </Field>
                <Field label="Fim" error={err('publishing.quietHours.end')}>
                  <input className="input" type="time" value={draft.publishing.quietHours.end} onChange={(e) => set('publishing', (p) => void (p.quietHours.end = e.target.value))} disabled={!draft.publishing.quietHours.enabled} />
                </Field>
                <Field label="Fuso horário (IANA)" error={err('publishing.quietHours.timezone')}>
                  {(a11y) => (
                    <>
                      <input {...a11y} className="input" list="lista-fusos" value={draft.publishing.quietHours.timezone} onChange={(e) => set('publishing', (p) => void (p.quietHours.timezone = e.target.value))} disabled={!draft.publishing.quietHours.enabled} spellCheck={false} />
                      <datalist id="lista-fusos">
                        {COMMON_TZ.map((z) => (
                          <option key={z} value={z} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
              </div>
              <p className="text-xs text-muted">Se o fim for menor que o início, o silêncio atravessa a meia-noite (ex.: 22:00 → 07:00).</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pontuação das ofertas" description="Abaixo da pontuação mínima a oferta nunca é publicada automaticamente." />
            <CardBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <NumberField label="Pontuação mínima p/ publicar" value={draft.scoring.minScoreToPublish} onChange={(v) => set('scoring', (s) => void (s.minScoreToPublish = v ?? 0))} error={err('scoring.minScoreToPublish')} hint="0 a 100." />
                <NumberField label="Limiar “Excepcional”" value={draft.scoring.thresholds.exceptional} onChange={(v) => set('scoring', (s) => void (s.thresholds.exceptional = v ?? 0))} error={err('scoring.thresholds.exceptional')} />
                <NumberField label="Limiar “Excelente”" value={draft.scoring.thresholds.excellent} onChange={(v) => set('scoring', (s) => void (s.thresholds.excellent = v ?? 0))} error={err('scoring.thresholds.excellent')} />
                <NumberField label="Limiar “Boa”" value={draft.scoring.thresholds.good} onChange={(v) => set('scoring', (s) => void (s.thresholds.good = v ?? 0))} error={err('scoring.thresholds.good')} />
                <NumberField label="Observações mínimas de histórico" value={draft.scoring.minHistoryObservations} onChange={(v) => set('scoring', (s) => void (s.minHistoryObservations = v ?? 0))} error={err('scoring.minHistoryObservations')} hint="Necessárias para verificar descontos." />
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Pesos dos critérios</h3>
                  <div className="flex items-center gap-2">
                    <Badge tone={err('scoring.weights') ? 'danger' : 'info'} dot={false}>
                      Soma: {formatNumber(Math.round(weightSum * 100) / 100)}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => set('scoring', (s) => void (s.weights = { ...DEFAULT_WEIGHTS }))}>
                      Restaurar padrão
                    </Button>
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted">Os pesos são normalizados no cálculo para somar 100; o percentual efetivo de cada critério aparece abaixo do campo. Critério sem dado real contribui 0.</p>
                {err('scoring.weights') ? <Notice tone="danger" className="mb-3">{err('scoring.weights')}</Notice> : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {WEIGHT_KEYS.map((k) => {
                    const w = draft.scoring.weights[k];
                    const eff = weightSum > 0 && Number.isFinite(w) ? ((w / weightSum) * 100).toFixed(1).replace('.', ',') : '0,0';
                    return (
                      <NumberField
                        key={k}
                        label={WEIGHT_LABELS[k].label}
                        hint={`${WEIGHT_LABELS[k].hint} Efetivo: ${eff}%`}
                        value={w}
                        step={0.5}
                        onChange={(v) => set('scoring', (s) => void (s.weights[k] = v ?? 0))}
                        error={err(`scoring.weights.${k}`)}
                      />
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>

          <CategoriesCard />

          <Card>
            <CardHeader title="Execuções" description="Estado das tarefas em segundo plano (atualiza a cada 15 s)." />
            {dash.loading ? <LoadingBlock rows={3} /> : dash.error && !dash.data ? <ErrorState compact error={dash.error} onRetry={() => void dash.reload()} /> : <JobsTable jobs={dash.data?.jobs ?? []} />}
          </Card>

          {/* Barra de salvar */}
          {dirty ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur lg:left-64" role="region" aria-label="Alterações não salvas">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">Alterações não salvas</p>
                  {saveError ? <p className="text-xs text-danger-ink">{saveError}</p> : Object.keys(errors).length > 0 ? <p className="text-xs text-danger-ink">Corrija os campos destacados para salvar.</p> : <p className="text-xs text-muted">Serão salvas em: {dirtySections.map((s) => ({ monitoring: 'Monitoramento', scoring: 'Pontuação', publishing: 'Publicação' })[s]).join(', ')}.</p>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => { setDraft(clone(saved)); setSaveError(null); }} disabled={saving}>
                    Descartar alterações
                  </Button>
                  <Button variant="primary" onClick={() => void save()} loading={saving} disabled={Object.keys(errors).length > 0}>
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmAuto}
        title="Ligar a publicação automática?"
        confirmLabel="Ligar publicação automática"
        description="Com a publicação automática ligada, ofertas aprovadas são enviadas pelos canais automáticos sem sua revisão individual."
        onClose={() => setConfirmAuto(false)}
        onConfirm={async () => {
          await saveToggle('publishing', 'autoPublish', true);
        }}
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Só são enviadas ofertas com link de afiliado validado e pontuação mínima atingida.</li>
          <li>Horário de silêncio e limites por hora/dia/categoria continuam valendo.</li>
          <li>Canais manuais nunca enviam sozinhos.</li>
        </ul>
      </ConfirmDialog>
    </>
  );
}
