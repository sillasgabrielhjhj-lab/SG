# Guia da API REST

Este guia resume a API do Achados VIP para quem vai usá-la (scripts, integrações, testes). A referência interativa e sempre atualizada é o **Swagger UI em `/docs`** (JSON em `/docs/json`). O contrato técnico entre módulos (para quem desenvolve) está em [`CONTRACT.md`](CONTRACT.md).

> A API é **administrativa**: foi feita para o painel. Não há chaves de API nem acesso público às ofertas. Toda rota (exceto as de saúde e o login) exige sessão.

## Convenções

- Prefixo `/api`, JSON (`Content-Type: application/json`), textos de erro em português do Brasil.
- **Dinheiro em centavos** (inteiros): `priceCents: 129990` = R$ 1.299,90. **Datas** em ISO-8601 (UTC).
- **Paginação:** `?page=1&pageSize=20` → `{ "items": [...], "total": 134, "page": 1, "pageSize": 20 }`.
- **Erros:** `{ "error": { "code": "STRING", "message": "texto em pt-BR", "details": ... } }` com o status HTTP adequado. Códigos frequentes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `UNAUTHORIZED` / `INVALID_CREDENTIALS` (401), `FORBIDDEN` / `CSRF_INVALID` / `CSRF_ORIGIN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` / `LOGIN_LOCKED` (429, com `Retry-After`), `INTERNAL_ERROR` (500).
- **Limite de corpo:** 2 MB.

## Autenticação, sessão e CSRF

1. `POST /api/auth/login` com `{ "email", "password" }` devolve `{ "user": {id,email,role}, "csrfToken": "..." }` e define o cookie **`achados_sid`** (`HttpOnly`, `SameSite=Strict`, `Secure` em produção, assinado).
2. Em **toda requisição que altera dados** (`POST`, `PUT`, `PATCH`, `DELETE`), envie o cabeçalho **`X-CSRF-Token: <csrfToken>`**. Sem ele: 403 `CSRF_INVALID`. Se você enviar o cabeçalho `Origin`, ele deve ser igual à origem do painel (`WEB_ORIGIN`), senão 403 `CSRF_ORIGIN`.
3. `GET /api/auth/me` devolve o usuário e o `csrfToken` da sessão atual (ou 401).
4. A sessão dura 12 h com renovação deslizante (limite absoluto de 7 dias). `POST /api/auth/logout` a encerra. Trocar a senha encerra as demais sessões.
5. Perfis: **ADMIN** (tudo) e **VIEWER** (somente leitura; só pode usar as rotas de conta).
6. **Proteções:** limite global de requisições por IP; no login, limite estrito por IP **e** bloqueio progressivo por conta após 5 senhas erradas (1 min, dobrando até 30 min → `429 LOGIN_LOCKED`). Senha: 12 a 128 caracteres.

Exemplo com `curl` (guarde o cookie em um arquivo):

```bash
BASE=https://painel.seudominio.com.br
# login (a senha vem de uma variável, não digitada na linha de comando)
CSRF=$(curl -sS -c jar.txt -H 'content-type: application/json' \
  -d "{\"email\":\"voce@exemplo.com\",\"password\":\"$SENHA\"}" "$BASE/api/auth/login" \
  | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')

curl -sS -b jar.txt "$BASE/api/dashboard"                                           # leitura
curl -sS -b jar.txt -H "X-CSRF-Token: $CSRF" -X POST "$BASE/api/automation/run-discovery"   # mutação
curl -sS -b jar.txt -H "X-CSRF-Token: $CSRF" -X POST "$BASE/api/auth/logout"
```

## Saúde e documentação

| Rota | Autenticação | Descrição |
|---|---|---|
| `GET /health` | não | Liveness (o processo está de pé). Exposta publicamente pelo Caddy. |
| `GET /ready` | não | Readiness: PostgreSQL + Redis (503 se algum falhar). **Não** exposta pelo Caddy; use por dentro da rede do servidor. |
| `GET /docs` | **sim, em produção** (livre fora de produção) | Swagger UI. Em produção, faça login no painel e então abra `/docs` no mesmo navegador. |

## Rotas

Resumo por área. Corpo/consulta entre parênteses. Todas as respostas de sucesso são JSON.

