# Achados VIP Automation

Painel e motor de automação para encontrar ofertas no Mercado Livre, pontuá-las com critérios transparentes, exigir **link de afiliado validado** e entregar a mensagem pronta ao grupo **ACHADOS VIP** — manualmente (fila) ou automaticamente nos canais em que a automação é permitida (Telegram, webhook autorizado e, com restrições, a Groups API do WhatsApp).

> ## Leia antes de usar: limitações reais
>
> Este projeto foi construído em um ambiente **sem acesso** à API do Mercado Livre, ao Telegram e à Meta. **Nenhuma chamada real a essas APIs foi executada durante o desenvolvimento.** O que está pronto e testado localmente (painel, banco, filas, pontuação, anti-spam, mensagens, segurança) é separado, em todo o texto, do que só pode ser confirmado **no seu servidor, com as suas credenciais** (veja [`docs/TESTES.md`](docs/TESTES.md)).
>
> 1. **Links de afiliado não são gerados por API.** Não há API pública oficial para isso. O fluxo é: o sistema lista os produtos sem link → você gera os links no **portal oficial** de afiliados do Mercado Livre → importa em lote. Sem link validado, **nada é publicado** (regra aplicada na camada de serviço, não só na tela).
> 2. **A busca do Mercado Livre pode exigir credenciais e pode ser bloqueada (HTTP 403).** O sistema usa OAuth com o app do seu DevCenter. Se a busca continuar bloqueada para o seu app, o painel mostra o status e a causa; a fonte `fixture` (dados de **teste**, marcados como tal) permite experimentar o fluxo.
> 3. **WhatsApp:** a Cloud API comum **não envia para grupos comuns** (como o seu grupo atual). A Groups API oficial só opera em grupos **criados por ela**, com **no máximo 8 participantes** e entrada só por link de convite. Por isso o modo padrão para o WhatsApp é a **Fila manual**: o sistema deixa texto + imagem prontos e você publica. Não usamos WhatsApp Web não oficial (viola os termos e arrisca banimento).
> 4. **"De/Por" e % de desconto só aparecem quando a referência é verificada** (maior preço observado no *histórico próprio* dentro da janela). O histórico precisa de alguns ciclos de coleta; até lá a mensagem mostra só o preço atual. Nunca inventamos preço, cupom, parcelamento, estoque, avaliações ou vendidos.
> 5. **Não há métricas de cliques, vendas ou comissões** (não existe fonte autorizada). O painel diz "indisponível" — nunca mostra números fictícios.
> 6. **"Enviada" só é registrado quando o canal confirma o recebimento.** Canais manuais geram "pronta para publicação manual", nunca "enviada" automática.
> 7. **Confirme os termos** do Programa de Afiliados do Mercado Livre e das plataformas (Telegram, Meta) para a sua forma de divulgação. A responsabilidade pelo uso é sua.

## Visão geral

```
                    ┌───────────────────────────── servidor (Docker Compose) ─────────────────────────────┐
 navegador ──HTTPS──▶  Caddy (80/443, TLS automático)                                                      │
                    │     ├── /api/*  /docs  /health ─▶ API (Fastify)  ─┬─▶ PostgreSQL 16 (dados)          │
                    │     └── demais rotas ───────────▶ Painel (Next.js) │                                 │
                    │                                   Worker (BullMQ) ─┴─▶ Redis 7 (filas)              │
                    │  backup diário do PostgreSQL (criptografia opcional)                                 │
                    └──────────────────────────────────────────────────────────────────────────────────────┘
                              worker/API ──saída──▶ Mercado Livre · Telegram · Meta · seu webhook
```

Fluxo de uma oferta: **busca** (fonte configurada) → **histórico de preços** → **pontuação** (0–100, pesos configuráveis; critério sem dado real vale 0 e fica registrado como "sem dado") → **aprovação** (automática acima da nota mínima, se você habilitar, ou manual) → **link de afiliado validado** → **janela anti-spam** (horário de silêncio, intervalo mínimo, limites por hora/dia/categoria, sem repetir) → **publicação** (idempotente, com confirmação) ou **fila manual**.

Segurança em resumo: login com senha forte (argon2), sessão em cookie `HttpOnly` + `SameSite=Strict` + `Secure`, proteção CSRF, rate limit com bloqueio progressivo, credenciais de integrações criptografadas (AES-256-GCM) e nunca devolvidas ao navegador, logs sem segredos, proteção SSRF na validação de links, trilha de auditoria.

## Estrutura de diretórios

