# Mercatto

Marketplace brasileiro full-stack com **dois modelos de venda**: produtos **oficiais Mercatto** (estoque próprio, administrados pela equipe) e **lojas parceiras** (vendedores com painel próprio). Construído com Next.js 16 (App Router), React 19, TypeScript estrito, Tailwind CSS 4, Prisma 7 e PostgreSQL 16.

> Ambiente de demonstração: com `PAYMENT_PROVIDER=dev` nenhuma cobrança real acontece — o site exibe uma faixa "Ambiente de demonstração", o PIX gerado não é pagável e todos os dados de exemplo são marcados como **DEMO**.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Funcionalidades](#funcionalidades)
4. [Rodando localmente](#rodando-localmente)
5. [Variáveis de ambiente](#variáveis-de-ambiente)
6. [Banco de dados, migrations e seed](#banco-de-dados-migrations-e-seed)
7. [Contas de demonstração e acesso ao admin](#contas-de-demonstração-e-acesso-ao-admin)
8. [Como cadastrar produtos](#como-cadastrar-produtos)
9. [Pagamentos](#pagamentos)
10. [Testes e qualidade](#testes-e-qualidade)
11. [Deploy na Vercel](#deploy-na-vercel)
12. [Segurança](#segurança)
13. [Estrutura de pastas](#estrutura-de-pastas)
14. [Solução de problemas](#solução-de-problemas)

---

## Visão geral

| Público | Área | Rota |
|---|---|---|
| Visitante / cliente | Vitrine, busca, produto, carrinho, checkout | `/`, `/buscar`, `/produto/[slug]`, `/carrinho`, `/checkout` |
| Cliente | Minha conta (pedidos, favoritos, endereços, cupons, avaliações…) | `/minha-conta` |
| Vendedor | Onboarding e painel da loja | `/vender`, `/vendedor` |
| Administração (ADMIN/SUPPORT) | Painel administrativo | `/admin` |

Papéis (RBAC): `CUSTOMER`, `SELLER`, `ADMIN`, `SUPPORT`. Permissões são derivadas **somente** do papel salvo no banco (`src/server/auth/rbac.ts`).

## Arquitetura

```
Navegador ──► Next.js (Vercel)
               ├─ Server Components (leitura direta via Prisma, com guards de autorização)
               ├─ Server Actions (mutações validadas com Zod + RBAC + rate limit + auditoria)
               ├─ Route Handlers (/api: busca, CEP, frete, upload, webhooks, cron)
               └─ proxy.ts (redirecionamento otimista de áreas privadas)
                    │
                    ▼
               PostgreSQL 16 (Prisma 7 + adapter-pg)
               ├─ full-text search (tsvector português) + pg_trgm
               ├─ CHECK constraints (estoque ≥ 0, valores ≥ 0, nota 1–5…)
               └─ rate limit, sessões, auditoria, idempotência de webhooks

Provedores externos (adapters intercambiáveis em src/server/providers):
  pagamentos: dev (sandbox) | Mercado Pago      frete: tabela própria | Melhor Envio
  e-mail: console | Resend                      imagens: local (dev) | Vercel Blob
  CEP: ViaCEP
```

Decisões principais:

- **Dinheiro em centavos inteiros** em todo o sistema; preços **sempre recalculados no servidor** (o frontend nunca envia preço).
- **Checkout multi-loja**: um `Checkout` (um pagamento) gera um `Order` por loja.
- **Estoque**: reserva com decremento atômico condicional (`stock >= qty`) dentro de transação; liberação idempotente em falha/expiração; pagamentos tardios são re-reservados ou estornados automaticamente.
- **Webhooks** com assinatura HMAC, idempotência por `(provider, eventId)` e bloqueio de linha do pagamento.
- **Promoções**: uma promoção por item (a de maior desconto, sem acúmulo); cupons não se somam a promoções salvo configuração explícita.
- **Autenticação própria**: sessões em banco (token aleatório, hash SHA-256), cookie `httpOnly` `__Host-`, senhas com scrypt, bloqueio após tentativas falhas.

Detalhes e convenções: [`docs/ENGINEERING.md`](docs/ENGINEERING.md). Estado atual e pendências: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Funcionalidades

**Vitrine** — home com banners, categorias, ofertas relâmpago com contagem regressiva real, ofertas do dia, oficiais Mercatto, mais vendidos, recomendados, vistos recentemente, lojas e marcas; busca com autocomplete, histórico, correção de digitação (trigramas), filtros refletidos na URL (categoria, marca, preço, condição, avaliação, frete grátis, promoção, oficial, loja, disponibilidade, atributos) e ordenação; página de produto com galeria (zoom/tela cheia), variações com SKU/estoque/preço/imagem próprios, cálculo de frete por CEP, reputação do vendedor, ficha técnica, perguntas e avaliações; páginas de categoria, marca, loja, campanha e ofertas.

**Compra** — carrinho persistente (convidado e logado, mesclado no login), cupons, checkout em etapas (endereço com preenchimento por CEP → frete por loja → pagamento → revisão), PIX com QR Code e "copia e cola", cartão com parcelamento (Tabela Price), acompanhamento do pagamento e confirmação.

**Cliente** — pedidos com linha do tempo, cancelamento/devolução (direito de arrependimento de 7 dias), favoritos, lojas seguidas, endereços, cupons disponíveis, avaliações com fotos, perguntas, notificações, dados pessoais e segurança (troca de senha, sessões ativas).

**Vendedor** — onboarding com análise da loja, dashboard (faturamento, pedidos, ticket médio, conversão, mais vendidos, estoque baixo), produtos com editor completo (variações, fotos, ficha técnica, SEO), estoque com histórico de movimentações, pedidos (preparar, enviar com rastreio, entregar, cancelar, aprovar/recusar devolução), promoções e ofertas relâmpago, cupons, perguntas, avaliações, dados da loja e tabela de frete.

**Administração** — dashboard executivo, produtos oficiais e moderação de anúncios, estoque, categorias e atributos, marcas, pedidos e reembolsos, pagamentos, promoções, cupons, campanhas, banners, clientes, aprovação de vendedores, usuários e papéis, moderação de avaliações e perguntas, auditoria e configurações da loja (parcelamento, desconto PIX, frete grátis, estoque baixo, SEO).

**Transversal** — SEO técnico (metadata, canonical, Open Graph, sitemap, robots, JSON-LD sem notas fictícias), PWA (manifest, ícones, página offline sem cache de páginas privadas), acessibilidade (WCAG 2.2 AA como meta: navegação por teclado, foco visível, labels, `prefers-reduced-motion`), layout mobile-first de 320 px a 1920 px.

## Rodando localmente

Pré-requisitos: **Node.js ≥ 20.19**, **PostgreSQL ≥ 14** (com as extensões `pg_trgm` e `unaccent` disponíveis — padrão nas distribuições oficiais).

```bash
cd mercatto
cp .env.example .env            # ajuste DATABASE_URL e AUTH_SECRET
npm install                     # também roda "prisma generate"
npm run db:deploy               # aplica as migrations
npm run db:seed                 # dados de demonstração (SEED_MODE=demo)
npm run dev                     # http://localhost:3000
```

Gere segredos com `openssl rand -base64 48` (`AUTH_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET`).

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). Resumo:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | PostgreSQL usado pelo app (em produção, a URL **com pooling**) |
| `DIRECT_URL` | produção | Conexão direta usada pelo Prisma CLI (migrations/seed) |
| `AUTH_SECRET` | sim | ≥ 32 caracteres aleatórios |
| `APP_URL` | recomendado | URL pública; na Vercel cai automaticamente para o domínio do projeto |
| `PAYMENT_PROVIDER` | sim | `dev` (sandbox) ou `mercadopago` |
| `PAYMENT_WEBHOOK_SECRET` | com `dev` | Segredo HMAC do gateway de desenvolvimento |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` | com `mercadopago` | Credenciais do Mercado Pago |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | com `mercadopago` | Chave pública para o formulário de cartão (Brick) |
| `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN` | produção | `vercel-blob` + token do Vercel Blob |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | produção | E-mails transacionais via Resend |
| `SHIPPING_PROVIDER`, `MELHORENVIO_TOKEN` | não | Tabela própria funciona sem terceiros |
| `CRON_SECRET` | produção | Protege `/api/cron/maintenance` |
| `SEED_MODE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | seed | Modo do seed e primeiro administrador |

## Banco de dados, migrations e seed

- Schema: `prisma/schema.prisma`; migrations em `prisma/migrations` (inclui extensões, CHECK constraints, índice parcial e coluna `tsvector` gerada).
- `npm run db:deploy` aplica migrations sem apagar dados (use em produção).
- `npm run db:migrate` cria novas migrations em desenvolvimento.
- **Seed idempotente** (`npm run db:seed`):
  - `SEED_MODE=demo` — catálogo DEMO (≈75 produtos, 220 variações, lojas parceiras, pedidos históricos, avaliações marcadas como DEMO, campanha, ofertas relâmpago, cupons, banners).
  - `SEED_MODE=minimal` — apenas configurações, categorias, regras de frete, loja oficial e o administrador definido por `ADMIN_EMAIL`/`ADMIN_PASSWORD`. **Use este modo em produção real.**

## Contas de demonstração e acesso ao admin

Criadas pelo seed `demo` — senha de todas: **`Mercatto@2026`** (troque ou não use em produção real).

| E-mail | Papel |
|---|---|
| `admin@mercatto.dev` | Administrador (dono da loja oficial) — acesse `/admin` |
| `suporte@mercatto.dev` | Suporte (pedidos, clientes, moderação) |
| `technova@mercatto.dev`, `casaviva@…`, `urbanstep@…`, `bellapele@…`, `garagempro@…` | Vendedores — acesse `/vendedor` |
| `cliente@mercatto.dev` | Cliente com pedidos, favoritos e endereço |
| `novaloja@mercatto.dev` | Vendedor com loja aguardando aprovação |

Em produção, rode o seed `minimal` com `ADMIN_EMAIL` e `ADMIN_PASSWORD` fortes; entre em `/entrar` e acesse `/admin`.

## Como cadastrar produtos

- **Produto oficial Mercatto**: `/admin/produtos` → **Novo produto**. O produto pertence à loja oficial (selo "Oficial Mercatto" / "Vendido pela Mercatto").
- **Produto de loja parceira**: o vendedor entra em `/vendedor/produtos` → **Novo produto** (a loja precisa estar aprovada para publicar).

No editor: nome, categoria, marca, condição, SKU, descrição; fotos (até 12, a primeira é a capa); variações (até 3 tipos, cada combinação com SKU, preço, preço anterior, custo, estoque, estoque mínimo e foto); ficha técnica; garantia; peso e medidas (frete); SEO. Salve como **rascunho** ou **publique** (exige ao menos uma foto e uma variação ativa). Estoque posterior: `/vendedor/estoque` ou `/admin/estoque` (toda movimentação fica registrada).

## Pagamentos

- `PAYMENT_PROVIDER=dev`: gateway de desenvolvimento **claramente identificado**. PIX gera um código não pagável; cartões de teste aprovam/recusam; a aprovação passa pelo **mesmo fluxo de webhook assinado** usado em produção.
- `PAYMENT_PROVIDER=mercadopago`: integração real via API REST (PIX e cartão tokenizado pelo Card Payment Brick — o servidor nunca recebe o número do cartão). Configure o webhook no painel do Mercado Pago para `https://SEU-DOMINIO/api/webhooks/payments/mercadopago` e defina `MERCADOPAGO_WEBHOOK_SECRET`. **Valide em sandbox antes de operar** (adapter implementado, ainda não homologado com credenciais reais). Ao ativar, inclua os domínios do Mercado Pago na CSP (`next.config.ts`).

## Testes e qualidade

```bash
npm run typecheck          # TypeScript estrito
npm run lint               # ESLint
npm run test:unit          # Vitest (dinheiro, validadores BR, motor de preços, schemas…)
TEST_DATABASE_URL=postgresql://…/mercatto_test npm run test:integration
npm run test:e2e           # Playwright (requer app rodando e seed demo)
npm run build
```

Os testes de integração exigem um banco cujo nome contenha `test` e aplicam migrations com `prisma migrate deploy` (não destrutivo). Cobrem concorrência de estoque (dois compradores para a última unidade), idempotência do checkout, corrida de cupom, webhooks duplicados/inválidos, expiração de reservas e o fluxo de cartão.

## Deploy na Vercel

Guia passo a passo em [`docs/DEPLOY.md`](docs/DEPLOY.md). Resumo:

1. Importe o repositório na Vercel e defina **Root Directory = `mercatto`** (framework Next.js).
2. Crie um PostgreSQL (Neon pela Vercel Marketplace, Supabase ou Prisma Postgres) e configure `DATABASE_URL` (pooling) e `DIRECT_URL` (direta).
3. Conecte o **Vercel Blob** (cria `BLOB_READ_WRITE_TOKEN`) e defina `STORAGE_PROVIDER=vercel-blob`.
4. Defina `AUTH_SECRET`, `CRON_SECRET`, `PAYMENT_PROVIDER` (+ segredos) e, se quiser e-mails, `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM`.
5. Deploy: o comando `npm run vercel-build` gera o Prisma Client, **aplica as migrations** e compila.
6. Popule o banco uma vez a partir da sua máquina: `DATABASE_URL=… DIRECT_URL=… SEED_MODE=minimal ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed` (ou `SEED_MODE=demo` para uma vitrine de demonstração).
7. O cron diário (`vercel.json`) chama `/api/cron/maintenance` com `CRON_SECRET`.

## Segurança

- Validação Zod em todas as entradas; consultas parametrizadas (Prisma) — sem SQL concatenado.
- Autorização no servidor em toda página, action e rota (escopo por loja/usuário contra IDOR); campos aceitos explicitamente (sem mass assignment).
- CSRF: Server Actions (proteção nativa) e checagem de origem nas rotas `/api`.
- CSP e cabeçalhos de segurança (`next.config.ts`); HSTS em produção.
- Rate limit em login, cadastro, recuperação de senha, perguntas, avaliações, upload, checkout e cupons.
- Uploads validados por assinatura binária, re-encodados (remove metadados/EXIF) e com tamanho máximo.
- Logs com redação de dados sensíveis; auditoria de ações administrativas; erros de produção sem detalhes internos.
- Nenhum dado de cartão é armazenado (apenas bandeira e 4 últimos dígitos).

## Estrutura de pastas

```
mercatto/
├─ prisma/              schema, migrations e seed
├─ public/              arquivos estáticos (PWA, offline)
├─ src/
│  ├─ app/              rotas (vitrine em (store), (auth), checkout, vendedor, admin, api)
│  ├─ components/       design system (ui), layout, comércio, gráficos
│  ├─ features/         domínios (catalog, search, cart, checkout, payments, orders, …)
│  ├─ lib/              utilitários puros (dinheiro, formatação, validadores BR)
│  └─ server/           env, banco, auth/RBAC, segurança, observabilidade, provedores
├─ tests/               unit, integration, e2e
└─ docs/                engenharia e deploy
```

## Solução de problemas

| Sintoma | Causa provável / solução |
|---|---|
| `Variáveis de ambiente inválidas` ao iniciar | Revise `.env` (ex.: `AUTH_SECRET` com menos de 32 caracteres). |
| Erro de extensão `pg_trgm`/`unaccent` na migration | O usuário do banco precisa poder criar extensões (Neon/Supabase permitem). |
| Upload falha em produção | Configure `STORAGE_PROVIDER=vercel-blob` e conecte o Vercel Blob. |
| Migrations travam com Neon/Supabase | Defina `DIRECT_URL` com a conexão direta (sem pooling). |
| Links de e-mail apontando para localhost | Defina `APP_URL` com o domínio público. |
| Pagamento fica pendente com Mercado Pago | Confira a URL do webhook e `MERCADOPAGO_WEBHOOK_SECRET`; veja os logs do deployment. |

---

Projeto desenvolvido como base profissional. Textos legais (`/termos`, `/privacidade`, `/trocas-e-devolucoes`…) são **modelos** e precisam de revisão jurídica antes da operação real.