### Conta

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/auth/login` | `{email,password}` | `{user, csrfToken}` |
| `POST /api/auth/logout` | – | `{ok:true}` |
| `GET /api/auth/me` | – | `{user, csrfToken}` |
| `POST /api/auth/change-password` | `{currentPassword,newPassword}` | `{ok:true}` |

### Painel e relatórios

| Rota | Resposta |
|---|---|
| `GET /api/dashboard` | Estado do monitoramento (`enabled,status,lastRunAt,lastSuccessAt,lastError,intervalMinutes`), `autoPublish`, integrações com status, fonte de ofertas, contadores do dia (`discovered,approved,published,pending,failed`), links de afiliado pendentes, notificações não lidas, série diária e jobs (`name,status,lastRunAt,lastSuccessAt,lastError,nextRunAt`). |
| `GET /api/reports/summary?days=30` | Período, totais, por categoria, quedas de preço recentes e `affiliateMetrics`. |

> `affiliateMetrics` é sempre `{ "available": false, "reason": "..." }`: **não existe fonte autorizada** de cliques/vendas/comissões. A API nunca devolve números fictícios.

### Ofertas

| Rota | Parâmetros / corpo | Resposta |
|---|---|---|
| `GET /api/offers` | `status, categoryId, minScore, q, sort (score\|discoveredAt\|discountPct), page, pageSize` | página de **OfferDTO** |
| `GET /api/offers/:id` | – | OfferDTO + `priceHistory`, `affiliateLinks`, `publications`, `messagePreview {whatsapp, telegram}` (nulo se ainda não há link validado) |
| `POST /api/offers/:id/approve` · `/reject` | `{note?}` | OfferDTO |
| `POST /api/offers/:id/publish` | `{channelId?}` | `{offer, publications}`. **409** com `code` específico se a regra bloqueia (tabela abaixo). |

**Códigos de bloqueio de publicação (HTTP 409):**

| `code` | Motivo |
|---|---|
| `NO_VALIDATED_LINK` | O produto não tem link de afiliado **validado** (regra inegociável). |
| `OFFER_NOT_APPROVED` | A oferta não está aprovada. |
| `DUPLICATE` | Já enfileirada/publicada neste canal (idempotência). |
| `OUT_OF_WINDOW` | Horário de silêncio ou intervalo mínimo. |
| `LIMIT_REACHED` | Limite por hora, dia ou categoria atingido. |
| `CHANNEL_DISABLED` | Canal desabilitado. |
| `STALE_PRICE` | O preço mudou desde a descoberta; revalide. |
| `SUSPENDED_PRODUCT` | Produto suspenso por inconsistência de dados. |

### Afiliados

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/affiliate/status` | – | `{generation:{available:false, reason}, credentialsConfigured, counts:{pending,validated,invalid}}` |
| `GET /api/affiliate/links` | `status, productId, page` | página de **AffiliateLinkDTO** |
| `POST /api/affiliate/links` | `{productId,url}` | AffiliateLinkDTO (já tenta validar) |
| `POST /api/affiliate/links/import` | `{text}` — linhas `URL_ML ; URL_AFILIADO` ou `MLB123 ; URL_AFILIADO` (também CSV com `,` `;` ou TAB) | `{imported, validated, invalid:[{line,reason}], unmatched:[{line,reason}]}` |
| `POST /api/affiliate/links/:id/validate` | – | AffiliateLinkDTO |
| `DELETE /api/affiliate/links/:id` | – | `{ok:true}` |
| `GET /api/affiliate/pending` · `/pending.csv` | – | produtos sem link validado (CSV: `id;titulo;url_ml;score`) |

> `generation.available` é sempre `false`: links de afiliado **não** são gerados por API; veja [`INTEGRACOES.md`](INTEGRACOES.md).

### Publicações

| Rota | Resposta |
|---|---|
| `GET /api/publications?status=&channelId=&page=` | página de **PublicationDTO** |
| `GET /api/publications/manual-queue` | lista de publicações `MANUAL_READY` com `messageText` e `imageUrl` |
| `GET /api/publications/:id` | PublicationDTO + `attempts` (tentativas de envio) |
| `POST /api/publications/:id/retry` · `/cancel` · `/mark-sent` | PublicationDTO. `mark-sent` registra a confirmação **humana** de uma publicação manual. |