```
achados-vip/
├── apps/
│   ├── api/                  API REST + worker (TypeScript ESM, Fastify, Prisma, BullMQ)
│   │   ├── prisma/           schema.prisma, migrations/, seed.ts (categorias iniciais desabilitadas + "Fila manual")
│   │   ├── src/              domain/ (regras puras), services/, adapters/ (fontes e canais), queues/, routes/, lib/
│   │   ├── tests/            unit/, integration/ (Postgres e Redis reais de teste), sim/ (servidores SIMULADOS)
│   │   └── Dockerfile
│   └── web/                  Painel (Next.js 15 App Router + Tailwind) — fala só com /api/* (mesma origem)
│       └── Dockerfile
├── infra/
│   ├── docker-compose.yml    postgres, redis, migrate, api, worker, web, caddy, backup
│   ├── Caddyfile             HTTPS automático, roteamento e cabeçalhos de segurança
│   ├── .env.example          TODAS as variáveis de produção, comentadas
│   ├── backup/Dockerfile     imagem do serviço de backup (pg_dump + openssl + age)
│   └── scripts/              deploy.sh  backup.sh  restore.sh  generate-secrets.sh  smoke.sh  ml-oauth.sh  healthcheck.cjs
├── docs/
│   ├── VIABILIDADE.md        o que é e o que não é possível em cada integração
│   ├── CONTRACT.md           contrato técnico entre módulos (para quem desenvolve)
│   ├── API.md                guia da API REST para usuários
│   ├── INTEGRACOES.md        manual: Mercado Livre, afiliados, WhatsApp, Telegram, webhook, credenciais
│   ├── DEPLOY.md             produção em VPS Ubuntu
│   └── TESTES.md             como testar; testes simulados × validação real
├── .env.example              variáveis de DESENVOLVIMENTO local
└── README.md
```

## Requisitos

| Para | Precisa de |
|---|---|
| Desenvolvimento local | Node.js 20+ (testado com 22), npm 10+, PostgreSQL 16, Redis 7 (o jeito mais simples: Docker para os dois) |
| Produção | VPS Linux (Ubuntu 22.04/24.04 LTS), mínimo 2 vCPU / 2 GB de RAM (4 GB recomendado) e 20 GB de disco, Docker Engine + Compose v2 (≥ 2.20), um **domínio** apontado para o servidor, portas 80 e 443 liberadas |
| Integrações (opcionais, conforme o uso) | App no DevCenter do Mercado Livre; conta no Programa de Afiliados do ML; bot do Telegram; conta WhatsApp Business Platform (só para a Groups API) — veja [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md) |

## Instalação local (desenvolvimento) — passo a passo

Todos os comandos a partir da pasta que contém `apps/`, `infra/` e `docs/`.

**1. Dependências**

```bash
npm install
npm -w apps/api exec -- prisma generate        # gera o client do Prisma (uma vez, e após mudar o schema)
```

**2. PostgreSQL e Redis** (exemplo com Docker, expostos apenas em `127.0.0.1`)

```bash
docker run -d --name achados-pg -e POSTGRES_USER=achados -e POSTGRES_PASSWORD=achados -e POSTGRES_DB=achados \
  -p 127.0.0.1:5432:5432 postgres:16-alpine
docker run -d --name achados-redis -p 127.0.0.1:6379:6379 \
  redis:7-alpine redis-server --appendonly yes --maxmemory-policy noeviction
```

**3. Variáveis de ambiente**

```bash
cp .env.example apps/api/.env                     # a API, o worker e o Prisma leem o .env de apps/api
echo 'API_INTERNAL_URL=http://localhost:3001' > apps/web/.env.local   # destino do proxy /api/* do painel
```

Em desenvolvimento, `APP_ENCRYPTION_KEY` e `SESSION_SECRET` podem ficar vazios (a API usa valores fixos **inseguros** e avisa no log). Detalhes em [`.env.example`](.env.example).

**4. Banco de dados**

```bash
npm -w apps/api run db:migrate                    # aplica as migrations (prisma migrate deploy)
npm -w apps/api run db:seed                       # categorias iniciais (TODAS desabilitadas) + canal "Fila manual"
```

**5. Administrador**

```bash
ADMIN_EMAIL='voce@exemplo.com' ADMIN_PASSWORD='uma-senha-longa-com-12-ou-mais' npm -w apps/api run admin:create
```

**6. Subir (três terminais)**

```bash
npm run dev:api       # API em http://127.0.0.1:3001   (Swagger em /docs)
npm run dev:worker    # worker das filas (descoberta, publicação, manutenção)
npm run dev:web       # painel em http://localhost:3000
```

