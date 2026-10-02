# Mercatto

Mercatto é um marketplace multi-vendedor completo: catálogo e busca, carrinho e
checkout, pedidos, área do vendedor e painel administrativo com controle de
acesso por papel (USER / SELLER / ADMIN).

Stack: **Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind v4 ·
shadcn/ui (componentes próprios sobre Radix UI)** no front-end, e **Next.js
Server Actions/Route Handlers · PostgreSQL (via Prisma) · Redis** no back-end.

> Em desenvolvimento os pagamentos são **mock** — nenhum cartão real é
> processado. Veja [`docs/architecture.md`](docs/architecture.md#pagamentos)
> para como conectar um gateway real quando for a hora.

## Começando

Pré-requisitos: Node.js 22+, PostgreSQL 16+, Redis 7+.

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL, REDIS_URL e os segredos
npm run db:migrate          # aplica o schema no banco
npm run db:seed             # popula com dados de demonstração (opcional)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas de demonstração (após `npm run db:seed`)

Todas usam a senha `Senha123!`.

| Papel     | E-mail                                      |
| --------- | -------------------------------------------- |
| Admin     | `admin@mercatto.dev`                         |
| Comprador | `cliente@mercatto.dev` (e `cliente1..7@...`) |
| Vendedor  | `vendedor0@mercatto.dev` (até `vendedor19`)  |

## Scripts

| Comando             | O que faz                                            |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Servidor de desenvolvimento (Turbopack)               |
| `npm run build`      | Build de produção                                     |
| `npm run start`      | Roda o build de produção                             |
| `npm run lint`       | ESLint                                                |
| `npm run test`       | Testes unitários/integração (Vitest, contra `mercatto_test`) |
| `npm run test:e2e`   | Testes end-to-end (Playwright)                        |
| `npm run db:migrate` | Aplica migrations do Prisma                           |
| `npm run db:seed`    | Popula o banco com dados de demonstração              |
| `npm run db:studio`  | Abre o Prisma Studio                                  |

## Documentação

- [`docs/architecture.md`](docs/architecture.md) — camadas da aplicação, RBAC, pagamentos, segurança
- [`docs/database.md`](docs/database.md) — modelo de dados (Prisma)
- [`docs/api.md`](docs/api.md) — Server Actions e Route Handlers
- [`docs/deployment.md`](docs/deployment.md) — variáveis de ambiente e deploy em produção

## Testes

```bash
npm run test       # 59 testes unitários/integração
npm run test:e2e   # 44 testes end-to-end (fluxos reais de ponta a ponta)
```

Os testes rodam contra um banco **separado** (`mercatto_test`) — nunca contra
o banco de desenvolvimento ou produção. Veja `.env.test` e `src/test/setup.ts`.
