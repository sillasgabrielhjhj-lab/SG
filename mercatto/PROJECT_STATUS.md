# MERCATTO — Status do projeto

> Leia este arquivo primeiro em qualquer nova sessão e continue de onde parou.
> Última atualização: 2026-10-04

## CONCLUÍDO

- Fundação: Next.js 16.3 + React 19.3 + TypeScript 5.9 strict + Tailwind 4 + Prisma 7.10 (adapter-pg) + PostgreSQL 16.
- Schema completo (`prisma/schema.prisma`) e migration inicial com CHECK constraints (estoque ≥ 0, valores ≥ 0, nota 1–5, cupons/promoções válidos), índice parcial (um endereço principal por usuário), busca full-text (tsvector português gerado) + trigramas.
- Núcleo de servidor: env validado (`src/server/env.ts`), Prisma singleton, `AppError` + `ActionResult` + `createAction`, `apiRoute` com CSRF same-origin, logger com redação de dados sensíveis, auditoria, rate limit em PostgreSQL, sessões com token aleatório (hash SHA-256 no banco) em cookie httpOnly/`__Host-`, scrypt, RBAC (CUSTOMER/SELLER/ADMIN/SUPPORT) e guards.
- Motor de preços puro (`src/features/pricing/engine.ts`): promoções sem acúmulo, cupons com elegibilidade/limites/alocação, totais, PIX; testes unitários.
- Utilitários BR: dinheiro em centavos, parcelamento (Tabela Price), CPF/CNPJ/CEP/telefone/UF, formatação pt-BR.
- `proxy.ts` (redirecionamento otimista de áreas privadas), `next.config.ts` com headers de segurança/CSP, `.env.example` documentado.

## EM ANDAMENTO

- Onda 1 (paralela): design system + layout da vitrine; serviços de catálogo/busca/home/produto; núcleo comercial (carrinho, checkout, pedidos, estoque, cupons, pagamentos, webhooks, cron); provedores (pagamento dev + Mercado Pago, frete por tabela + Melhor Envio, e-mail console + Resend, storage local + Vercel Blob, ViaCEP), notificações e upload; seed demo/minimal; ilustrações demo.

## PENDENTE

- Onda 2: páginas da vitrine (home, busca, categoria, produto, loja, ofertas), carrinho/checkout UI, autenticação e área do cliente, painel do vendedor, painel admin, institucionais, SEO técnico, PWA, páginas de erro.
- Onda 3: testes E2E, auditoria final (segurança, performance, acessibilidade, mobile), README completo, preparação de deploy na Vercel.

## PRÓXIMA ETAPA

Integrar a Onda 1 (build/lint/typecheck/testes), depois lançar a Onda 2.

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

## ERROS CONHECIDOS

- Nenhum registrado até o momento.
