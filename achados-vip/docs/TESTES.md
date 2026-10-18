# Testes e validação

Este documento separa com clareza **o que foi testado de forma simulada/local** do que **só pode ser confirmado em produção, com as suas credenciais** ("validação real"). Um teste verde aqui **não** prova que o Mercado Livre, o Telegram ou a Meta aceitarão o seu uso.

## 1. As três camadas

| Camada | Onde | Usa | Prova | **Não** prova |
|---|---|---|---|---|
| **Unitários** | `apps/api/tests/unit/` | Código puro (preço, pontuação, anti-spam, deduplicação, formatação de mensagens, cripto, SSRF, env...) | Que as regras de negócio se comportam como especificado | Nada sobre serviços externos |
| **Integração** | `apps/api/tests/integration/` | **PostgreSQL e Redis reais de teste**, API em processo (`fastify.inject`) | Autenticação, CSRF, rate limit, banco, filas, serviços de ponta a ponta **dentro do sistema** | Que as APIs externas respondem como imaginamos |
| **Simulados** | `apps/api/tests/sim/` | **Servidores HTTP locais que imitam** Mercado Livre, Telegram, Meta e webhook | Que os adaptadores tratam bem sucesso, 401, 403, 429, timeouts, respostas malformadas e que nada é marcado "enviado" sem confirmação | Que as APIs **reais** têm esse formato/comportamento hoje |
| **Validação real** | No **seu servidor** | Suas credenciais, redes e contas | O funcionamento verdadeiro de cada integração | — (é o que falta para "pronto para uso") |

Os testes simulados usam respostas **escritas por nós a partir da documentação**; as fixtures vivem somente em `tests/` e na fonte `fixture` (que o painel marca como "dados de TESTE"). Nunca há dados fictícios na UI/API de produção.

## 2. Como rodar

### 2.1 Pré-requisitos

PostgreSQL 16 e Redis 7 acessíveis, com **bancos dedicados a teste** (os testes de integração **apagam dados**; nunca aponte para o banco de desenvolvimento ou de produção).

```bash
# banco de teste (uma vez)
docker exec -i achados-pg psql -U achados -d postgres -c 'CREATE DATABASE achados_test'      # ou psql direto
DATABASE_URL=postgresql://achados:achados@localhost:5432/achados_test npm -w apps/api run db:migrate

# variáveis (já são os padrões do vitest.config.ts; defina só se os seus forem diferentes)
export TEST_DATABASE_URL=postgresql://achados:achados@localhost:5432/achados_test
export TEST_REDIS_URL=redis://localhost:6379/15
```

### 2.2 Comandos

```bash
npm test                                                  # tudo (npm -w apps/api test = vitest run)
npm -w apps/api exec -- vitest run tests/unit             # só unitários (não precisam de banco)
npm -w apps/api exec -- vitest run tests/integration      # só integração (Postgres/Redis)
npm -w apps/api exec -- vitest run tests/sim              # só simulados (servidores locais)
npm -w apps/api exec -- vitest run tests/unit/pricing.test.ts   # um arquivo
npm run typecheck                                         # tsc --noEmit na API e no painel
npm run build                                             # prisma generate + tsc (API) e next build (painel)
```

Os arquivos de teste rodam em série (`fileParallelism: false`) porque compartilham o mesmo Postgres/Redis de teste.

### 2.3 Verificações da infraestrutura (sem precisar subir nada)

```bash
for f in infra/scripts/*.sh; do bash -n "$f" && echo "ok $f"; done     # sintaxe dos scripts
./infra/scripts/generate-secrets.sh --write                            # cria infra/.env com segredos (edite DOMAIN e ACME_EMAIL)
./infra/scripts/deploy.sh check                                        # valida o .env e roda "docker compose config -q"
```

`docker compose config` funciona **sem** o daemon do Docker rodando, mas imprime os segredos: não cole a saída em lugar público.

Pós-deploy: `./infra/scripts/smoke.sh` (ver [`DEPLOY.md`](DEPLOY.md)). Restauração de backup: `./infra/scripts/restore.sh --verify latest`.

## 3. Checklist de validação real em produção

Faça **depois** do deploy, nesta ordem. Registre a evidência (captura de tela, trecho de log) e marque. Enquanto um item estiver em branco, trate a integração como **não validada**.

### 3.1 Infraestrutura e segurança

