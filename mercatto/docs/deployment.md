# Deploy em produção

## Requisitos

- Node.js 22+
- PostgreSQL 16+ (instância própria — não incluso)
- Redis 7+ (instância própria — não incluso)
- Um domínio com HTTPS (os cookies de sessão só são marcados `secure` em
  produção, mas exigem HTTPS de verdade para funcionar corretamente)

## Variáveis de ambiente

Baseie-se em [`.env.example`](../.env.example). Nenhuma delas tem um valor
padrão seguro — todas precisam ser definidas explicitamente em produção.

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `DATABASE_URL` | sim | string de conexão do Postgres de produção |
| `REDIS_URL` | sim | usado para rate limiting |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | sim | gere com `openssl rand -hex 32`; nunca reutilize os valores de dev |
| `SESSION_COOKIE_NAME` | não | padrão `mercatto_session` |
| `NEXT_PUBLIC_APP_URL` | sim | URL pública do site (usada em e-mails/links absolutos) |
| `NODE_ENV` | sim | `production` — isso também ativa `secure` no cookie de sessão, HSTS e a CSP sem `'unsafe-eval'` |
| `EMAIL_FROM`, `SMTP_*` | sim para verificação de e-mail/recuperação de senha | sem SMTP configurado, esses dois fluxos não conseguem enviar e-mail |
| `PAYMENT_PROVIDER` | não | hoje só `"mock"` tem efeito — ver `docs/architecture.md#pagamentos` para conectar um gateway real |

**Nunca** commite o `.env` de produção. Apenas `.env.example` (sem valores)
e `.env.test` (segredos falsos, usados só pelos testes automatizados) são
versionados — confira o `.gitignore` antes de adicionar qualquer novo
arquivo de ambiente.

## Passo a passo

```bash
npm ci
npx prisma migrate deploy     # aplica migrations existentes sem gerar novas
npm run build
npm run start                 # ou seu process manager (pm2, systemd, etc.)
```

(`npm run db:migrate` roda `prisma migrate dev`, feito para desenvolvimento
— em produção use sempre `prisma migrate deploy`, que só aplica migrations
já geradas e nunca pede confirmação interativa.)

Rodar o seed (`npm run db:seed`) em produção é opcional e só recomendado
para um ambiente de demonstração — ele **limpa dados existentes do domínio
antes de recriar** (é idempotente por design, pensado para dev/staging).
Nunca rode contra um banco de produção com dados reais de clientes.

## Uploads de imagem

`POST /api/upload` (usado no cadastro de produto pelo vendedor) hoje grava
em `public/uploads/` no disco local do servidor. Isso funciona em qualquer
host com disco persistente (VM própria, container com volume). Em uma
plataforma com disco efêmero (ex.: Vercel, onde o filesystem é somente
leitura em produção), essa rota precisa ser trocada por um upload para um
bucket (S3, Cloudinary, Vercel Blob) antes do deploy — é a única parte do
projeto que depende de disco local. Veja o comentário em
`src/app/api/upload/route.ts`.

## Checklist de segurança antes de ir ao ar

- [ ] `NODE_ENV=production` definido (ativa cookie `secure`, HSTS, e
      remove `'unsafe-eval'` da CSP).
- [ ] `JWT_SECRET`/`JWT_REFRESH_SECRET` gerados novos para produção, nunca
      os mesmos de desenvolvimento.
- [ ] SMTP configurado e testado (verificação de e-mail e recuperação de
      senha dependem disso).
- [ ] Backup automático do PostgreSQL configurado.
- [ ] `PAYMENT_PROVIDER` real conectado antes de aceitar pagamentos de
      verdade — enquanto isso não acontecer, **nenhuma cobrança é real**
      (ver `docs/architecture.md#pagamentos`).
- [ ] Upload de imagem migrado para armazenamento persistente/bucket se o
      host de produção tiver disco efêmero.
- [ ] `npm run test` e `npm run test:e2e` passando contra o código que
      vai para produção.

## Observabilidade

O projeto não inclui um APM/error-tracking externo por padrão. Para
produção real, recomenda-se adicionar algo como Sentry (erros do
servidor e do cliente) e métricas básicas de latência das Server
Actions mais críticas (`placeOrderAction`, `loginAction`) — não
implementado aqui para não introduzir uma dependência de serviço externo
sem credenciais do usuário.
