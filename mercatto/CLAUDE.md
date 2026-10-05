# Mercatto

Marketplace full-stack (Next.js 16 + Prisma 7 + PostgreSQL). Antes de qualquer alteração leia:

1. `PROJECT_STATUS.md` — o que está pronto, pendente e próximos passos.
2. `docs/ENGINEERING.md` — arquitetura, convenções obrigatórias e contratos entre módulos.

Comandos: `npm run dev`, `npm run build`, `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`,
`npm run test:integration`, `npm run test:e2e`, `npm run db:migrate`, `npm run db:seed`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
