/**
 * Dashboard e relatório: agregações SQL reais sobre Offer/Publication/PriceHistory. Sem números fictícios.
 * Métricas de cliques/vendas/comissões NÃO existem (sem fonte autorizada): affiliateMetrics.available = false.
 * "Hoje"/dias seguem o fuso de settings.publishing.quietHours.timezone.
 */

import { hasMlCredentials, ML_PROVIDER } from '../adapters/sources/credentials.js';
import { prisma } from '../lib/db.js';
import { addDays, dayKeyInTz, startOfDayInTz } from '../lib/time.js';
import { countPendingProducts } from './affiliate.js';
import { DISCOVERY_JOB } from './discovery.js';
import { countUnread } from './notifications.js';
import { getSettings } from './settings.js';

const APPROVED_STATUSES = ['APPROVED', 'QUEUED', 'PUBLISHED'] as const;
const PENDING_PUBLICATIONS = ['PENDING', 'SCHEDULED', 'SENDING', 'MANUAL_READY'] as const;
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
/** timestamp UTC "sem fuso" (como o Prisma grava) a partir de um Date. */
const ts = (d: Date): string => d.toISOString();

export const AFFILIATE_METRICS_REASON =
  'Não há fonte autorizada de cliques, vendas ou comissões do programa de afiliados do Mercado Livre; por isso nenhum número é exibido.';

export const SERIES_DAYS = 14;

export interface SourceInfo {
  name: string;
  status: string;
  detail: string | null;
}

async function sourceInfo(sourceSetting: 'mercadolivre_api' | 'fixture', job: { status: string; lastError: string | null; lastSuccessAt: Date | null } | null): Promise<SourceInfo> {
  if (sourceSetting === 'fixture') {
    return { name: 'Fixture (dados de TESTE)', status: 'CONNECTED', detail: 'Fonte de teste: os dados NÃO são ofertas reais e não devem ser publicados.' };
  }
  const name = 'Mercado Livre (API oficial)';
  if (!(await hasMlCredentials())) {
    return { name, status: 'NOT_CONFIGURED', detail: 'Credenciais do Mercado Livre não configuradas. Cadastre-as em Integrações.' };
  }
  const cred = await prisma.integrationCredential.findFirst({ where: { provider: ML_PROVIDER }, orderBy: { updatedAt: 'desc' }, select: { status: true } });
  let status = cred?.status && cred.status !== 'UNKNOWN' ? cred.status : null;
  if (!status) status = job ? (job.status === 'FAILED' ? 'ERROR' : job.lastSuccessAt ? 'CONNECTED' : 'UNKNOWN') : 'UNKNOWN';
  const detail =
    status === 'CONNECTED'
      ? job?.lastSuccessAt
        ? `Última coleta bem-sucedida em ${job.lastSuccessAt.toISOString()}.`
        : 'Conexão testada com sucesso.'
      : status === 'UNKNOWN'
        ? 'Credenciais presentes, mas a conexão ainda não foi testada.'
        : (job?.lastError ?? 'Sem detalhes. Use "Testar fonte" em Integrações.');
  return { name, status, detail };
}