- [ ] `./infra/scripts/smoke.sh` sem FAIL; com `SMOKE_EMAIL/SMOKE_PASSWORD` também (login, cookies, CSRF, logout)
- [ ] Certificado Let's Encrypt válido no navegador; `http://` redireciona para `https://`
- [ ] `nmap -Pn IP_DO_SERVIDOR` (de fora): só 22, 80 e 443
- [ ] `/docs` sem login responde 401; com login abre o Swagger
- [ ] Primeiro backup criado, **cifrado** (`.enc`/`.age`), copiado para fora do servidor
- [ ] `./infra/scripts/restore.sh --verify latest` com sucesso
- [ ] Reiniciar o servidor (`sudo reboot`): todos os serviços voltam `healthy` sozinhos; nenhuma publicação duplicada (idempotência)
- [ ] Monitor externo em `/health` alertando (teste parando o `caddy` por um minuto)

### 3.2 Mercado Livre (fonte de ofertas)

- [ ] **Integrações → Testar fonte** = *Conectado* (não *Autenticação necessária* nem *Erro*). Guarde o detalhe exibido
- [ ] **Executar busca agora** com 1–2 categorias ativas: surgem ofertas reais em **Ofertas** (título, preço e link para o anúncio conferem com o site do ML)
- [ ] O preço no painel = preço atual no anúncio (confira 3 produtos)
- [ ] Sem referência verificada, a oferta **não** mostra "De/Por" nem % de desconto (esperado nos primeiros ciclos)
- [ ] Após vários ciclos de coleta, ofertas com histórico passam a mostrar "De/Por" **verificado**, coerente com o histórico próprio
- [ ] Depois de >6 horas rodando: a fonte continua *Conectado* (renovação do token funcionou; veja o aviso sobre refresh token de uso único em [`INTEGRACOES.md`](INTEGRACOES.md))
- [ ] Provocar 403/401 de propósito (credencial inválida): o painel mostra o status e a causa, e notifica; nada quebra
- [ ] Nenhum cupom, parcelamento, "vendidos" ou estoque aparece sem vir da API

### 3.3 Afiliados

- [ ] **Exportar CSV** dos pendentes abre e traz `id;titulo;url_ml;score`
- [ ] Gerar 3 links no portal oficial e **importar**: 3 *validados*; conferir o destino de cada link
- [ ] Linha com link de outro host / outro produto → aparece em *inválidas* com motivo
- [ ] Tentar publicar oferta **sem** link validado → bloqueio 409 `NO_VALIDATED_LINK` (na tela e na API)
- [ ] Confirmar com o programa que o formato de divulgação está de acordo com os termos

### 3.4 Fila manual (WhatsApp, Modo B)

- [ ] Publicar uma oferta com link validado → aparece em **Publicações → Fila manual** como *pronta para publicação manual* (e **não** como "enviada")
- [ ] **Copiar** → colar no WhatsApp: negrito/riscado/itálico renderizam; imagem anexa; link de afiliado presente; rodapé de divulgação presente
- [ ] **Marcar como publicada** muda o status e registra auditoria

### 3.5 Telegram

- [ ] **Testar conexão** = *Conectado* (bot válido, é administrador do canal)
- [ ] Publicação de teste chega ao canal com formatação correta (negrito/riscado, legenda ≤ 1024 caracteres) e o status vira *Enviada* **somente** após a confirmação
- [ ] Remover o bot do canal de propósito → próxima publicação falha de forma **permanente**, notifica e **não** marca como enviada
- [ ] Rajada de 3+ publicações: respeita intervalo mínimo, limites por hora/dia e horário de silêncio

### 3.6 Webhook

- [ ] Receptor próprio (ou n8n/Make) valida a assinatura HMAC do corpo bruto; rejeita corpo adulterado
- [ ] Reentrega do mesmo evento é ignorada via `idempotencyKey`
- [ ] Receptor respondendo erro → publicação fica *Falha* com nova tentativa (backoff) e, esgotadas, *Morta* (dead-letter) com notificação

### 3.7 WhatsApp Groups API (somente se for usar)

- [ ] Grupo criado **pela API** (≤ 8 participantes, entrada por convite); `phoneNumberId` e `groupId` corretos
- [ ] **Testar conexão** = *Conectado*; mensagem de teste chega ao grupo
- [ ] Confirmação de que o conteúdo/consentimento atendem às políticas da Meta
- [ ] Entender e aceitar que **não** atinge o grupo atual "ACHADOS VIP"

### 3.8 Honestidade do produto (auditoria final)

