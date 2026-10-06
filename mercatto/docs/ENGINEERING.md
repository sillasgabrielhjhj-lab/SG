# Mercatto — Guia de Engenharia (leia antes de codar)

Este documento é o contrato entre todas as frentes de desenvolvimento. Siga-o à risca.

## Stack

- **Next.js 16.3** (App Router, React 19.3, Server Components, Server Actions, Turbopack)
- **TypeScript 5.9 strict** (`noUncheckedIndexedAccess` ligado — trate `arr[i]` como possivelmente `undefined`)
- **Tailwind CSS 4** (configuração CSS-first em `src/styles/globals.css` via `@theme`; NÃO existe `tailwind.config.js`)
- **PostgreSQL 16 + Prisma 7** (driver adapter `@prisma/adapter-pg`, client gerado em `src/generated/prisma`)
- **Zod 4**, **lucide-react** (ícones — use SOMENTE lucide para consistência), **Vitest 5**, **Playwright**

## Next.js 16 — diferenças importantes

- `params` e `searchParams` são **Promises**: `export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; }`
- `cookies()`, `headers()` são **async**.
- Middleware chama-se **`src/proxy.ts`** (função `export function proxy(request)`), roda em Node.
- `revalidateTag(tag, "max")` exige o segundo argumento; em Server Actions prefira `revalidatePath(path)` ou `updateTag(tag)`.
- Não existe `next lint`; use `npm run lint` (ESLint flat config).
- `next/image`: imagens locais em `/public` funcionam direto; SVGs de `/demo/**` exigem `unoptimized` (use o componente `ProductImage` do design system, que já trata isso).
- Não habilitamos `cacheComponents`. Páginas com dados de sessão são dinâmicas. Use `export const revalidate = N` só em páginas 100% públicas sem leitura de cookies.

## Estrutura de pastas

```
src/
  app/                    # rotas (finas: buscam dados via features e renderizam componentes)
    (store)/              # vitrine com header/footer (home, busca, produto, categoria, loja, carrinho...)
    (auth)/               # entrar, cadastro, recuperar/redefinir senha
    checkout/             # checkout com layout próprio (enxuto)
    minha-conta/          # área do cliente
    vendedor/             # painel do vendedor
    admin/                # painel administrativo
    api/                  # route handlers (webhooks, cron, autocomplete, CEP, uploads)
  components/
    ui/                   # design system primitivo (Button, Input, Modal, Drawer, Toast...)
    commerce/             # componentes de e-commerce reutilizáveis (ProductCard, Price, Rating...)
    layout/               # Header, Footer, BottomNav, MobileMenu
    brand/                # Logo e elementos de marca
    providers/            # providers client (toast, carrinho)
  features/<dominio>/     # lógica de domínio
    *.server.ts | service.ts | queries.ts   -> servidor (import "server-only")
    actions.ts            -> "use server" (Server Actions)
    schemas.ts            -> Zod (isomórfico)
    components/           -> UI específica do domínio
  server/                 # infraestrutura somente-servidor (db, auth, env, erros, logs, provedores)
  lib/                    # utilitários isomórficos puros (money, format, validators, slug, utils)
  hooks/                  # hooks client reutilizáveis
  generated/prisma/       # client Prisma (gerado — não editar)
```

## Regras inegociáveis

1. **Dinheiro = centavos inteiros (`number` inteiro)**. Use `src/lib/money.ts` (`formatBRL`, `parseBRL`, `percentOf`, `allocateProportionally`, `installmentOptions`). Nunca `parseFloat` para dinheiro.
2. **Preço nunca vem do cliente.** Carrinho/checkout sempre recalculam com `src/features/pricing/engine.ts` + `src/features/pricing/promotions.server.ts`.
3. **Autorização sempre no servidor** com `src/server/auth/guards.ts`:
   - Server Actions / Route Handlers: `requireUser()`, `requirePermission("admin:catalog")`, `requireSeller()` (retorna `storeId` — use-o para escopo de TODAS as queries do vendedor ⇒ previne IDOR).
   - Páginas: `requireUserPage(path)`, `requirePermissionPage(perm, path)`, `requireSellerPage(path)`.
   - Permissões em `src/server/auth/rbac.ts`. Papéis: CUSTOMER, SELLER, ADMIN, SUPPORT.
