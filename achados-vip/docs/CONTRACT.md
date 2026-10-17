# Contrato técnico (fonte de verdade entre módulos)

Monorepo `achados-vip/`: `apps/api` (Fastify + Prisma + BullMQ, TypeScript ESM, Node 20+) e `apps/web` (Next.js 15 App Router + Tailwind 3).
Dinheiro sempre em **centavos (Int)**. Datas em ISO-8601 nas respostas JSON. Textos de UI em **português do Brasil**.
Já existem e NÃO devem ser reescritos sem necessidade: `apps/api/prisma/schema.prisma` (+ migration `init`), `src/domain/types.ts`, `src/domain/settings.ts`.
Se precisar alterar o schema, crie uma NOVA migration (`npx prisma migrate dev --name x`), nunca edite a `init`.

## Regras inegociáveis (produto)
1. Nunca publicar sem `AffiliateLink` com `status = VALIDATED` para o produto. Bloqueio na camada de serviço (não só na UI).
2. Preço original / % de desconto só são exibidos quando `discountVerified = true` (referência verificada: maior preço observado no histórico próprio dentro da janela, ou fonte oficial explícita e coerente). Preço anunciado sem verificação ⇒ mensagem mostra só o preço atual. Nunca inventar preço, cupom, parcelamento, estoque, avaliações ou vendidos.
3. Sucesso de publicação só é registrado após `SendResult.confirmed === true`. Canais manuais geram `MANUAL_READY`, nunca `SENT` automático.
4. Idempotência: `Publication.idempotencyKey = "<offerId>:<channelId>"` (unique). Reinício do processo nunca duplica envio. Antes de enviar, o serviço faz lock otimista (`PENDING|SCHEDULED|FAILED → SENDING` via `updateMany` condicional).
5. Segredos: só em env/`IntegrationCredential.encrypted` (AES-256-GCM, chave `APP_ENCRYPTION_KEY`). Nunca em logs, respostas de API ou frontend.
6. Nada de bypass de CAPTCHA, sessão roubada, scraping de áreas autenticadas, WhatsApp Web não oficial.
7. Métricas de cliques/vendas/comissões: não existem fontes autorizadas ⇒ API devolve `affiliateMetrics: { available: false, reason }`. Nunca números fictícios.

