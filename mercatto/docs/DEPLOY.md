# Deploy na Vercel — passo a passo

Este guia publica o Mercatto na Vercel com PostgreSQL gerenciado, Vercel Blob para imagens e, opcionalmente, Mercado Pago e Resend. Tempo estimado: 20–30 minutos.

> O repositório contém outros arquivos na raiz (site pessoal). O app fica na pasta **`mercatto/`** — por isso o **Root Directory** precisa ser configurado.

## Prévia rápida (link para avaliar antes de publicar)

Para só navegar pelo site com os dados DEMO, sem instalar nada no computador:

1. Vercel → **Add New… → Project** → importe o repositório → **Root Directory: `mercatto`**.
2. **Storage → Create Database → Neon (Postgres)** e conecte ao projeto. Em *Settings → Environment Variables*, crie `DIRECT_URL` com o mesmo valor de `DATABASE_URL_UNPOOLED` (criada pela integração).
3. Adicione as variáveis: `AUTH_SECRET` (texto aleatório com 32+ caracteres), `PAYMENT_PROVIDER=dev`, `PAYMENT_WEBHOOK_SECRET` (16+ caracteres), `CRON_SECRET` (16+ caracteres) e **`SEED_ON_BUILD=demo`** (o próprio build cria as tabelas e os dados DEMO; é idempotente).
4. **Deployments → Create Deployment** → Git reference: o branch do app (ex.: `claude/cool-hamilton-kcm4xc`). Ao terminar, a Vercel mostra o link da prévia.
5. Entre com `admin@mercatto.dev` / `Mercatto@2026`.

Upload de imagens exige o Vercel Blob (passo 4 abaixo); a navegação, o carrinho e o checkout simulado funcionam sem ele. Para a operação real, **remova `SEED_ON_BUILD`** e siga o guia completo.

## 1. Pré-requisitos

- Conta na Vercel com acesso ao repositório no GitHub.
- Node.js ≥ 20.19 na sua máquina (para rodar o seed uma vez).
- Decidir o modo inicial:
  - **Demonstração** — `PAYMENT_PROVIDER=dev` + `SEED_MODE=demo`: vitrine completa, pagamentos simulados e identificados como tal, dados marcados DEMO.
  - **Operação real** — `PAYMENT_PROVIDER=mercadopago` + `SEED_MODE=minimal`: catálogo vazio, você cadastra produtos reais.

## 2. Criar o projeto

1. Vercel → **Add New… → Project** → importe o repositório.
2. **Root Directory**: `mercatto` (clique em *Edit* e selecione a pasta).
3. Framework Preset: **Next.js** (detectado). Build Command: já definido em `vercel.json` (`npm run vercel-build`). Node.js 20.x ou 22.x.
4. **Ainda não clique em Deploy** — configure o banco e as variáveis antes (passos 3–5). Se clicar, o primeiro build falhará por falta de `DATABASE_URL`; basta reimplantar depois.

## 3. Banco de dados (PostgreSQL)

Opção recomendada: **Neon** pela Vercel Marketplace (*Storage → Create Database → Neon*), conectado ao projeto. Ele cria as variáveis automaticamente; garanta que existam:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL **com pooling** (host com `-pooler`, `?sslmode=require`) |
| `DIRECT_URL` | URL **direta** (sem `-pooler`) — usada pelas migrations |

