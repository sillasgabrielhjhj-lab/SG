# MERCATTO — Status do projeto

> Leia este arquivo primeiro em qualquer nova sessão e continue de onde parou.
> Última atualização: 2026-10-05

## CONCLUÍDO

- **Fundação**: Next.js 16.3 + React 19.3 + TypeScript 5.9 strict + Tailwind 4 + Prisma 7.10 (adapter-pg) + PostgreSQL 16. Schema completo, migration inicial com CHECK constraints, índice parcial, busca full-text (tsvector português) + trigramas.
- **Servidor**: env validado, `AppError`/`ActionResult`/`createAction`, `apiRoute` (CSRF same-origin), logger com redação, auditoria, rate limit em PostgreSQL, sessões em banco (hash SHA-256, cookie `__Host-`), scrypt, RBAC + guards.
- **Domínio**: motor de preços puro, carrinho persistente (convidado + mescla no login), checkout multi-loja com reserva atômica de estoque e idempotência, pagamentos (dev sandbox + Mercado Pago) com webhook assinado e idempotente, reembolsos, pedidos com máquina de estados, estoque com histórico, promoções/ofertas relâmpago/cupons/campanhas, avaliações (DEMO marcadas), perguntas, notificações, upload de imagens (local/Vercel Blob), frete (tabela/Melhor Envio), CEP (ViaCEP), métricas.
- **Seed** idempotente (`SEED_MODE=demo|minimal`) e ilustrações SVG demo geradas por código.
- **Vitrine**: home, busca com filtros na URL, categoria, produto (galeria, variações, frete por CEP, perguntas, avaliações), loja, marca, ofertas, oficial, campanha, categorias.
- **Carrinho e checkout** (endereço → frete → pagamento → revisão → pagamento PIX/cartão com acompanhamento) e confirmação.
- **Autenticação**: entrar, cadastro, recuperar/redefinir senha, verificar e-mail.
- **Área do cliente** `/minha-conta`: resumo, pedidos (timeline, cancelar/devolver), favoritos, endereços, cupons, avaliações (com fotos), perguntas, notificações, dados, segurança (senha + sessões).
- **Painel do vendedor** (parcial): `/vender` (onboarding), `/vendedor` (dashboard), produtos (lista/novo/editar), estoque (saldos/histórico/movimentar), pedidos (lista/detalhe/ações).
- **Admin**: layout `/admin` com menu filtrado por permissão (páginas em construção).
- **Testes**: unitários (dinheiro, validadores BR, preços, schemas, datas, ilustrações) e integração do checkout (concorrência estoque=1, idempotência, corrida de cupom, webhook duplicado/inválido, expiração, cartão dev).

## EM ANDAMENTO / PENDENTE

- Vendedor: promoções, cupons, perguntas, avaliações, loja (dados + tabela de frete).
- Admin: dashboard, produtos, estoque, pedidos (+reembolso), pagamentos, categorias/atributos, marcas, promoções, cupons, campanhas, banners, clientes, vendedores (aprovação), usuários/papéis, moderação, auditoria, configurações.
- Institucionais (`/sobre`, `/contato`, `/ajuda`, `/termos`, `/privacidade`, `/cookies`, `/seguranca`, `/trocas-e-devolucoes`), `/acesso-negado`, páginas de erro.
- SEO técnico (sitemap, robots, OG) e PWA (manifest, ícones, offline).
- Testes de integração adicionais e E2E (Playwright).
- Auditoria final, README completo, guia de deploy na Vercel.

## BLOCOS DE UI REUTILIZÁVEIS (use antes de criar novos)

