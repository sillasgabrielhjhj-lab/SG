import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM');

export const ScoringWeightsSchema = z.object({
  discount: z.number().min(0).default(25),
  savings: z.number().min(0).default(10),
  historical: z.number().min(0).default(20),
  seller: z.number().min(0).default(10),
  availability: z.number().min(0).default(8),
  demand: z.number().min(0).default(8),
  category: z.number().min(0).default(5),
  recency: z.number().min(0).default(6),
  listingQuality: z.number().min(0).default(8),
});

export const SettingsSchema = z.object({
  monitoring: z
    .object({
      enabled: z.boolean().default(false),
      intervalMinutes: z.number().int().min(1).max(1440).default(10),
      maxItemsPerCategory: z.number().int().min(1).max(200).default(50),
      source: z.enum(['mercadolivre_api', 'fixture']).default('mercadolivre_api'),
      /** Quedas menores que isso (vs. última observação) não geram nova Offer. */
      minPriceDropPct: z.number().min(0).max(100).default(3),
    })
    .prefault({}),
  scoring: z
    .object({
      weights: ScoringWeightsSchema.prefault({}),
      thresholds: z
        .object({
          exceptional: z.number().int().min(1).max(100).default(90),
          excellent: z.number().int().min(1).max(100).default(75),
          good: z.number().int().min(1).max(100).default(60),
        })
        .prefault({}),
      /** Abaixo disso a oferta nunca é publicada automaticamente. */
      minScoreToPublish: z.number().int().min(0).max(100).default(75),
      /** Mínimo de observações no histórico para considerar o critério "histórico". */
      minHistoryObservations: z.number().int().min(1).default(3),
    })
    .prefault({}),
  publishing: z
    .object({
      autoPublish: z.boolean().default(false),
      minIntervalMinutes: z.number().int().min(0).default(30),
      maxPerHour: z.number().int().min(1).default(2),
      maxPerDay: z.number().int().min(1).default(12),
      maxPerCategoryPerDay: z.number().int().min(1).default(4),
      republishAfterDays: z.number().int().min(0).default(7),
      /** Republicação antes do prazo só se o preço cair ao menos isto (%) vs. o publicado. */
      republishMinAdditionalDropPct: z.number().min(0).max(100).default(10),
      maxAttempts: z.number().int().min(1).max(10).default(5),
      quietHours: z
        .object({
          enabled: z.boolean().default(true),
          start: hhmm.default('00:00'),
          end: hhmm.default('07:00'),
          timezone: z.string().default('America/Sao_Paulo'),
        })
        .prefault({}),
    })
    .prefault({}),
  affiliate: z
    .object({
      /** Não editável na prática: a publicação sempre exige link validado. */
      requireValidatedLink: z.literal(true).default(true),
      allowedHosts: z
        .array(z.string())
        .default(['mercadolivre.com', 'www.mercadolivre.com', 'mercadolivre.com.br', 'www.mercadolivre.com.br', 'meli.la']),
      /** Segue redirecionamentos (com proteção SSRF) para confirmar o produto de destino. */
      resolveRedirects: z.boolean().default(true),
    })
    .prefault({}),
  messages: z
    .object({
      disclosure: z
        .string()
        .default('Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado.'),
      showInstallments: z.boolean().default(true),
      groupName: z.string().default('ACHADOS VIP'),
    })
    .prefault({}),
  alerts: z
    .object({
      stuckJobMinutes: z.number().int().min(1).default(15),
      stuckPublicationMinutes: z.number().int().min(1).default(10),
    })
    .prefault({}),
  retention: z
    .object({
      logDays: z.number().int().min(1).default(30),
      priceHistoryDays: z.number().int().min(30).default(365),
    })
    .prefault({}),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export const defaultSettings = (): Settings => SettingsSchema.parse({});