## Layout e responsabilidades
```
apps/api/src/
  domain/      (puro, sem I/O)  settings.ts types.ts  pricing.ts scoring.ts dedupe.ts antispam.ts offer-kind.ts
  lib/         env.ts db.ts redis.ts crypto.ts logger.ts ssrf.ts http.ts time.ts
  services/    message-formatter.ts affiliate-url.ts (puros) | settings.ts audit.ts logs.ts notifications.ts auth.ts (plataforma)
               price-history.ts discovery.ts validation.ts scoring-service.ts affiliate.ts (descoberta/afiliados)
               publishing.ts policy.ts channels.ts (publicação)
  adapters/    sources/{mercadolivre.ts,fixture.ts}  publishers/{whatsapp-cloud.ts,manual-queue.ts,telegram.ts,webhook.ts}  index.ts (factories)
  queues/      queues.ts workers.ts scheduler.ts recovery.ts
  routes/      um arquivo por área; cada um faz `export default async function (app: FastifyInstance) {...}`; app.ts registra TODOS os *.ts/*.js do diretório automaticamente (prefixo /api já incluído nos paths).
  app.ts server.ts worker.ts scripts/create-admin.ts
apps/api/tests/{unit,integration,sim}/   vitest; integração usa Postgres/Redis reais de teste (env TEST_DATABASE_URL/TEST_REDIS_URL).
apps/web/                Next.js (painel). Fala só com `/api/*` (rewrite same-origin para API_INTERNAL_URL).
infra/                   docker-compose.yml, Caddyfile, backup, scripts.
docs/                    VIABILIDADE.md CONTRACT.md API.md INTEGRACOES.md DEPLOY.md TESTES.md
```

## Funções públicas dos módulos de domínio (puros)
- `pricing.ts`: `calcDiscountPct(originalCents, priceCents): number | null` (inteiro arredondado p/ baixo? NÃO: `Math.round`; null se original<=price ou inválido), `calcSavingsCents`, `formatBRL(cents): string` ("R$ 1.299,90"), `verifiedReference(history, priceCents, now, {windowDays=90, minObservations}): number|null` (maior preço observado na janela que seja > priceCents; exige `minObservations` observações), `isAdvertisedDiscountPlausible(advertisedOriginal, price, history)`.
- `scoring.ts`: `scoreOffer(input: ScoreInput, settings: Settings): ScoreResult`; pesos normalizados (soma→100); critério sem dado real contribui 0 e a nota registra "sem dado"; `tierFor(score, thresholds)`.
- `dedupe.ts`: `familyKey({title, catalogProductId}): string` (catálogo ⇒ `cat:<id>`; senão slug normalizado do título sem acentos/stopwords/numeração de cor), `isSameFamily`.
- `antispam.ts`: `decidePublishWindow(ctx): {allowed, reason?, nextAllowedAt?}` (horário de silêncio com timezone, intervalo mínimo, limite/hora, /dia, /categoria/dia) e `decideRepublish({lastPublishedAt, lastPublishedPriceCents, currentPriceCents, now}, settings): {allowed, reason}`.
- `offer-kind.ts`: `chooseKind({listing/offer flags, score, tier, isTopDiscountOfDay}): OfferKindName` (cupom ⇒ COUPON; flash ⇒ FLASH; maior desconto do dia; tier EXCEPTIONAL ⇒ EXCEPTIONAL_PRICE; popular; senão COMMON).
- `services/message-formatter.ts`: `formatMessage(input: MessageInput, format: MessageFormat): string`; lança erro se `affiliateUrl` vazio. WhatsApp: `*negrito*`, `~riscado~`, `_itálico_`; Telegram HTML: escapar `& < >`, `<b>`, `<s>`. 6 modelos (um por `OfferKindName`). Título resumido (≤ 80 chars, sem CAIXA ALTA excessiva). Rodapé = `disclosure`.
- `services/affiliate-url.ts`: `extractMlItemId(url): string|null` (MLB-123 / MLB123 / /p/MLB…), `checkAffiliateUrlShape(url, allowedHosts): {ok, reason?}` (https, host na lista, sem credenciais na URL, sem IP literal).

## Serviços com banco (assinaturas esperadas)
```ts
// services/settings.ts   (db singleton id=1; cache curto em memória)
getSettings(): Promise<Settings>;  updateSettings(patch: DeepPartial<Settings>, userId?: string): Promise<Settings>;
// services/notifications.ts
notify(n: { level, type, title, body?, dedupeKey? }): Promise<void>   // dedupe por dedupeKey (ignora se existir não-lida)
// services/logs.ts
logEvent(level, scope, message, meta?): Promise<void>                  // sanitiza segredos antes de gravar
// services/price-history.ts
recordObservation(listing, productId, variantId?): Promise<PriceHistory>
loadHistory(productId, sinceDays): Promise<{priceCents:number; observedAt:Date}[]>
// services/discovery.ts   (ProductDiscoveryService + ProductValidationService + DealScoringService)
runDiscovery(opts?: { source?: OfferSource; now?: Date }): Promise<{ found:number; upserted:number; scored:number; approved:number; rejected:number; suspended:number; skipped:number }>
// services/affiliate.ts   (AffiliateLinkService)
addLink(productId, url, createdBy?): Promise<AffiliateLink>   // cria PENDING e já tenta validar
importBatch(text: string, createdBy?): Promise<{ imported:number; validated:number; invalid:{line:number; reason:string}[]; unmatched:{line:number; reason:string}[] }>
validateLink(linkId): Promise<AffiliateLink>
getValidatedLink(productId): Promise<AffiliateLink | null>
listPendingProducts(): Promise<{ productId; title; permalink; offerId?; score? }[]>
// services/publishing.ts   (PublishingService)
enqueueOffer(offerId, opts?: { channelId?: string; force?: boolean; by?: string }): Promise<Publication[]>  // lança PublishBlockedError(code) sem link validado etc.
processDue(now?: Date): Promise<{ sent:number; manualReady:number; failed:number; skipped:number }>
sendPublication(publicationId): Promise<Publication>
retryPublication(id) / cancelPublication(id) / markManualSent(id, by)
// queues/*
registerSchedules(): Promise<void>   // lê settings; upsertJobScheduler p/ discovery (everyMs), publish-tick (60s), maintenance (5min), health (5min)
startWorkers(): { close(): Promise<void> }
recoverOnBoot(): Promise<void>        // libera locks SENDING expirados, reagenda pendentes, marca jobs RUNNING travados
```
Erros de domínio tipados em `src/lib/errors.ts` (`AppError{status, code, message}`; `PublishBlockedError` com `code` ∈ `NO_VALIDATED_LINK | OFFER_NOT_APPROVED | DUPLICATE | OUT_OF_WINDOW | LIMIT_REACHED | CHANNEL_DISABLED | STALE_PRICE | SUSPENDED_PRODUCT`).

## API REST (prefixo `/api`; JSON; cookie de sessão `achados_sid` HttpOnly+SameSite=Strict(+Secure em prod); mutações exigem header `X-CSRF-Token` = `csrfToken` devolvido em login/me)
Erros: `{ "error": { "code": "STRING", "message": "pt-BR", "details"?: any } }` com status HTTP adequado.
Paginação: `?page=1&pageSize=20` ⇒ `{ items: T[], total: number, page, pageSize }`.

| Método e caminho | Corpo / query | Resposta |
|---|---|---|
| POST /api/auth/login | `{email,password}` | `{user:{id,email,role}, csrfToken}` (rate limit + bloqueio progressivo) |
| POST /api/auth/logout | – | `{ok:true}` |
| GET /api/auth/me | – | `{user, csrfToken}` ou 401 |
| POST /api/auth/change-password | `{currentPassword,newPassword}` | `{ok:true}` (invalida outras sessões) |
| GET /api/dashboard | – | `{monitoring:{enabled,status,lastRunAt,lastSuccessAt,lastError,intervalMinutes}, autoPublish:boolean, integrations:[{id,type,name,enabled,status,statusDetail,lastCheckedAt}], source:{name,status,detail}, today:{discovered,approved,published,pending,failed}, pendingAffiliateLinks:number, unreadNotifications:number, series:[{date,discovered,approved,published}], jobs:[{name,status,lastRunAt,lastSuccessAt,lastError,nextRunAt}]}` |
| GET /api/offers | `status,categoryId,minScore,q,sort(score\|discoveredAt\|discountPct),page,pageSize` | página de `OfferDTO` |
| GET /api/offers/:id | – | `OfferDTO & { priceHistory:[{priceCents,originalPriceCents,observedAt,source}], affiliateLinks:[AffiliateLinkDTO], publications:[PublicationDTO], messagePreview:{whatsapp:string, telegram:string}\|null }` |
| POST /api/offers/:id/approve · /reject · /publish | `{note?}` / `{note?}` / `{channelId?}` | `OfferDTO` (publish ⇒ `{offer, publications}`; 409 com `code` se bloqueada) |
| GET /api/affiliate/status | – | `{generation:{available:false, reason:"..."}, credentialsConfigured:boolean, counts:{pending,validated,invalid}}` |
| GET /api/affiliate/links | `status,productId,page` | página de `AffiliateLinkDTO` |
| POST /api/affiliate/links | `{productId,url}` | `AffiliateLinkDTO` |
| POST /api/affiliate/links/import | `{text}` (linhas `URL_ML ; URL_AFILIADO` ou `MLB123 ; URL_AFILIADO`; também aceita CSV com `,`/`;`/TAB) | `{imported,validated,invalid[],unmatched[]}` |
| POST /api/affiliate/links/:id/validate · DELETE /api/affiliate/links/:id | – | `AffiliateLinkDTO` / `{ok}` |
| GET /api/affiliate/pending(.csv) | – | produtos aprovados/qualificados sem link validado (CSV: `id;titulo;url_ml;score`) |
| GET /api/publications | `status,channelId,page` | página de `PublicationDTO` |
| GET /api/publications/manual-queue | – | `PublicationDTO[]` MANUAL_READY com `messageText`, `imageUrl` |
| GET /api/publications/:id | – | `PublicationDTO & {attempts:[...]}` |
| POST /api/publications/:id/retry · /cancel · /mark-sent | – | `PublicationDTO` |
| GET/PUT /api/settings | PUT: patch parcial (zod, strict) | `Settings` (PUT audita before/after) |
| GET /api/categories · PATCH /api/categories/:id | `{enabled?,relevance?,dailyLimit?,minScore?,mlCategoryIds?,searchTerms?}` | `CategoryDTO` |
| POST /api/automation/run-discovery · /run-publisher | – | `{queued:true,jobId}` |
| GET /api/integrations | – | `{source:{...}, channels:[ChannelDTO], credentials:[{id,provider,name,hint,status}] , modes:[{key:'A'\|'B'\|'C',label,status,explanation}]}` |
| POST /api/integrations/credentials | `{provider,name,values:{...}}` (write-only) | `{id,provider,name,hint}` |
| POST /api/integrations/channels · PATCH/DELETE /api/integrations/channels/:id | `{type,name,config,credentialId?,enabled?}` | `ChannelDTO` |
| POST /api/integrations/channels/:id/test · POST /api/integrations/source/test | – | `{ok,status,detail}` (atualiza status do canal) |
| GET /api/logs | `level,scope,page` | página de logs |
| GET /api/audit | `page` | página de auditoria |
| GET /api/notifications · POST /api/notifications/:id/read | – | lista / `{ok}` |
| GET /api/reports/summary | `days=30` | `{period, found, approved, published, failed, byCategory:[{categoryId,name,found,qualified,published}], recentPriceDrops:[{productId,title,fromCents,toCents,pct,at}], affiliateMetrics:{available:false,reason}}` |
| GET /health · GET /ready · GET /docs | – | liveness · db+redis · OpenAPI (Swagger UI) |

DTOs: `OfferDTO{id,status,tier,kind,score,scoreBreakdown,priceCents,originalPriceCents,discountPct,savingsCents,discountVerified,couponCode,discoveredAt,hasValidatedLink,product:{id,title,thumbnail,permalink,sellerName,category:{id,name}|null}}`; `AffiliateLinkDTO{id,productId,productTitle,url,kind,status,validatedAt,validationNote,lastError,createdAt}`; `PublicationDTO{id,offerId,channelId,channelName,channelType,status,template,messageText,imageUrl,scheduledFor,sentAt,attemptsCount,lastError,createdAt,productTitle}`; `ChannelDTO{id,type,name,enabled,config,credentialId,status,statusDetail,lastCheckedAt,automatic}`.

## Filas e workers
Filas BullMQ (prefixo `achados`): `discovery`, `publish`, `maintenance`. Repeatable via `upsertJobScheduler`. `attempts` + backoff exponencial; falhas finais vão para `ScheduledJob.lastError`, `SystemLog` e `Notification`; DLQ = fila `dead-letter` + `Publication.status = DEAD`. Heartbeat em `ScheduledJob.heartbeatAt`. Processo `worker.ts` é separado de `server.ts`.

## Telas do painel (apps/web)
`/login`, `/` (Dashboard), `/ofertas` (+ detalhe em drawer/modal), `/afiliados`, `/publicacoes`, `/automacao`, `/integracoes`, `/configuracoes`. Menu lateral colapsável no mobile. Sem dados fictícios: estados vazios honestos; badges "Conectado / Erro / Autenticação necessária / Não configurado".