4. **Server Actions** usam `createAction(schema, handler)` de `src/server/action.ts` e retornam `ActionResult<T>` (`ok(data, message?)`). Nunca retorne erros internos ao cliente — lance `AppError` (`src/server/errors.ts`) com mensagem amigável em pt-BR.
5. **Route Handlers** usam `apiRoute(handler)` de `src/server/http.ts` (CSRF same-origin automático em métodos mutáveis; webhooks usam `{ csrf: false }` e validam assinatura).
6. **Validação** com Zod em `schemas.ts` (reutilize `src/lib/validators/br.ts` e `common.ts`: `cpfSchema`, `cepSchema`, `phoneSchema`, `addressSchema`, `optionalText`, `checkbox`, `intField`, `emailSchema`, `passwordSchema`). Mass assignment: nunca passe `input` direto para `prisma.*.create/update` — mapeie campo a campo.
7. **Banco**: importe `db` de `@/server/db` e `type Tx`. Tipos/enums Prisma: `import { Prisma } from "@/generated/prisma/client"` (servidor) e `import { OrderStatus } from "@/generated/prisma/enums"` (enums são seguros em client components). Operações críticas em `db.$transaction`. Estoque: update atômico condicional (`updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` e verificar `count`).
8. **Após alterar** variantes/preço/estoque/promoções/avaliações/dados textuais de produto, chame `recomputeProductAggregates([productId], tx?)` (`src/features/catalog/aggregates.ts`).
9. **Auditoria** (`audit()` em `src/server/observability/audit.ts`) para alteração de preço, estoque, status de pedido, cancelamento, reembolso, papéis, configurações. **Logs** com `logger` (`src/server/observability/logger.ts`) — **proibido `console.log`**. Nunca logar senha, token, cartão, CPF completo.
10. **Sem HTML de usuário**: descrições são texto puro renderizado com quebras de linha (`whitespace-pre-line`). Nunca `dangerouslySetInnerHTML` com dados do banco (exceção: JSON-LD serializado com `JSON.stringify(...).replace(/</g, "\\u003c")`).
11. **Não simular integrações críticas.** Provedores externos ficam atrás das interfaces em `src/server/providers/*/types.ts`. Modo DEV deve ser claramente identificado na UI ("Ambiente de desenvolvimento — nenhuma cobrança real").
12. **Dados DEMO** (`isDemo = true`) devem ser sinalizados visualmente (badge "DEMO") em avaliações/perguntas e excluídos de dados estruturados (JSON-LD `aggregateRating`).
13. **pt-BR em toda a UI**, BRL, datas com `src/lib/format.ts`. Código/identificadores em inglês; textos ao usuário em português.
14. **Acessibilidade**: HTML semântico, `label` em todos os campos, `aria-*` quando necessário, foco visível, alvos de toque ≥ 44px no mobile, `alt` em imagens, modais com foco preso e ESC.
15. **Responsivo mobile-first** (320px → 1920px). Zero overflow horizontal. Use `container-page` para a largura máxima (1280px).
16. **Animações** com CSS/transições (presets `animate-*` e utilitários de movimento do tema — ver "Design system"). Sem bibliotecas de animação. `prefers-reduced-motion` já é respeitado globalmente.
17. **Sem TODO crítico, sem código morto, sem segredos.** Imports com alias `@/`.

## Design system — tokens (Tailwind 4)

