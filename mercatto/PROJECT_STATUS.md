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
- **Painel do vendedor** completo: `/vender` (onboarding com análise), `/vendedor` (dashboard), produtos (lista/novo/editar com variações, fotos, ficha técnica e SEO), estoque (saldos, histórico, movimentações), pedidos (ações da máquina de estados, rastreio, devoluções), promoções e ofertas relâmpago, cupons, perguntas, avaliações, dados da loja e tabela de frete.
- **Admin** completo (menu filtrado por permissão; SUPPORT vê apenas filas operacionais): dashboard executivo, produtos (oficiais e moderação de anúncios), estoque, pedidos (+reembolso manual), pagamentos, categorias e atributos, marcas, promoções, cupons, campanhas, banners, clientes, vendedores (aprovação/suspensão), usuários e papéis, moderação (avaliações/perguntas), auditoria e configurações (parcelamento, PIX, frete grátis, SEO).
- **Institucionais**: sobre, contato, ajuda (FAQ), termos, privacidade (LGPD), cookies, segurança, trocas e devoluções — textos legais marcados como modelo para revisão jurídica; `/acesso-negado`; 404/erro/erro global sem detalhes internos.
- **SEO/PWA**: metadata + canonical + Open Graph (imagem gerada), JSON-LD (sem notas DEMO), robots.txt, sitemap.xml, manifest, ícones PNG/maskable, página offline e service worker que nunca armazena páginas privadas; 404/301 reais nas páginas de detalhe.
- **Prontidão Vercel**: `APP_URL` com fallback automático, `DIRECT_URL` para migrations, CSP com domínios do Mercado Pago quando ativado, `npm run build` validado; guia em `docs/DEPLOY.md`.
- **Testes**: unitários (86), integração do checkout (8, incluindo corrida de clique duplo) e E2E Playwright (compra PIX completa, controle de acesso, mobile). Lint e typecheck sem erros.

## PENDENTE / PRÓXIMOS PASSOS

- Homologar o Mercado Pago em sandbox com credenciais reais (adapter pronto, não testado contra a API real).
- Testes de integração adicionais (busca, carrinho, estoque, pedidos/IDOR, autenticação, marketing) e E2E do fluxo admin (criar produto → publicar → aparece na loja).
- Revisão jurídica dos textos legais e preenchimento de razão social/CNPJ/endereço/encarregado.
- Observabilidade externa (ex.: Sentry/Logtail) e cron mais frequente no plano Pro da Vercel.

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

Deploy na Vercel (ver `docs/DEPLOY.md`) e itens de "PENDENTE / PRÓXIMOS PASSOS".

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
| Gateway de pagamento (Stripe escolhido; Mercado Pago disponível) | `PAYMENT_PROVIDER=stripe`, `STRIPE_*` | adapter implementado e testado (unitário + build); validar no modo de teste da Stripe antes de ativar as chaves de produção |
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