async function dailyCounts(table: 'discovered' | 'approved' | 'published', from: Date, tz: string): Promise<Map<string, number>> {
  const fromTs = ts(from);
  const rows =
    table === 'discovered'
      ? await prisma.$queryRaw<{ day: string; n: number }[]>`
          SELECT to_char(("discoveredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
          FROM "Offer" WHERE "discoveredAt" >= ${fromTs}::timestamp GROUP BY 1`
      : table === 'approved'
        ? await prisma.$queryRaw<{ day: string; n: number }[]>`
          SELECT to_char(("decidedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
          FROM "Offer" WHERE "decidedAt" >= ${fromTs}::timestamp AND "status" IN ('APPROVED','QUEUED','PUBLISHED') GROUP BY 1`
        : await prisma.$queryRaw<{ day: string; n: number }[]>`
          SELECT to_char(("sentAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
          FROM "Publication" WHERE "status" = 'SENT' AND "sentAt" >= ${fromTs}::timestamp GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, Number(r.n)]));
}

export interface DashboardDTO {
  monitoring: { enabled: boolean; status: string; lastRunAt: string | null; lastSuccessAt: string | null; lastError: string | null; intervalMinutes: number };
  autoPublish: boolean;
  integrations: { id: string; type: string; name: string; enabled: boolean; status: string; statusDetail: string | null; lastCheckedAt: string | null }[];
  source: SourceInfo;
  today: { discovered: number; approved: number; published: number; pending: number; failed: number };
  pendingAffiliateLinks: number;
  unreadNotifications: number;
  series: { date: string; discovered: number; approved: number; published: number }[];
  jobs: { name: string; status: string; lastRunAt: string | null; lastSuccessAt: string | null; lastError: string | null; nextRunAt: string | null }[];
}

export async function getDashboard(now: Date = new Date()): Promise<DashboardDTO> {
  const settings = await getSettings();
  const tz = settings.publishing.quietHours.timezone;
  const startToday = startOfDayInTz(now, tz);
  const seriesFrom = startOfDayInTz(addDays(now, -(SERIES_DAYS - 1)), tz);

  const [jobs, channels, discovered, approved, published, pending, failed, pendingLinks, unread, sDisc, sAppr, sPub] = await Promise.all([
    prisma.scheduledJob.findMany({ orderBy: { name: 'asc' } }),
    prisma.publishingChannel.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.offer.count({ where: { discoveredAt: { gte: startToday } } }),
    prisma.offer.count({ where: { decidedAt: { gte: startToday }, status: { in: [...APPROVED_STATUSES] } } }),
    prisma.publication.count({ where: { status: 'SENT', sentAt: { gte: startToday } } }),
    prisma.publication.count({ where: { status: { in: [...PENDING_PUBLICATIONS] } } }),
    prisma.publication.count({ where: { status: { in: ['FAILED', 'DEAD'] }, updatedAt: { gte: startToday } } }),
    countPendingProducts(),
    countUnread(),
    dailyCounts('discovered', seriesFrom, tz),
    dailyCounts('approved', seriesFrom, tz),
    dailyCounts('published', seriesFrom, tz),
  ]);
  const discovery = jobs.find((j) => j.name === DISCOVERY_JOB) ?? null;

  // série contínua (dias sem dado = 0), do mais antigo ao mais recente
  const days: string[] = [];
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const key = dayKeyInTz(addDays(now, -i), tz);
    if (!days.includes(key)) days.push(key);
  }

  return {
    monitoring: {
      enabled: settings.monitoring.enabled,
      status: discovery?.status ?? 'IDLE',
      lastRunAt: iso(discovery?.lastRunAt),
      lastSuccessAt: iso(discovery?.lastSuccessAt),
      lastError: discovery?.lastError ?? null,
      intervalMinutes: settings.monitoring.intervalMinutes,
    },
    autoPublish: settings.publishing.autoPublish,
    integrations: channels.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      enabled: c.enabled,
      status: c.status,
      statusDetail: c.statusDetail,
      lastCheckedAt: iso(c.lastCheckedAt),
    })),
    source: await sourceInfo(settings.monitoring.source, discovery),
    today: { discovered, approved, published, pending, failed },
    pendingAffiliateLinks: pendingLinks,
    unreadNotifications: unread,
    series: days.map((date) => ({ date, discovered: sDisc.get(date) ?? 0, approved: sAppr.get(date) ?? 0, published: sPub.get(date) ?? 0 })),
    jobs: jobs.map((j) => ({
      name: j.name,
      status: j.status,
      lastRunAt: iso(j.lastRunAt),
      lastSuccessAt: iso(j.lastSuccessAt),
      lastError: j.lastError,
      nextRunAt: iso(j.nextRunAt),
    })),
  };
}

// ---------- relatório ----------

export interface ReportSummaryDTO {
  period: { days: number; from: string; to: string };
  found: number;
  approved: number;
  published: number;
  failed: number;
  byCategory: { categoryId: string; name: string; found: number; qualified: number; published: number }[];
  recentPriceDrops: { productId: string; title: string; fromCents: number; toCents: number; pct: number; at: string }[];
  affiliateMetrics: { available: false; reason: string };
}

export async function getReportSummary(days: number, now: Date = new Date()): Promise<ReportSummaryDTO> {
  const from = addDays(now, -days);
  const fromTs = ts(from);
  const lookbackTs = ts(addDays(from, -30)); // linhas anteriores à janela, só para o LAG enxergar o preço anterior

  const [found, approved, published, failed, byCategory, drops] = await Promise.all([
    prisma.offer.count({ where: { discoveredAt: { gte: from } } }),
    prisma.offer.count({ where: { decidedAt: { gte: from }, status: { in: [...APPROVED_STATUSES] } } }),
    prisma.publication.count({ where: { status: 'SENT', sentAt: { gte: from } } }),
    prisma.publication.count({ where: { status: { in: ['FAILED', 'DEAD'] }, updatedAt: { gte: from } } }),
    prisma.$queryRaw<{ categoryId: string; name: string; found: number; qualified: number; published: number }[]>`
      WITH f AS (
        SELECT p."categoryId", COUNT(*)::int AS found, COUNT(*) FILTER (WHERE o."tier" <> 'BELOW')::int AS qualified
        FROM "Offer" o JOIN "Product" p ON p."id" = o."productId"
        WHERE o."discoveredAt" >= ${fromTs}::timestamp AND p."categoryId" IS NOT NULL
        GROUP BY p."categoryId"
      ), s AS (
        SELECT p."categoryId", COUNT(*)::int AS published
        FROM "Publication" pub JOIN "Offer" o ON o."id" = pub."offerId" JOIN "Product" p ON p."id" = o."productId"
        WHERE pub."status" = 'SENT' AND pub."sentAt" >= ${fromTs}::timestamp AND p."categoryId" IS NOT NULL
        GROUP BY p."categoryId"
      )
      SELECT c."id" AS "categoryId", c."name" AS name, COALESCE(f.found, 0)::int AS found,
             COALESCE(f.qualified, 0)::int AS qualified, COALESCE(s.published, 0)::int AS published
      FROM "Category" c LEFT JOIN f ON f."categoryId" = c."id" LEFT JOIN s ON s."categoryId" = c."id"
      WHERE f.found IS NOT NULL OR s.published IS NOT NULL
      ORDER BY found DESC, c."name" ASC`,
    prisma.$queryRaw<{ productId: string; title: string; fromCents: number; toCents: number; pct: number; at: Date }[]>`
      SELECT t."productId", t."title", t."fromCents", t."toCents",
             ROUND(((t."fromCents" - t."toCents")::numeric / t."fromCents") * 100)::int AS pct, t."at"
      FROM (
        SELECT ph."productId", p."title", ph."priceCents" AS "toCents", ph."observedAt" AS "at",
               LAG(ph."priceCents") OVER (PARTITION BY ph."productId", ph."listingId", ph."variantId" ORDER BY ph."observedAt", ph."id") AS "fromCents"
        FROM "PriceHistory" ph JOIN "Product" p ON p."id" = ph."productId"
        WHERE ph."observedAt" >= ${lookbackTs}::timestamp
      ) t
      WHERE t."fromCents" IS NOT NULL AND t."toCents" < t."fromCents" AND t."at" >= ${fromTs}::timestamp
        AND ROUND(((t."fromCents" - t."toCents")::numeric / t."fromCents") * 100) >= 1
      ORDER BY t."at" DESC
      LIMIT 20`,
  ]);

  return {
    period: { days, from: from.toISOString(), to: now.toISOString() },
    found,
    approved,
    published,
    failed,
    byCategory: byCategory.map((r) => ({ categoryId: r.categoryId, name: r.name, found: Number(r.found), qualified: Number(r.qualified), published: Number(r.published) })),
    recentPriceDrops: drops.map((d) => ({ productId: d.productId, title: d.title, fromCents: Number(d.fromCents), toCents: Number(d.toCents), pct: Number(d.pct), at: new Date(d.at).toISOString() })),
    affiliateMetrics: { available: false, reason: AFFILIATE_METRICS_REASON },
  };
}