- Marca **Jade**: `brand-50 … brand-950`. Botão primário: `bg-brand-700 hover:bg-brand-800 text-white`. Header: `bg-brand-800`.
- **Sol** (ofertas relâmpago/destaques): `sun-50 … sun-900` (texto escuro sobre `sun-300/400`).
- **Coral** (urgência: "últimas unidades"): `coral-*`.
- Neutros semânticos: `bg-canvas` (fundo da página), `bg-surface` (cards), `bg-surface-muted`, `border-line`, `border-line-strong`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-fg-inverse`.
- Estados: `success-*`, `warning-*`, `danger-*`, `info-*` (50/600/700).
- Raios: `rounded-field` (inputs/botões, 10px), `rounded-card` (12px), `rounded-panel` (16px), `rounded-banner` (20px).
- Sombras: `shadow-card`, `shadow-raised` (hover), `shadow-lift` (hover de cards), `shadow-glow` (modais promocionais), `shadow-popover`, `shadow-sheet`.
- Camadas (z-index): use `z-(--z-header)`, `z-(--z-floating)` (aba de cupom), `z-(--z-overlay)`, `z-(--z-modal)`, `z-(--z-toast)` — nunca números soltos em componentes novos.
- Animações: `animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-drawer-right`, `animate-drawer-left`, `animate-sheet-up`, `animate-pop`, `animate-toast-in`, `animate-toast-out`, `animate-bump`, `animate-pulse-soft`; utilitário `skeleton`.
- **Movimento (presets)** — só `transform`/`opacity`, 250–600ms, curva `ease-out-soft`:
  - `animate-fade-up` (opacity 0→1, translateY 15px→0); `animate-enter` com `[--enter-delay:120ms]` para a entrada progressiva da página; `animate-enter-scale` (sem opacidade — seguro para o elemento de LCP); `animate-modal-in` (scale .88→1); `animate-heart`, `animate-check`, `animate-float-in`, `animate-nudge` (2x e para), `animate-confetti` (1x).
  - Entradas usam fill-mode `backwards`: nunca deixe `transform` residual (cria contexto de empilhamento e prende dropdowns).
  - Utilitários: `hover-lift` (cards), `press` (botões/alvos de toque), `shine-once` (selo de oferta, 1x), `fav-reveal` (favorito que aparece no hover do card).
  - **Revelação ao rolar**: marque a seção com `data-reveal` (e a lista com `data-stagger` + `style={{"--i": i}}` nos itens) e renderize `<RevealObserver />` como ÚLTIMO filho da página. Só esconde o que está abaixo da dobra e só depois de hidratar.
  - JS (Web Animations): `src/lib/motion.ts` (`DURATION`, `EASE_*`, `prefersReducedMotion`) e `src/lib/fly-to-cart.ts`.
  - Nada em loop infinito chamando atenção (sem piscar/pular). `prefers-reduced-motion` desliga tudo.
- Utilitários: `container-page`, `scrollbar-none`, `tabular`, `focus-ring`.
- **Honestidade na vitrine**: selos, contadores, "Top N", "frete grátis", benefícios e campanhas só aparecem quando vêm de dado real/configurado (ver `features/home/*.server.ts` e `features/coupons/campaign.server.ts`). Nunca escreva promessa comercial fixa em componente.
- Tipografia: Plus Jakarta Sans (variável). Preços com `tabular`. Densidade de marketplace: textos base `text-sm`, títulos de seção `text-lg/xl font-bold`, sem textos gigantes.

## Rotas (pt-BR)

Vitrine: `/`, `/buscar?q=`, `/categoria/[slug]`, `/produto/[slug]`, `/loja/[slug]`, `/marca/[slug]`, `/ofertas`, `/oficial`, `/campanha/[slug]`, `/cupom/[code]`, `/carrinho`.
Checkout: `/checkout`, `/checkout/pagamento/[checkoutId]`, `/checkout/confirmacao/[checkoutId]`.
Auth: `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha?token=`, `/verificar-email?token=`.
Cliente: `/minha-conta` (+ `/pedidos`, `/pedidos/[number]`, `/favoritos`, `/enderecos`, `/cupons`, `/avaliacoes`, `/perguntas`, `/dados`, `/seguranca`, `/notificacoes`).
Vendedor: `/vender` (onboarding), `/vendedor` (+ `/produtos`, `/produtos/novo`, `/produtos/[id]`, `/estoque`, `/pedidos`, `/pedidos/[id]`, `/promocoes`, `/cupons`, `/perguntas`, `/avaliacoes`, `/loja`).
Admin: `/admin` (+ `/produtos`, `/produtos/novo`, `/produtos/[id]`, `/estoque`, `/categorias`, `/marcas`, `/pedidos`, `/pedidos/[id]`, `/pagamentos`, `/clientes`, `/vendedores`, `/usuarios`, `/cupons`, `/promocoes`, `/campanhas`, `/banners`, `/avaliacoes`, `/perguntas`, `/configuracoes`, `/auditoria`).
Institucional: `/sobre`, `/contato`, `/ajuda`, `/termos`, `/privacidade`, `/cookies`, `/seguranca`, `/trocas-e-devolucoes`, `/acesso-negado`.
APIs: `/api/search/suggest`, `/api/products/by-ids`, `/api/recommendations`, `/api/cep/[cep]`, `/api/shipping/quote`, `/api/uploads`, `/api/webhooks/payments/[provider]`, `/api/cron/maintenance`, `/api/dev/payments/simulate` (somente gateway dev).

## Contratos entre módulos (nomes exatos)

- `@/server/providers/payments` → `getPaymentGateway(): PaymentGateway`
- `@/server/providers/shipping` → `getShippingProvider(): ShippingProvider`
- `@/server/providers/email` → `getEmailProvider(): EmailProvider`
- `@/server/providers/storage` → `getStorageProvider(): StorageProvider`
- `@/server/providers/cep` → `getCepProvider(): CepProvider`
- `@/features/notifications/service` → `notify(input: { userId; type: NotificationType; title; body; link?; email?: { subject; html; text; template } }, tx?)`
- `@/features/catalog/aggregates` → `recomputeProductAggregates(productIds, tx?)`
- `@/features/catalog/categories.server` → `getCategoryTree()`, `getAllCategories()`, `getCategoryAncestorsMap()`, `getCategoryWithDescendantIds(id)`, `getCategoryBreadcrumb(id)`
- `@/features/pricing/promotions.server` → `loadActivePromotionsFor(products, ancestors, now?, tx?)`
- `@/features/cart/cookie` → `getGuestCartTokenHash()`, `ensureGuestCartTokenHash()`; `@/features/cart/count.server` → `getCartItemCount()`
- `@/features/settings/queries` → `getStoreSettings()` (singleton `StoreSettings`, id "default")

## Testes

- Unitários: `tests/unit/**/*.test.ts` (`npm run test:unit`).
- Integração (banco real de teste `TEST_DATABASE_URL`, resetado a cada execução): `tests/integration/**/*.test.ts` (`npm run test:integration`). Funções que usam `cookies()`/`headers()` não rodam fora do Next — teste os serviços de domínio (que recebem `userId`/`storeId` por parâmetro).
- E2E: `tests/e2e/**/*.spec.ts` (`npm run test:e2e`, Chromium pré-instalado).

Por isso: **serviços de domínio recebem identidade por parâmetro** (`userId`, `storeId`, `actorId`) e as Server Actions fazem a ponte (guard → serviço).

## Qualidade

`npx tsc --noEmit`, `npm run lint`, `npm run test:unit` devem passar. Ao trabalhar em paralelo com outras frentes, filtre a saída do `tsc` pelos seus arquivos e não edite arquivos de outra frente.
