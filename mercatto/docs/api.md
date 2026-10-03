# API

A superfície "pública" do Mercatto é majoritariamente **Server Actions**
(`"use server"`) chamadas diretamente pelos formulários e componentes — não
uma API REST/JSON convencional. Existem apenas dois **Route Handlers**
HTTP de verdade, para os casos que precisam ser chamados via `fetch()` do
cliente fora de um envio de formulário.

Todas as actions e rotas abaixo fazem sua própria checagem de autorização
no servidor (`requireUser()` / `requireRole([...])`) — nenhuma depende do
que a UI esconde ou mostra.

## Route Handlers

### `GET /api/search/suggestions?q=...`

Autocomplete de busca. Sem autenticação (é usado no cabeçalho, para
qualquer visitante). Limitado a 60 requisições/minuto por IP
(`x-forwarded-for`); acima disso responde `429` com `{ items: [] }`.
Resposta: `{ items: ProductSuggestion[] }`.

### `POST /api/upload`

Upload de imagem de produto (multipart/form-data, campo `file`). Exige
sessão com papel `SELLER` ou `ADMIN` (`401` caso contrário). Aceita
JPEG/PNG/WEBP/GIF até 5MB; rejeita o resto com `400`. Limitado a 40
uploads/hora por usuário (`429` acima disso). Salva em
`public/uploads/<uuid>.<ext>` e responde `{ url }`. Pensado para troca
fácil por um bucket (S3/Cloudinary/Vercel Blob) em produção — só a rota
muda, o formulário que a chama não.

## Server Actions

Organizadas por domínio, em `src/lib/actions/`. A assinatura comum de
actions ligadas a `useActionState` é `(prevState, formData) => ActionState`,
onde `ActionState` é `{ status: "success" | "error", message?, fieldErrors?
}`.

### `auth.ts` — autenticação

| Action | Descrição |
| --- | --- |
| `registerAction` | Cria conta (valida senha forte, e-mail único); limitado por IP. |
| `loginAction` | Autentica e cria `Session`; mensagem de erro genérica (não revela se o e-mail existe); limitado por IP+e-mail. |
| `logoutAction` | Revoga a sessão atual. |
| `requestPasswordResetAction` | Gera token de recuperação (sempre responde sucesso, mesmo se o e-mail não existir, para não permitir enumeração de contas); limitado por IP. |
| `resetPasswordAction` | Troca a senha com um token válido e não usado. |
| `verifyEmailToken` | Confirma o e-mail a partir do token enviado. |

### `account.ts` — conta do usuário

`updateProfileAction`, `changePasswordAction`, `createAddressAction`,
`deleteAddressAction`, `setDefaultAddressAction`, `revokeSessionAction`
(encerrar uma sessão/dispositivo específico), `becomeSellerAction` (eleva
um `USER` a `SELLER`, criando sua `Seller`).

### `catalog.ts` — produtos (lado comprador)

`askQuestionAction` (pergunta pública no produto, limitada por usuário).

### `cart.ts` — carrinho

`addToCartAction`, `updateCartItemQuantityAction`, `removeCartItemAction`,
`applyCouponAction` (valida o cupom no servidor; limitada a 20
tentativas/10min por usuário contra força bruta de código), `removeCouponAction`.
Toda operação reconfere o estoque disponível (`quantity - reserved`) no
banco antes de aceitar a quantidade pedida.

### `checkout.ts` — finalização de pedido

`placeOrderAction` — recalcula subtotal, frete e desconto a partir do
banco (nunca confia no total que o formulário envia), reserva estoque,
chama `PaymentProvider.charge()`, cria `Order`/`OrderItem`/`Payment`, e
redireciona para `/pedido-confirmado/[orderNumber]` no sucesso.

### `orders.ts` — pedidos

`cancelOrderAction` (só o dono do pedido, só em status cancelável),
`requestReturnAction`, `advanceOrderStatusAction` (vendedor avança o
status dos itens que são dele).

### `seller.ts` — área do vendedor

`createProductAction`, `updateProductAction`, `deleteProductAction`,
`toggleProductActiveAction` — todas exigem papel `SELLER` **e** que o
produto pertença à loja do usuário autenticado (um vendedor nunca edita
produto de outro, mesmo manipulando o `id` na requisição).

### `admin.ts` — painel administrativo

`updateUserRoleAction`, `toggleSellerVerifiedAction`,
`toggleProductActiveAdminAction`, `createCategoryAction`,
`deleteCategoryAction`, `createCouponAction`, `toggleCouponActiveAction`,
`deleteReviewAction` — todas exigem papel `ADMIN`; mudanças sensíveis
gravam em `AuditLog` (quem, o quê, quando).

## Autorização por ação, não por rota

Como quase tudo é Server Action, não existe um middleware central de API
que decida "essa rota é admin". Cada action chama `requireRole([...])` (ou
`requireUser()`) na primeira linha — é assim que `src/lib/actions/admin.ts`
garante que um `USER` comum nunca executa uma mutação administrativa, mesmo
que descubra o nome da action ou monte a chamada manualmente: a Server
Action ainda roda no servidor e ainda faz a checagem.
