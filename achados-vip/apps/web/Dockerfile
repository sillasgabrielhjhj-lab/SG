# syntax=docker/dockerfile:1
# Painel web (Next.js 15, output standalone). O contexto de build é a RAIZ do monorepo (achados-vip/),
# porque o npm workspaces usa o package-lock.json da raiz:
#
#   docker build -f apps/web/Dockerfile -t achados-web \
#     --build-arg API_INTERNAL_URL=http://api:4000 .
#
# API_INTERNAL_URL é gravado no build (rewrite /api/* -> API). Em runtime só PORT/HOSTNAME são lidos.

# ---- 1) dependências (somente o workspace web) ----
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
# O lockfile referencia todos os workspaces; o manifesto da API é necessário apenas para validar o lock.
COPY apps/api/package.json apps/api/package.json
RUN npm ci -w apps/web --ignore-scripts --no-audit --no-fund

# ---- 2) build ----
FROM node:22-alpine AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json ./
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
# Checagem de tipos + build (o Next também valida os tipos).
RUN npm run typecheck && npm run build

# ---- 3) imagem final (mínima, usuário não-root) ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
# Com outputFileTracingRoot na raiz do monorepo, o servidor fica em apps/web/server.js.
COPY --from=builder --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
