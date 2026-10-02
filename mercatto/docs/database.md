# Banco de dados

PostgreSQL, acessado via Prisma ORM (`generator client`, provider
`prisma-client` — o gerador TypeScript-nativo do Prisma 7, não o antigo
`prisma-client-js`). A conexão usa um driver adapter explícito
(`@prisma/adapter-pg`) em vez do binário de query engine tradicional.

Schema completo em [`prisma/schema.prisma`](../prisma/schema.prisma) — 25
modelos, organizados em 6 grupos.

## Enums

| Enum                | Valores                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `Role`               | `USER`, `SELLER`, `ADMIN`                                                                      |
| `OrderStatus`        | `AWAITING_PAYMENT`, `PAYMENT_APPROVED`, `PREPARING_SHIPMENT`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`, `RETURNED` |
| `PaymentStatus`      | `PENDING`, `APPROVED`, `DECLINED`, `REFUNDED`                                                  |
| `PaymentMethod`      | `CREDIT_CARD`, `PIX`, `BOLETO`                                                                 |
| `CouponType`         | `PERCENTAGE`, `FIXED`                                                                          |
| `NotificationType`   | `ORDER_UPDATE`, `PROMOTION`, `SYSTEM`, `QUESTION_ANSWERED`, `REVIEW_REQUEST`                    |

## Identidade e acesso

- **User** — conta, `passwordHash` (bcrypt), `role`. Um `User` pode ter um
  `Seller` (1:1 opcional) se decidir vender.
- **Session** — uma linha por sessão ativa (`tokenHash`, não o token em
  claro), permite revogar sessões individualmente.
- **PasswordResetToken** / **EmailVerificationToken** — tokens de uso único
  com hash armazenado e expiração.
- **Address** — endereços do usuário; um deles pode ser `isDefault`.

## Vendedores e catálogo

- **Seller** — loja de um `User` (`userId` único: um usuário vende por, no
  máximo, uma loja). `isVerified` controla o selo de vendedor verificado.
- **Category** — árvore auto-referenciada (`parentId` → `Category`), usada
  para a navegação por categoria/subcategoria.
- **Brand** — opcional por produto.
- **Product** — pertence a um `Seller` e uma `Category`; preço em
  **centavos** (`priceCents`, inteiro — nunca float, para não acumular erro
  de arredondamento em dinheiro); `isActive` controla visibilidade pública.
- **ProductImage**, **ProductAttribute** — 1:N a partir de `Product`.
- **ProductVariant** — variações (ex.: tamanho/cor) com `attributes` em
  `Json` e SKU próprio.
- **Inventory** — pertence a um `Product` **ou** a uma `ProductVariant`
  (nunca os dois — regra aplicada em código, não é um `CHECK` do banco).
  `quantity - reserved` é o disponível de verdade; `reserved` sobe ao
  colocar no carrinho/iniciar checkout e desce ao confirmar ou expirar.

## Carrinho

- **Cart** — um por `User` (`userId` único), pode ter um `Coupon` aplicado.
- **CartItem** — único por `(cartId, productId, variantId)` — adicionar o
  mesmo produto duas vezes incrementa a quantidade, não duplica a linha.

## Pedidos e pagamento

- **Order** — `orderNumber` legível (`MKT-YYYY-XXXXXX`) além do `id` UUID;
  guarda **snapshot** dos valores (`subtotalCents`, `shippingCents`,
  `discountCents`, `totalCents`) no momento da compra — mudanças futuras no
  preço do produto ou nas regras do cupom não afetam pedidos já feitos.
- **OrderItem** — uma linha por produto comprado, com `productNameSnapshot`
  e `unitPriceCents` também congelados no momento da compra, e `sellerId`
  denormalizado (permite ao painel do vendedor listar seus itens vendidos
  sem join adicional por pedido).
- **Payment** — 1:1 com `Order`; `provider` é o nome do `PaymentProvider`
  que processou (`"mock"` hoje); `externalReference` é o id retornado por
  esse provider.
- **Shipment** — 1:1 com `Order`, dados de rastreio.

## Avaliações, perguntas, favoritos

- **Review** — nota + comentário, único por `(productId, userId)` (um
  usuário avalia um produto uma vez); `isVerifiedPurchase` quando ligada a
  um `OrderItem` real.
- **Question** — pergunta pública no produto, respondida pelo vendedor
  (`answer`/`answeredAt`).
- **Wishlist** — único por `(userId, productId)`.

## Marketing e sistema

- **Coupon** — percentual ou valor fixo, com `maxUses`/`usedCount` e
  `expiresAt`; validação de uso (ativo, não expirado, limite) acontece
  sempre no servidor ao aplicar (`applyCouponAction`) e ao finalizar o
  pedido, nunca confiando no desconto que a UI mostra.
- **Notification** — avisos para o usuário (pedido atualizado, pergunta
  respondida, etc.).
- **AuditLog** — trilha de auditoria para ações administrativas sensíveis
  (`userId` pode ser `null` com `onDelete: SetNull` — o log sobrevive à
  exclusão do usuário que o gerou).

## Índices

Todo campo usado em busca/filtro de alto tráfego tem índice: `slug` e
`sku` são `@unique` (bom para lookup *e* já garante unicidade); chaves
estrangeiras de alto volume (`Product.categoryId/sellerId/brandId`,
`OrderItem.orderId/sellerId/productId`, etc.) têm `@@index`; `Product`
também indexa `isActive` e `priceCents` (filtro e ordenação do catálogo);
`Order` indexa `status` (listagens do admin/vendedor por status);
`AuditLog` indexa `(entityType, entityId)` e `createdAt` para consulta por
entidade e por período.

## Migrations e seed

```bash
npm run db:migrate   # prisma migrate dev — aplica/gera migrations
npm run db:seed      # prisma/seed.ts — popula dados de demonstração
npm run db:studio    # prisma studio — explorar o banco visualmente
```

O seed (`prisma/seed.ts`) é **idempotente** (limpa as tabelas do domínio
antes de recriar) e gera: ~11 categorias principais com subcategorias,
marcas, 20 lojas de vendedores, 1 admin + 8 compradores demo, produtos com
imagens/atributos/estoque distribuídos pelas categorias-folha, e 2 cupons
de exemplo (`BEMVINDO10`, `FRETE20`). Ele roda fora do pipeline do Next.js
(via `tsx`), por isso não importa nada marcado `server-only` — o hash de
senha é feito diretamente com `bcryptjs`.