| Bloco | Arquivo | Uso |
|---|---|---|
| Design system | `src/components/ui/*` (exporta em `index.ts`) | Button/ButtonLink/IconButton, Field, Input/Textarea/Select, MaskedInput/PriceInput, Checkbox/Radio/RadioCard/Switch, Modal, ConfirmDialog, Drawer, DropdownMenu, Tabs, Table, Badge, Alert, EmptyState, Pagination (server-safe, `buildHref`), StatCard, Toast (`useToast`), Skeleton, Spinner, Tooltip, CopyButton, Countdown |
| Shell de painéis | `src/components/layout/dashboard-shell.tsx` | Usado por `/vendedor` e `/admin` (layouts prontos) |
| Navegação de painel | `src/components/layout/panel-nav.tsx` | `PanelNav` (grupos, badge, ativo por rota) |
| Título de página | `src/components/layout/page-heading.tsx` | `PageHeading({ title, description, actions })` |
| Gráficos | `src/components/charts/sales-chart.tsx`, `period-tabs.tsx` | `SalesChart`, `RankBars`, `PeriodTabs` |
| Produtos (gestão) | `src/features/products/components/product-list-view.tsx`, `product-table.tsx`, `product-editor.tsx` | `mode: "seller" \| "admin"` |
| Estoque | `src/features/inventory/components/stock-view.tsx` | `StockView({ scope, mode, basePath, productBasePath, searchParams })` |
| Pedidos (gestão) | `src/features/orders/components/order-list-view.tsx`, `order-manage-view.tsx`, `order-manage-actions.tsx`, `order-ui.tsx` | Lista, detalhe com ações (transições, reembolso admin), badge, timeline, endereço |
| Loja | `src/features/seller/components/store-forms.tsx` | `StoreProfileForm`, `ShippingRulesEditor` |
| Comércio | `src/components/commerce/*` | ProductImage, Price, RatingStars, badges (Oficial, DEMO…), ProductCard/Grid/Rail |

Convenções de páginas: Server Components buscam dados com o guard da área (`requireUserPage`, `requireSellerPage`, `requirePermissionPage(perm, returnTo)`); mutações via Server Actions (`createAction`) chamadas por componentes cliente que mostram toast e fazem `router.refresh()`. Filtros/paginação na URL (`?status=`, `?q=`, `?pagina=`). Nunca passe funções de Server Components para Client Components.

## PRÓXIMA ETAPA

Concluir vendedor + admin, institucionais/SEO/PWA/erros, testes E2E, auditoria e documentação de deploy.

## DECISÕES TÉCNICAS

- **Monorepo simples**: o app vive em `mercatto/` (o restante do repositório é o site pessoal publicado no GitHub Pages). Na Vercel: Root Directory = `mercatto`.
- **Auth própria** (sem NextAuth beta): sessões em banco, token opaco no cookie, scrypt nativo — controle total de RBAC e revogação.
- **Dinheiro em centavos inteiros** em todo o sistema.
- **Checkout multi-loja**: um `Checkout` (um pagamento) gera um `Order` por loja — cada vendedor gerencia o próprio pedido.
- **Estoque**: reserva por decremento atômico condicional na criação do checkout; liberação idempotente em falha/expiração (cron + verificação sob demanda).
- **Busca**: PostgreSQL full-text + pg_trgm (sem serviço externo). Caminho de evolução: Meilisearch/Typesense atrás da mesma interface.
- **Rate limit** em PostgreSQL (funciona entre instâncias serverless sem Redis).
- **Imagens demo**: ilustrações SVG geradas por código (sem dependência de bancos de imagem).
- **Loja oficial Mercatto** = uma `Store` com `isOfficial = true` administrada pelo ADMIN.

## DEPENDÊNCIAS EXTERNAS (precisam de credenciais do proprietário)

| Integração | Variáveis | Estado |
|---|---|---|
| PostgreSQL de produção (Neon/Supabase/Prisma Postgres) | `DATABASE_URL` | necessário para deploy |
| Gateway de pagamento (Mercado Pago sugerido) | `PAYMENT_PROVIDER`, `MERCADOPAGO_*` | adapter implementado; validar em sandbox |
| E-mail transacional (Resend) | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | adapter implementado |
| Armazenamento de imagens (Vercel Blob) | `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN` | adapter implementado |
| Frete (Melhor Envio) — opcional | `SHIPPING_PROVIDER`, `MELHORENVIO_TOKEN` | tabela própria funciona sem terceiros |
| Domínio próprio | — | decisão do proprietário |

## AMBIENTE LOCAL

- PostgreSQL 16 local: `pg_ctlcluster 16 main start`. Bancos: `mercatto` (dev, seed demo), `mercatto_test`, `mercatto_test_a`…`_f` (testes).
- Contas demo (senha `Mercatto@2026`): admin@mercatto.dev, suporte@mercatto.dev, technova@mercatto.dev (vendedor), cliente@mercatto.dev, novaloja@mercatto.dev (loja pendente).
- Playwright: Chromium em `/opt/pw-browsers/chromium` (`executablePath`).
- Não rode `prisma migrate reset` sem consentimento explícito do proprietário (guarda de segurança); testes usam `prisma migrate deploy`.

## ERROS CONHECIDOS

- Nenhum registrado até o momento.