- [ ] Em nenhuma tela/endpoint aparecem números de cliques/vendas/comissões (apenas "indisponível")
- [ ] Nenhum preço/desconto/cupom exibido sem origem real; oferta da fonte `fixture` marcada como teste e **não** publicada em canal real
- [ ] **Configurações → Logs/Auditoria** sem tokens, senhas ou segredos em texto claro

## 4. Resultados (a preencher)

> Preencher **depois** de rodar os comandos acima no ambiente final. Não preencher com valores presumidos.

### 4.1 Testes automatizados

| Suíte | Comando | Passando / Total | Data | Observações |
|---|---|---|---|---|
| Unitários | `npm -w apps/api exec -- vitest run tests/unit` | a preencher pelo agente final | a preencher | |
| Integração (Postgres/Redis reais de teste) | `npm -w apps/api exec -- vitest run tests/integration` | a preencher pelo agente final | a preencher | |
| Simulados (servidores locais) | `npm -w apps/api exec -- vitest run tests/sim` | a preencher pelo agente final | a preencher | |
| Total | `npm test` | a preencher pelo agente final | a preencher | |
| Typecheck API | `npx tsc --noEmit` (em `apps/api`) | a preencher pelo agente final | a preencher | |
| Typecheck painel | `npm -w apps/web run typecheck` | a preencher pelo agente final | a preencher | |
| Build | `npm run build` | a preencher pelo agente final | a preencher | |

### 4.2 Validação real (produção)

| Item | Status (Aprovado / Reprovado / Não testado) | Evidência | Data | Responsável |
|---|---|---|---|---|
| Infra e segurança (3.1) | a preencher pelo agente final | | | |
| Mercado Livre — fonte (3.2) | a preencher pelo agente final | | | |
| Afiliados — importação e validação (3.3) | a preencher pelo agente final | | | |
| Fila manual (3.4) | a preencher pelo agente final | | | |
| Telegram (3.5) | a preencher pelo agente final | | | |
| Webhook (3.6) | a preencher pelo agente final | | | |
| WhatsApp Groups API (3.7) | a preencher pelo agente final | | | |
| Honestidade do produto (3.8) | a preencher pelo agente final | | | |

## 5. Verificações já executadas na infraestrutura (módulo "infra e documentação")

Registro honesto do que **foi** rodado nesta fase (ambiente de desenvolvimento, sem internet para MELI/Telegram/Meta e **sem Docker daemon**). Tudo abaixo é **local/simulado**; nada disso substitui a validação real.

| Verificação | Como | Resultado |
|---|---|---|
| Sintaxe dos scripts | `bash -n` em todos; `dash -n` nos scripts POSIX (`backup.sh`, `restore.sh`) | OK |
| `docker-compose.yml` | `docker compose config` (CLI Compose, sem daemon) com `.env` gerado por `generate-secrets.sh`; variáveis obrigatórias ausentes geram erro claro | OK |
| Variáveis do compose × API | Ambiente renderizado do `api`/`worker`/`migrate` passado ao `loadEnv` da API em `NODE_ENV=production` | OK, sem avisos (URL do Redis com senha hex é aceita) |
| `generate-secrets.sh` | Modos imprimir / `--write` / `--fill` / `--force` / `--only`; chave `APP_ENCRYPTION_KEY` = 32 bytes válidos; senhas URL-safe | OK |
| `deploy.sh check` | `.env` ausente, domínio/e-mail de exemplo, senha com caractere inválido, chave inválida, `.env` válido | Mensagens corretas; **`up`, `admin`, `rollback`, `status` com daemon NÃO executados** |
| `backup.sh` | PostgreSQL 16 local: sem criptografia, `openssl` (senha com `/+=`), `age`; falha de conexão (sem `.last_success`), retenção, validação de parâmetros, modo `--loop` + SIGTERM | OK |
| `restore.sh` (parte interna) | `--verify` (ok, senha errada, sem senha, `.age`, SHA adulterado), restauração real com backup de segurança, dump corrompido preserva o banco, restauração de arquivo em `/tmp` | OK. **O envoltório de host (`docker compose exec/stop/up`) NÃO foi executado** |
| `smoke.sh` | Contra a API compilada (`dist/`) em produção, atrás do **Caddy 2.8.4 real** (HTTP e HTTPS com CA interna): 16 PASS; o único FAIL era `/api/dashboard` com sessão = 404 porque essa rota ainda não existia no módulo da API naquele momento | Funciona; **conferir que fica 100% PASS com a API completa** |
| `Caddyfile` | `caddy validate` + execução real (v2.8.4): roteamento `/api,/docs,/health`→API e resto→painel (simulado), cabeçalhos sobrepõem os do upstream sem duplicar, `/ready` não exposto, limite de corpo 2 MB (413), log sem cookie/CSRF/Authorization, redirecionamento 80→443 (308), bloqueio por IP do DEPLOY | OK (o binário foi baixado de GitHub com checksum conferido; a imagem `caddy:2-alpine` do servidor pode ser mais nova) |
| `ml-oauth.sh` | Contra servidor **simulado** de OAuth: fluxo feliz, `--pkce`, `--out`, `state` divergente, `invalid_grant` | OK (simulado; ML real não testado) |
| `healthcheck.cjs` | Redis real local, Redis simulado com `AUTH` (senha certa/errada/ausente), HTTP 200/503/sem conexão | OK |
| API compilada | `tsc -p tsconfig.build.json` em cópia temporária; `node dist/server.js` em produção respondeu `/health` e `/ready`; `dist/scripts/create-admin.js` roda | OK. `dist/worker.js` **não existia** naquele momento (módulo do worker pendente) |
| Instalação das dependências | `npm ci -w apps/api --omit=dev --ignore-scripts` e `npm ci -w apps/web --dry-run` em pasta temporária com o lockfile | OK |
| Typecheck e unitários da API | `npx tsc --noEmit` (apps/api) e `vitest run tests/unit` | OK no momento da escrita (conferir os totais finais na tabela 4.1) |