Status de publicação: `PENDING`, `SCHEDULED`, `SENDING`, `SENT` (**somente** após confirmação do canal), `FAILED`, `DEAD` (esgotou as tentativas), `MANUAL_READY`, `CANCELLED`.

### Configurações e categorias

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/settings` · `PUT /api/settings` | PUT: alteração **parcial** validada de forma estrita (campos desconhecidos são recusados). A mudança é auditada (antes/depois). | `Settings` |
| `GET /api/categories` · `PATCH /api/categories/:id` | `{enabled?, relevance?, dailyLimit?, minScore?, mlCategoryIds?, searchTerms?}` | CategoryDTO |
| `POST /api/automation/run-discovery` · `/run-publisher` | – | `{queued:true, jobId}` (executa em segundo plano pelo worker) |

### Integrações

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /api/integrations` | – | `{source, channels:[ChannelDTO], credentials:[{id,provider,name,hint,status}], modes:[{key:'A'\|'B'\|'C',label,status,explanation}]}` |
| `POST /api/integrations/credentials` | `{provider,name,values:{...}}` — **somente escrita** | `{id,provider,name,hint}` (nunca devolve os valores) |
| `POST /api/integrations/channels` · `PATCH/DELETE /api/integrations/channels/:id` | `{type,name,config,credentialId?,enabled?}` | ChannelDTO |
| `POST /api/integrations/channels/:id/test` · `POST /api/integrations/source/test` | – | `{ok, status, detail}` (atualiza o status do canal/fonte) |

### Observabilidade

| Rota | Resposta |
|---|---|
| `GET /api/logs?level=&scope=&page=` | página de logs do sistema (sem segredos) |
| `GET /api/audit?page=` | página da trilha de auditoria |
| `GET /api/notifications` · `POST /api/notifications/:id/read` | lista / `{ok:true}` |

## Objetos principais

- **OfferDTO:** `id, status, tier, kind, score, scoreBreakdown, priceCents, originalPriceCents, discountPct, savingsCents, discountVerified, couponCode, discoveredAt, hasValidatedLink, product {id,title,thumbnail,permalink,sellerName,category}`.
  - `originalPriceCents`, `discountPct` e `savingsCents` só vêm preenchidos quando `discountVerified = true` (referência verificada pelo histórico próprio). Preço "anunciado" não verificado nunca é exibido como "De/Por".
  - `scoreBreakdown` lista pontos por critério; critério sem dado real contribui 0 e traz a nota "sem dado".
  - `status`: `DISCOVERED, APPROVED, REJECTED, QUEUED, PUBLISHED, EXPIRED, SUSPENDED`; `tier`: `EXCEPTIONAL, EXCELLENT, GOOD, BELOW`; `kind`: `FLASH, TOP_DISCOUNT_OF_DAY, COMMON, EXCEPTIONAL_PRICE, POPULAR, COUPON`.
- **AffiliateLinkDTO:** `id, productId, productTitle, url, kind (MANUAL|IMPORTED|GENERATED), status (PENDING|VALIDATED|INVALID), validatedAt, validationNote, lastError, createdAt`.
- **PublicationDTO:** `id, offerId, channelId, channelName, channelType, status, template, messageText, imageUrl, scheduledFor, sentAt, attemptsCount, lastError, createdAt, productTitle`.
- **ChannelDTO:** `id, type, name, enabled, config, credentialId, status, statusDetail, lastCheckedAt, automatic`. `config` nunca contém segredos; `status ∈ UNKNOWN|CONNECTED|ERROR|AUTH_REQUIRED|DISABLED`.

## Garantias que a API aplica (não só a tela)

1. Nenhuma publicação sem `AffiliateLink` com status `VALIDATED` para o produto.
2. Sucesso de publicação só depois da confirmação do canal; canais manuais geram `MANUAL_READY`.
3. Idempotência por `offerId:channelId`: reiniciar o processo não duplica envios.
4. Segredos nunca em respostas nem em logs (credenciais são somente escrita).
5. Rotas protegidas por padrão: a negação é o comportamento default; só `/health`, `/ready` e o login são públicos.
