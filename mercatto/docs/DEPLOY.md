# Deploy na Vercel — passo a passo

Este guia publica o Mercatto na Vercel com PostgreSQL gerenciado, Vercel Blob para imagens e, opcionalmente, Mercado Pago e Resend. Tempo estimado: 20–30 minutos.

> O repositório contém outros arquivos na raiz (site pessoal). O app fica na pasta **`mercatto/`** — por isso o **Root Directory** precisa ser configurado.

## Prévia rápida (link para avaliar antes de publicar)

Para só navegar pelo site com os dados DEMO, sem instalar nada no computador:

1. Vercel → **Add New… → Project** → importe o repositório → **Root Directory: `mercatto`**.
2. **Storage → Create Database → Neon (Postgres)** e conecte ao projeto (as variáveis do banco são criadas automaticamente; a conexão direta para migrations é detectada sozinha).
3. Adicione as variáveis: `AUTH_SECRET` (texto aleatório com 32+ caracteres), `PAYMENT_PROVIDER=dev`, `PAYMENT_WEBHOOK_SECRET` (16+ caracteres), `CRON_SECRET` (16+ caracteres) **`SEED_ON_BUILD=demo`** (o próprio build cria as tabelas e os dados DEMO; é idempotente) e **`DEMO_PASSWORD`** (senha só sua, 10+ caracteres, usada por todas as contas DEMO — obrigatória em produção).
4. Clique em **Deploy** (ou **Redeploy**). Ao terminar, a Vercel mostra o link.
5. Entre com `admin@mercatto.dev` e a senha definida em `DEMO_PASSWORD`.

Upload de imagens exige o Vercel Blob (passo 4 abaixo); a navegação, o carrinho e o checkout simulado funcionam sem ele. Para a operação real, **remova `SEED_ON_BUILD`** e siga a seção abaixo.

## Da prévia DEMO para a operação real (Stripe)

1. **Stripe — modo de teste.** Entre no [painel da Stripe](https://dashboard.stripe.com) (conta do Brasil) e ligue o **modo de teste**.
   - Chaves: [Desenvolvedores → Chaves de API](https://dashboard.stripe.com/test/apikeys) → copie a **chave publicável** (`pk_test_…`) e a **chave secreta** (`sk_test_…`).
   - PIX: [Configurações → Formas de pagamento](https://dashboard.stripe.com/test/settings/payment_methods) → ative **Pix**. Se a conta não oferecer Pix, defina `STRIPE_PIX_ENABLED=false` (o site oferece só cartão).
   - Webhook: [Desenvolvedores → Webhooks](https://dashboard.stripe.com/test/webhooks) → adicionar endpoint `https://SEU-DOMINIO/api/webhooks/payments/stripe` com os eventos `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`, `payment_intent.requires_action` e `charge.refunded` → copie o **segredo de assinatura** (`whsec_…`).
2. Vercel → *Settings → Environment Variables*:
   - `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (as três do **mesmo modo**: teste ou produção).
   - `PURGE_DEMO_DATA=true`, `ADMIN_EMAIL` (e-mail real, ainda não cadastrado no site) e `ADMIN_PASSWORD` (10+ caracteres com letras e números).
   - **Apague** `SEED_ON_BUILD`.
3. *Deployments → Redeploy*. O build cria o administrador real, transfere a loja oficial para ele e remove pedidos, produtos, lojas, usuários, cupons e campanhas DEMO (categorias, marcas e regras de frete ficam). A limpeza é idempotente.
4. Teste uma compra. Cartão aprovado: `4242 4242 4242 4242`, validade futura, CVC qualquer; recusado: `4000 0000 0000 0002`; com confirmação do banco (3D Secure): `4000 0027 6000 3184`. PIX: a página de pagamento mostra o link **"Abrir página de teste do PIX"**, que simula o pagamento. Enquanto as chaves forem de teste, o site exibe a faixa "Ambiente de demonstração".
5. Para vender de verdade: conclua a ativação da conta na Stripe (dados da empresa e conta bancária), troque as três variáveis pelas chaves de **produção** ([chaves](https://dashboard.stripe.com/apikeys) `pk_live_…`/`sk_live_…` e um [webhook de produção](https://dashboard.stripe.com/webhooks) com o mesmo endereço e eventos — novo `whsec_…`) e reimplante. Depois remova `PURGE_DEMO_DATA`.
6. Em `/admin/configuracoes` preencha contatos e redes sociais reais. Com a Stripe, todas as parcelas são **sem juros para o comprador** (a tarifa do parcelamento fica com a loja) — ajuste o máximo de parcelas e a parcela mínima. Cadastre os produtos oficiais em `/admin/produtos/novo` (fotos exigem o Vercel Blob — passo 4 do guia completo).

O Mercado Pago continua disponível como alternativa (`PAYMENT_PROVIDER=mercadopago` + `MERCADOPAGO_*`, webhook em `/api/webhooks/payments/mercadopago`).

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
| `PAYMENT_PROVIDER` | `dev` (demonstração), `stripe` ou `mercadopago` |
| `PAYMENT_WEBHOOK_SECRET` | `openssl rand -base64 32` (necessário com `dev`) |
| `STORAGE_PROVIDER` | `vercel-blob` |
| `EMAIL_PROVIDER` | `console` (sem envio) ou `resend` |
| `SHIPPING_PROVIDER` | `table` |
| `LOG_LEVEL` | `info` |

Com Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (e `STRIPE_PIX_ENABLED=false` se a conta não tiver Pix). Com Mercado Pago (alternativa): `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` (mesmo valor da pública), `MERCADOPAGO_WEBHOOK_SECRET`. Com Resend: `RESEND_API_KEY`, `EMAIL_FROM` (domínio verificado no Resend).

## 6. Deploy

Clique em **Deploy** (ou *Redeploy*). O build executa:

```
prisma generate && prisma migrate deploy && node scripts/seed-on-build.mjs && next build
```

As migrations são aplicadas automaticamente a cada deploy (operação não destrutiva). O passo de seed só age quando `SEED_ON_BUILD` ou `PURGE_DEMO_DATA` estão definidas.

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
5. **Webhook do Mercado Pago** (se usado): painel do Mercado Pago → *Webhooks* → URL `https://SEU-DOMINIO/api/webhooks/payments/mercadopago`, eventos de pagamento; copie a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`. A CSP libera os domínios do Mercado Pago automaticamente quando `PAYMENT_PROVIDER=mercadopago`. Se um webhook se perder, o status é conciliado consultando a API ao abrir o pedido e antes de expirar a reserva.
6. **Domínio**: *Settings → Domains*; depois defina `APP_URL` com o domínio final e reimplante.

## 9. Checklist de produção

- [ ] `PAYMENT_PROVIDER=stripe` validado no modo de teste (PIX, cartão aprovado/recusado/3D Secure, parcelado, webhook, reembolso).
- [ ] `EMAIL_PROVIDER=resend` com domínio verificado (confirmação de e-mail, recuperação de senha, pedidos).
- [ ] Textos legais revisados por profissional (`/termos`, `/privacidade`, `/trocas-e-devolucoes`, `/cookies`) com razão social, CNPJ e endereço reais.
- [ ] Contas demo removidas ou senhas trocadas (se o banco começou com `SEED_MODE=demo`).
- [ ] Backups automáticos do banco habilitados no provedor.
- [ ] Monitoramento de logs (Vercel Logs / integração de observabilidade).
