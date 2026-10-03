# Arquitetura

## Visão geral

Mercatto é uma aplicação Next.js 16 (App Router) monolítica: um único
processo Node.js serve páginas React (Server Components), executa a lógica
de negócio (Server Actions) e expõe os poucos endpoints que realmente
precisam ser HTTP puro (Route Handlers). Não há um "backend separado" — a
camada de dados (`src/lib/data/*`) e de mutação (`src/lib/actions/*`) roda no
mesmo processo, com acesso direto ao PostgreSQL via Prisma e ao Redis via
`ioredis`.

```
Browser
  │  Server Components (RSC) renderizam HTML no servidor
  ▼
Next.js App Router (src/app/**)
  │
  ├─ src/lib/data/*      leituras (Prisma) — usadas pelos Server Components
  ├─ src/lib/actions/*   mutações ("use server") — formulários e botões
  ├─ src/app/api/*       os 2 casos que precisam ser HTTP cru:
  │                      autocomplete de busca e upload de imagem
  └─ src/proxy.ts        checagem leve de cookie de sessão (UX),
                         nunca a autorização de verdade
  │
  ▼
PostgreSQL (Prisma, driver adapter @prisma/adapter-pg)
Redis (rate limiting)
```

## Por que Server Actions em vez de uma API REST completa

Todo fluxo de mutação (login, carrinho, checkout, CRUD de produto, painel
admin) é um formulário ou botão ligado a uma Server Action — a UI nunca
monta `fetch()` manual para essas operações. Isso elimina uma classe inteira
de bugs (serialização de payload, versionamento de rota, CSRF manual) e
mantém a camada de autorização num único lugar por ação. Os únicos dois
Route Handlers (`src/app/api/search/suggestions`, `src/app/api/upload`)
existem porque são chamados por `fetch()` do cliente fora de um ciclo de
formulário (autocomplete conforme o usuário digita; upload de arquivo
binário). Veja [`docs/api.md`](./api.md) para a lista completa.

## Autenticação e sessão

- Senha com `bcryptjs` (custo 12), nunca armazenada ou logada em texto puro.
- Sessão por cookie `httpOnly`, `secure` (produção) e `sameSite=lax`,
  referenciando uma linha em `Session` (permite revogar sessões
  individualmente — ver `revokeSessionAction`).
- Verificação de e-mail e recuperação de senha por token de uso único
  (`EmailVerificationToken` / `PasswordResetToken`), com hash do token no
  banco (nunca o token em claro) e expiração.

## RBAC (controle de acesso por papel)

Três papéis: `USER`, `SELLER`, `ADMIN` (enum `Role` no schema). A checagem
de autorização **sempre** acontece no servidor, dentro de cada Server Action
e de cada página protegida, via `requireUser()` / `requireRole([...])`
(`src/lib/auth/guards.ts`) — nunca confiando em estado do cliente ou em rota.

`src/proxy.ts` faz só uma checagem de **presença** de cookie de sessão nas
rotas protegidas, como otimização de UX (evita renderizar a página para só
então redirecionar). Isso **não** é a autorização: um cookie presente mas
inválido, expirado, ou de um usuário sem o papel certo, ainda é rejeitado
pela checagem real do servidor dentro da página/action. Os testes E2E em
`e2e/permissions.spec.ts` cobrem exatamente essa separação (cookie presente
≠ acesso concedido).

## Pagamentos

`src/lib/payments/provider.ts` define a interface `PaymentProvider`
(`charge(input): Promise<ChargeResult>`), isolando o checkout de qualquer
gateway específico. `getPaymentProvider()` hoje retorna um
`MockPaymentProvider` — nenhuma cobrança real acontece, nenhum dado de
cartão é validado ou armazenado (os campos de cartão no formulário de
checkout nunca são persistidos). Para conectar um gateway real (Mercado
Pago, Stripe, etc.) quando houver credenciais:

1. Implemente uma classe que satisfaça `PaymentProvider`.
2. Troque o retorno de `getPaymentProvider()` para essa implementação
   (idealmente escolhida por variável de ambiente, ex.: `PAYMENT_PROVIDER`).
3. Nada em `src/lib/actions/checkout.ts` ou nos componentes de checkout
   precisa mudar — eles só conhecem a interface.

## Preço e permissão nunca vêm do cliente

Toda rota de mutação recalcula preço, frete, desconto de cupom e
disponibilidade de estoque a partir do banco — o valor total enviado pelo
formulário de checkout nunca é usado para cobrar. Da mesma forma, o papel do
usuário usado para autorizar uma ação é sempre lido da sessão no servidor,
nunca de um campo oculto ou de query string.

## Segurança

- **Cabeçalhos HTTP** (`next.config.ts`): `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  restritiva, e `Strict-Transport-Security` em produção.
  - A CSP usa a variante documentada pelo próprio Next.js **sem nonce**
    (`script-src 'self' 'unsafe-inline'`): o App Router injeta scripts
    inline com o payload de hidratação RSC em toda página, que exigem
    `'unsafe-inline'` ou um nonce por requisição para executar. A
    abordagem com nonce exigiria forçar renderização 100% dinâmica em toda
    a aplicação (perdendo otimização estática onde ela já existe, em
    `/entrar`, `/cadastro`, `/recuperar-senha`); o restante da política
    permanece restrito — `object-src 'none'`, `frame-ancestors 'none'`,
    `base-uri 'self'`, `form-action 'self'`, `connect-src 'self'` — que é
    onde CSP realmente bloqueia exfiltração e clickjacking.
- **Rate limiting** via Redis (janela fixa, `INCR`+`EXPIRE`,
  `src/lib/rate-limit.ts`) em: login, cadastro, recuperação de senha,
  aplicação de cupom, sugestões de busca, pergunta em produto, upload de
  arquivo.
- **Validação** de toda entrada de formulário/action com Zod
  (`src/lib/validation/*`) antes de qualquer acesso ao banco.
- **Sanitização**: nenhuma renderização de HTML de usuário sem escapar
  (React escapa por padrão; não há `dangerouslySetInnerHTML` com conteúdo
  de usuário no projeto).
- **Auditoria**: ações administrativas sensíveis (mudar papel de usuário,
  verificar vendedor, etc.) gravam em `AuditLog`.
- **Segredos**: nunca commitados — `.env` está no `.gitignore`; apenas
  `.env.example` (sem valores reais) e `.env.test` (segredos falsos, só
  para teste) são versionados.

## Renderização: por que não há `loading.tsx` global

Foi avaliado adicionar um `loading.tsx` na raiz para mostrar um skeleton
durante a navegação. Isso foi revertido: um `loading.tsx` em `src/app/`
envolve toda a árvore de páginas num limite de Suspense, e páginas que
chamam `notFound()` (produto inexistente, pedido de outro usuário) passam a
responder com HTTP 200 em vez de 404 — o cabeçalho de status já foi
enviado no início do streaming antes do `notFound()` ser avaliado. Os
testes E2E (`produto inexistente retorna 404`, `pedido de outro usuário não
é acessível`) pegaram essa regressão antes de ir para produção. Um
`loading.tsx` por rota, escopado apenas às páginas que nunca chamam
`notFound()`, é a forma correta de fazer isso — fica como próximo passo,
não crítico para o lançamento.