Abra **http://localhost:3000** (use sempre `localhost`, não `127.0.0.1`: a API recusa mutações cuja origem difere de `WEB_ORIGIN`) e entre com o administrador criado.

**7. Testes** — `npm test` (veja [`docs/TESTES.md`](docs/TESTES.md)) e `npm run typecheck`.

## Primeiros passos no painel

1. **Entre** e, em **Configurações → Segurança**, confirme que a senha é forte (você pode trocá-la ali).
2. **Integrações → Fonte de ofertas.** Cadastre as credenciais do app do Mercado Livre (ou `ML_*` no ambiente) e clique em **Testar fonte**. O selo só vira "Conectado" depois de um teste real bem-sucedido. Sem credenciais aparece "Autenticação necessária" — é o comportamento correto. Para só conhecer o fluxo, escolha a fonte **fixture** (dados de **teste**) em **Automação**.
3. **Automação → Categorias monitoradas.** Todas começam **desativadas**. Ative as que quer monitorar e ajuste limite diário e pontuação mínima.
4. **Automação → Monitoramento de ofertas:** ligue e use **Executar busca agora** para a primeira coleta. Ofertas aparecem em **Ofertas** com nota, faixa e detalhamento da pontuação.
5. **Afiliados.** Em **Produtos aguardando link de afiliado**, use **Exportar CSV**, gere os links no portal oficial do ML e use **Importar links em lote** (`URL_ML ; URL_AFILIADO`, uma linha por produto). Cada link é validado (host permitido, HTTPS, destino = mesmo produto) antes de liberar a publicação. Passo a passo em [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md).
6. **Publicar.** Em **Ofertas**, aprove e publique. No canal **Fila manual** (já criado pelo seed), a publicação vira *pronta para publicação manual*: em **Publicações → Fila manual** copie o texto, publique no grupo e clique em **marcar como publicada**.
7. **Canais automáticos (opcional).** Em **Integrações**, crie o canal (Telegram / Webhook / WhatsApp Groups API), selecione a credencial, **Testar conexão** e só então ative. A **Publicação automática** (Automação) é desligada por padrão — comece com limites baixos e horário de silêncio ligado.

## Como operar

- **Rotina diária (5 minutos):** Dashboard (status da busca, falhas, alertas), **Afiliados** (pendentes → gerar/importar links), **Publicações → Fila manual** (publicar e marcar), sino de **notificações** (job travado, integração que precisa de autenticação, falhas definitivas).
- **Quando a busca para:** veja o selo da fonte em **Integrações** e **Configurações → Logs**. `Autenticação necessária` = credencial ausente/expirada (refaça o token — [`INTEGRACOES.md`](docs/INTEGRACOES.md)); `Erro` com 403/429 = bloqueio do ML ou limite de taxa (o sistema respeita `Retry-After`).
- **Limites anti-spam** (intervalo mínimo, por hora/dia/categoria, horário de silêncio, não republicar antes de N dias salvo queda adicional) ficam em **Automação** e valem para todos os canais automáticos.
- **Auditoria:** toda alteração de configuração fica em **Configurações → Auditoria** (antes/depois, usuário, IP).
- **Produção:** `./infra/scripts/deploy.sh` (deploy/atualização), `deploy.sh status`, `deploy.sh logs api`, `./infra/scripts/smoke.sh` (verificação), `./infra/scripts/backup.sh` (backup agora), `./infra/scripts/restore.sh` (listar/verificar/restaurar). Veja [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev:api` / `dev:worker` / `dev:web` | desenvolvimento (recarrega ao salvar) |
| `npm test` | testes da API (vitest: unitários, integração e simulados) |
| `npm run typecheck` | `tsc --noEmit` na API e no painel |
| `npm run build` | compila API (`prisma generate` + `tsc`) e painel (`next build`) |
| `npm run smoke -- https://seu.dominio` | verificação pós-deploy (cabeçalhos, autenticação, saúde) |
| `npm -w apps/api run db:migrate:dev -- --name x` | cria nova migration (nunca edite a `init`) |
| `npm -w apps/api run admin:create` | cria/redefine o administrador |

## Documentação

[`docs/VIABILIDADE.md`](docs/VIABILIDADE.md) · [`docs/API.md`](docs/API.md) (e Swagger em `/docs`) · [`docs/INTEGRACOES.md`](docs/INTEGRACOES.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md) · [`docs/TESTES.md`](docs/TESTES.md) · [`docs/CONTRACT.md`](docs/CONTRACT.md)
