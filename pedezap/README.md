# PedeZap: cardápio digital com pedidos no WhatsApp e PIX

SaaS para pequenos negócios que vendem pelo WhatsApp (lanchonetes, açaí, pizzarias, docerias, salgados, distribuidoras).
O lojista monta o cardápio, compartilha o link e recebe cada pedido organizado no WhatsApp, com PIX já calculado
no valor exato. Você cobra uma **mensalidade fixa** (padrão R$ 49,90), sem comissão por pedido.

## O que já funciona

| Parte | O que faz |
| --- | --- |
| **Landing page** (`/`) | Página de vendas com demonstração, calculadora de comissão, preço e FAQ |
| **Cadastro / login** | Conta com 7 dias grátis, sem cartão |
| **Painel do lojista** (`/painel`) | Pedidos em tempo real com aviso sonoro, cardápio com fotos e categorias, abrir/fechar loja, taxa de entrega, pedido mínimo, chave PIX, QR Code e cartaz para imprimir, assinatura |
| **Loja pública** (`/loja/nome-da-loja`) | Cardápio mobile, carrinho, entrega ou retirada, PIX (QR + copia e cola com o valor do pedido), dinheiro com troco, cartão. O pedido vai formatado para o WhatsApp da loja |
| **Admin** (`/admin`) | MRR e barra de progresso até a meta de R$ 100 mil, lojas em teste, vencidas e pagantes, botão "+30 dias" ao confirmar um pagamento, botão "Chamar" com mensagem de venda pronta, gerar nova senha |
| **Cobrança** | O lojista paga a mensalidade por PIX na sua chave. Você confere e clica "+30 dias" no admin. Loja vencida sai do ar sozinha |

Detalhes técnicos: Node.js 22 puro (**zero dependências**), banco SQLite embutido, senhas com scrypt,
proteção CSRF, limite de tentativas, preços sempre recalculados no servidor (o cliente não consegue
alterar o valor do pedido) e PIX no padrão BR Code do Banco Central, com teste contra o exemplo oficial.

## Rodar no seu computador

Precisa do Node.js 22.13 ou mais novo.

```bash
cd pedezap
cp .env.example .env      # edite com seus dados
npm start                 # abre em http://localhost:3000
npm test                  # roda os testes automáticos
```

Para virar admin: coloque seu e-mail em `ADMIN_EMAILS` no `.env`, crie a conta em `/cadastro` e acesse `/admin`.

## Colocar no ar

> O GitHub Pages **não roda** este projeto: ele só hospeda sites estáticos, e aqui existe servidor e banco de dados.

Serve qualquer hospedagem que rode Node 22 ou Docker **com disco persistente** (o banco fica na pasta `DATA_DIR`).
Hospedagem sem disco persistente apaga todas as lojas a cada deploy.

**Opção 1: Docker (Railway, Render com disco, Fly.io etc.)**
Use o `Dockerfile` desta pasta, monte um volume em `/data` e configure as variáveis do `.env.example`
no painel da hospedagem.

**Opção 2: VPS (Hostinger, Contabo, DigitalOcean; a partir de uns R$ 30/mês)**

```bash
git clone https://github.com/sillasgabrielhjhj-lab/SG.git && cd SG/pedezap
cp .env.example .env && nano .env
npx pm2 start npm --name pedezap -- start   # mantém rodando e reinicia sozinho
```

Para HTTPS automático, instale o [Caddy](https://caddyserver.com) com este `Caddyfile`:

```
seudominio.com.br {
    reverse_proxy localhost:3000
}
```

**Backup:** copie o arquivo `data/pedezap.db` todo dia, ou use `sqlite3 data/pedezap.db ".backup backup.db"`.
Perder esse arquivo significa perder todos os clientes.

## Configuração (`.env`)

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `APP_NAME` | PedeZap | Nome do produto em todas as telas |
| `BASE_URL` | (do navegador) | Endereço público, usado nos links e QR Codes |
| `PRICE_CENTS` | 4990 | Mensalidade em centavos |
| `TRIAL_DAYS` | 7 | Dias de teste grátis |
| `GOAL_CENTS` | 10000000 | Meta de MRR no admin (R$ 100 mil) |
| `ADMIN_EMAILS` | - | Quem acessa o `/admin` |
| `SUPPORT_WHATSAPP` | - | Seu WhatsApp de vendas/suporte (recebe os pedidos da loja demo) |
| `BILLING_PIX_KEY` / `_NAME` / `_CITY` | - | Sua chave PIX para receber as mensalidades |
| `TRUST_PROXY` | 1 | Ler o IP real atrás de proxy (Railway, Nginx, Caddy) |
| `SEED_DEMO` | 1 | Criar a loja de demonstração `/loja/demo` |

## A conta dos R$ 100 mil por mês

Código não traz cliente. O que faz o número crescer é venda. A matemática:

| Mensalidade | Lojas pagantes para R$ 100 mil/mês |
| --- | --- |
| R$ 49,90 | **2.004** |
| R$ 79,90 | 1.252 |
| R$ 99,90 | 1.001 |

E todo mês uma parte cancela. Se 5% cancelarem por mês, com 2.000 lojas você perde 100 por mês e precisa
fechar 100 novas só para ficar no mesmo lugar. Se 1 em cada 4 testes vira cliente, são uns 400 cadastros por mês.
Na prática, isso leva anos, não meses. Passos que funcionam para esse tipo de produto:

1. **Primeiras 10 lojas (semana 1-2):** ofereça para quem já é seu cliente de site (Leli, American Burger...) e
   para lanchonetes do seu bairro. Monte o cardápio **para** eles na hora, com as fotos tiradas no celular.
   Lojista pequeno não tem tempo de configurar nada.
2. **Até 100 lojas:** visite comércios que já vendem pelo WhatsApp e Instagram. Mostre a demo no celular
   e a calculadora de comissão. Use o botão "Chamar" do admin todo dia com quem está em teste e ainda não
   cadastrou produto: ativar o lojista é o que faz ele pagar.
3. **Indicação:** dê 1 mês grátis para cada loja indicada que assinar.
4. **Crescimento automático:** toda loja mostra "Faça seu cardápio digital com o PedeZap" no rodapé. Cada cliente
   final que pede vira propaganda para outro lojista.
5. **Conteúdo:** vídeos curtos mostrando um pedido chegando organizado no WhatsApp com o PIX pronto.
6. **Parcerias:** contadores, vendedores de maquininha e fornecedores (distribuidoras de bebida, embalagens)
   falam com centenas de lojistas por mês.

## Próximos passos técnicos (quando os clientes pedirem)

- **Cobrança automática recorrente** (Asaas, Mercado Pago ou Stripe com webhook liberando +30 dias sozinho).
  Com mais de ~100 clientes, conferir PIX na mão vira gargalo.
- **Adicionais e variações** (tamanho, sabores, complementos do açaí, meia pizza): é o pedido mais comum em delivery.
- Recuperação de senha por e-mail (hoje o admin gera uma senha nova).
- Plano mais caro com domínio próprio, várias lojas ou relatórios.

## Estrutura

```
pedezap/
  server.js          rotas HTTP e regras de negócio
  lib/               banco, autenticação, PIX, QR Code, pedidos
  public/            páginas (landing, painel, loja, admin) e static/ (CSS e JS)
  test/              testes automáticos (npm test)
```