Alternativas: Supabase (`DATABASE_URL` = *transaction pooler*, porta 6543; `DIRECT_URL` = conexão direta/*session*, porta 5432) ou Prisma Postgres. As extensões `pg_trgm` e `unaccent` são criadas pela migration (suportadas por Neon e Supabase).

## 4. Imagens (Vercel Blob)

*Storage → Create → Blob* → conecte ao projeto (cria `BLOB_READ_WRITE_TOKEN`). Defina `STORAGE_PROVIDER=vercel-blob`.

## 5. Variáveis de ambiente

*Settings → Environment Variables* (Production e Preview):

| Variável | Exemplo / como obter |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://seu-dominio.com.br` (opcional até ter domínio — a Vercel fornece o domínio do projeto automaticamente) |
| `PAYMENT_PROVIDER` | `dev` (demonstração) ou `mercadopago` |
| `PAYMENT_WEBHOOK_SECRET` | `openssl rand -base64 32` (necessário com `dev`) |
| `STORAGE_PROVIDER` | `vercel-blob` |
| `EMAIL_PROVIDER` | `console` (sem envio) ou `resend` |
| `SHIPPING_PROVIDER` | `table` |
| `LOG_LEVEL` | `info` |

Com Mercado Pago (opcional): `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (mesmo valor da pública), `MERCADOPAGO_WEBHOOK_SECRET`. Com Resend: `RESEND_API_KEY`, `EMAIL_FROM` (domínio verificado no Resend).

## 6. Deploy

Clique em **Deploy** (ou *Redeploy*). O build executa:

```
prisma generate && prisma migrate deploy && next build
```

As migrations são aplicadas automaticamente a cada deploy (operação não destrutiva).

## 7. Popular o banco (uma vez)

Na sua máquina, dentro de `mercatto/`, com as URLs do banco de produção:

```bash
npm install
# Demonstração:
DATABASE_URL="<pooling>" DIRECT_URL="<direta>" AUTH_SECRET="<qualquer 32+>" SEED_MODE=demo npm run db:seed
# Operação real (cria só o administrador e a estrutura):
DATABASE_URL="<pooling>" DIRECT_URL="<direta>" AUTH_SECRET="<qualquer 32+>" \
  SEED_MODE=minimal ADMIN_EMAIL="voce@empresa.com.br" ADMIN_PASSWORD="<senha forte>" npm run db:seed
```

O seed é idempotente (pode ser executado novamente sem duplicar dados).

## 8. Pós-deploy

1. Acesse `/entrar` com o administrador e abra `/admin`.
2. Em `/admin/configuracoes`, ajuste nome, contatos, parcelamento, desconto PIX e frete grátis.
3. Cadastre categorias/marcas (se usou `minimal`) e os produtos oficiais em `/admin/produtos`.
4. **Cron**: `vercel.json` agenda `/api/cron/maintenance` diariamente às 06:00 UTC (compatível com o plano Hobby). Ele expira reservas de checkout, sincroniza promoções e limpa sessões. No plano Pro, aumente a frequência (ex.: `*/15 * * * *`) para liberar estoque reservado mais rápido — reservas também são liberadas sob demanda.
5. **Webhook do Mercado Pago** (se usado): painel do Mercado Pago → *Webhooks* → URL `https://SEU-DOMINIO/api/webhooks/payments/mercadopago`, eventos de pagamento; copie a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`. Inclua `https://*.mercadopago.com` e `https://*.mlstatic.com` nas diretivas `script-src`, `connect-src` e `frame-src` da CSP em `next.config.ts` antes de ativar o Brick de cartão.
6. **Domínio**: *Settings → Domains*; depois defina `APP_URL` com o domínio final e reimplante.

## 9. Checklist de produção

- [ ] `PAYMENT_PROVIDER=mercadopago` validado em sandbox (PIX, cartão aprovado/recusado, webhook, reembolso).
- [ ] `EMAIL_PROVIDER=resend` com domínio verificado (confirmação de e-mail, recuperação de senha, pedidos).
- [ ] Textos legais revisados por profissional (`/termos`, `/privacidade`, `/trocas-e-devolucoes`, `/cookies`) com razão social, CNPJ e endereço reais.
- [ ] Contas demo removidas ou senhas trocadas (se o banco começou com `SEED_MODE=demo`).
- [ ] Backups automáticos do banco habilitados no provedor.
- [ ] Monitoramento de logs (Vercel Logs / integração de observabilidade).
