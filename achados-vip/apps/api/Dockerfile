# syntax=docker/dockerfile:1.7
# Achados VIP — imagem da API e do worker (mesma imagem; muda só o comando).
# Contexto de build: RAIZ do monorepo (achados-vip/). Exemplo:
#   docker build -f apps/api/Dockerfile -t achados-vip/api .
#
# Alvos:
#   runtime (padrão) — somente dependências de produção + código compilado; roda como usuário não-root.
#   tools            — inclui Prisma CLI e tsx; usado pelo serviço "migrate" (migrations + seed idempotente).

ARG NODE_VERSION=22

# ---------------------------------------------------------------- base
FROM node:${NODE_VERSION}-bookworm-slim AS base
# openssl: exigido pelo engine do Prisma; ca-certificates: chamadas HTTPS (Mercado Livre, Telegram, Meta)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false

# ---------------------------------------------------------------- deps (completas, p/ build)
FROM base AS deps
# O lockfile é do monorepo: precisa dos package.json de todos os workspaces para o "npm ci" validar.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci -w apps/api

# ---------------------------------------------------------------- build
FROM deps AS build
# "prisma generate" não conecta ao banco, mas o schema referencia env("DATABASE_URL"): valor fictício só no build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY apps/api apps/api
WORKDIR /app/apps/api
# = prisma generate && tsc -p tsconfig.build.json  → dist/server.js, dist/worker.js, dist/scripts/create-admin.js
RUN npm run build \
 && test -d /app/node_modules/.prisma/client \
 && for f in dist/server.js dist/worker.js dist/scripts/create-admin.js; do \
      test -f "$f" || { echo "ERRO: $f não foi gerado pelo build (src correspondente ausente?)" >&2; exit 1; }; \
    done

# ---------------------------------------------------------------- tools (migrate + seed)
FROM build AS tools
ENV NODE_ENV=production \
    PATH=/app/node_modules/.bin:$PATH \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
USER node
# Aplica migrations (somente "deploy": nunca "dev"/"reset") e roda o seed idempotente (não sobrescreve edições do painel).
CMD ["sh", "-c", "prisma migrate deploy && tsx prisma/seed.ts"]

# ---------------------------------------------------------------- dependências de produção
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# --ignore-scripts: o client do Prisma já vem gerado do estágio "build" (evita baixar engines de novo)
RUN --mount=type=cache,target=/root/.npm npm ci -w apps/api --omit=dev --ignore-scripts

# ---------------------------------------------------------------- runtime
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app/apps/api
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
COPY infra/scripts/healthcheck.cjs /app/healthcheck.cjs
USER node
EXPOSE 3001
# Liveness do processo HTTP. O worker (sem HTTP) sobrescreve este healthcheck no docker-compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "/app/healthcheck.cjs", "http"]
CMD ["node", "dist/server.js"]