### O que NÃO foi possível testar (precisa do seu servidor)

- `docker build` das imagens (`apps/api` alvos `runtime` e `tools`, `apps/web`, `infra/backup`) e `docker compose up` completo.
- Healthchecks dentro dos contêineres (inclusive o `wget` na API admin do Caddy e o `redis-cli` com `REDISCLI_AUTH`), `user: redis`, `read_only` + `tmpfs`, `cap_drop: ALL` (reduzem a superfície de ataque; se algum serviço não subir por causa deles, os logs dirão qual permissão falta).
- O build da imagem do painel (`apps/web/Dockerfile`, mantido pelo módulo web: base Alpine, usuário `app`, `typecheck` + `next build`, saída `standalone`) e o healthcheck da própria imagem (`GET /login`).
- Emissão real do certificado Let's Encrypt, `ufw`, DNS.
- O envoltório de host de `backup.sh`/`restore.sh` (`docker compose exec/stop/up`) e o serviço `backup` rodando em loop dentro do contêiner Alpine (testado só com `dash` local; busybox `ash` é compatível por construção).
- **Todas** as integrações externas reais (seção 3).

## 6. Pontos a conferir ao fechar o projeto

Itens que dependem de módulos escritos em paralelo; confira antes de dar o projeto por concluído:

1. `apps/api/src/worker.ts` existe e gera `dist/worker.js` (o `Dockerfile` da API **falha o build** sem ele); o worker trata `SIGTERM`. O compose roda `node dist/worker.js` (equivalente a `npm run start:worker`, sem o wrapper do npm).
2. As rotas do contrato existem (ex.: `/api/dashboard`), para o `smoke.sh` ficar 100% PASS.
3. `apps/web/next.config.mjs`: o destino padrão do proxy é `http://localhost:4000`, mas a API escuta na **3001**. Em desenvolvimento é preciso `apps/web/.env.local` com `API_INTERNAL_URL=http://localhost:3001` (documentado no README). Em produção, o build recebe `API_INTERNAL_URL=http://api:3001` por *build-arg*.
4. Mercado Livre: o refresh token é de uso único; confirmar no adaptador como o token renovado é persistido (o formulário de credencial do painel só tem App ID e Chave secreta; `ML_REFRESH_TOKEN` vem do ambiente).
5. Webhook: confirmar no adaptador o nome do cabeçalho da assinatura e o formato (hex, prefixo) — [`INTEGRACOES.md`](INTEGRACOES.md) usa `X-Achados-Signature` como nome **provisório**. Conferir também a versão da Graph API e o corpo usados pelo adaptador do WhatsApp.
6. O serviço `migrate` executa o **seed idempotente** a cada deploy (cria categorias desabilitadas e a "Fila manual" só se não existirem; não sobrescreve edições do painel).
7. Alterações fora da pasta `infra/` e dos documentos: `package.json` (script `smoke`) e `.gitignore` (`.env.*`, `infra/backups/`).
