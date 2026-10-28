# Ajude May nessa caminhada ❤️

Site da campanha solidária da May: página inicial com história, card da vaquinha, galeria de fotos, meta de
arrecadação, compartilhamento e transparência, e uma página `/doar` que gera **QR Code Pix e Pix Copia e Cola** com o
valor escolhido. Feito com Next.js (App Router), React, TypeScript e Tailwind CSS. Gratuito de hospedar na Vercel e
**sem gateway de pagamento**.

## Rodar no seu computador

Requisitos: Node.js 20.19 ou superior.

```bash
cd ajude-may
npm install
npm run dev          # http://localhost:3000
```

Outros comandos: `npm run build` (versão de produção), `npm run check` (tipos, lint e testes unitários),
`npm run test:e2e` (testes no navegador; veja "Testes").

## Antes de divulgar (checklist)

| #   | O quê                                       | Onde                                                                   | Situação hoje                       |
| --- | ------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| 1   | **Chave Pix oficial** (`PIX_KEY`)           | `src/config/pix.ts` ou variável na Vercel                              | Preenchida: `ajudemaya00@gmail.com` |
| 2   | Nome e cidade do titular da chave           | `PIX_RECEIVER_NAME` / `PIX_RECEIVER_CITY` (mesmo arquivo ou na Vercel) | Falta (recomendado)                 |
| 3   | Fotos e vídeo reais e autorizados da May    | `public/fotos/`, `public/video/` + `src/content/photos.ts`             | 1 foto e 1 vídeo                    |
| 4   | Meta e valor arrecadado                     | `src/config/fundraising.ts`                                            | Preenchido: R$ 16.000 de R$ 30.000  |
| 5   | Responsáveis, dados, contato e atualizações | `src/content/transparency.ts`                                          | Falta (mostra "em breve")           |
| 6   | **Teste real com um app de banco**          | veja "Validação do Pix"                                                | **Obrigatório**                     |

Tudo que ainda não foi informado aparece de forma discreta e honesta no site: **nenhum número, foto, chave ou
depoimento é inventado**.

## Configurar o Pix oficial

Abra `src/config/pix.ts` e preencha entre as aspas, **ou** cadastre as variáveis na Vercel (_Settings › Environment
Variables_) e faça um novo deploy. A variável de ambiente tem prioridade sobre o arquivo.

```ts
export const PIX_KEY = process.env.PIX_KEY || "chave-oficial@exemplo.com";
export const PIX_RECEIVER_NAME = process.env.PIX_RECEIVER_NAME || "Nome do Titular";
export const PIX_RECEIVER_CITY = process.env.PIX_RECEIVER_CITY || "Cidade";
```

- **`PIX_KEY`**: e-mail, CPF, CNPJ, chave aleatória ou telefone no formato `+55DDDNÚMERO` (ex.: `+5511999999999`).
  CPF/CNPJ podem ter pontos e traços; o site normaliza e confere os dígitos. Uma chave inválida **interrompe o build**
  com uma mensagem clara, para nunca publicar um Pix que não funciona.
- **`PIX_RECEIVER_NAME` / `PIX_RECEIVER_CITY`**: como no cadastro do banco. Opcionais, mas recomendados: o nome aparece
  no aviso "confira o nome do beneficiário antes de confirmar". Sem eles, o código Pix usa valores neutros ("AJUDE MAY",
  "BRASIL"), já que o padrão do Banco Central exige esses campos; o app do banco identifica o recebedor pela chave.
- **Enquanto `PIX_KEY` estiver vazia**, a página `/doar` mostra "As doações por Pix serão liberadas em breve" e **não
  gera QR Code nenhum**.

### Como o Pix funciona (e o que ele não faz)

- O site gera, no próprio navegador, um **BR Code estático** padrão do Banco Central (EMV) com a chave, o valor
  escolhido e o **CRC16** correto (`src/lib/pix/`). O QR Code e o Copia e Cola saem **exatamente do mesmo texto**: ao
  escolher R$ 20,00, ambos contêm o valor `20.00`.
- Valores sugeridos: R$ 5, 10, 20, 50 e 100 (`src/config/campaign.ts`) e um campo "Outro valor" (até duas casas
  decimais). Vazios, negativos, zerados, com texto ou acima de R$ 99.999,99 são recusados com mensagem amigável.
- **O pagamento acontece no app do banco.** O site não pede dados bancários e **não confirma pagamentos**: gerar ou
  copiar o código nunca marca uma doação como recebida, e a página diz isso.

### Validação do Pix: o que foi testado e o que falta

Testado automaticamente: CRC16 contra vetores de referência; estrutura EMV campo a campo; leitura por um parser
independente (`pix-utils`), que confere CRC, chave, recebedor e valor; e **decodificação do QR Code exibido na tela**,
que precisa ser idêntico ao Copia e Cola, para cada valor.

**Não foi possível testar em um aplicativo bancário real.** Antes de divulgar, gere o QR Code de R$ 1,00 (campo "Outro valor"), pague com um app de banco (pelo QR e pelo Copia e
Cola) e confirme que o valor e o nome do beneficiário aparecem corretos. Faça o mesmo em Android e iPhone.

## Meta de arrecadação

Edite **`src/config/fundraising.ts`** (valores em reais, sem ponto de milhar) e publique de novo:

```ts
export const fundraising = {
  valorArrecadado: 16000, // valor efetivamente arrecadado (R$ 16.000,00)
  metaArrecadacao: 30000, // meta total (R$ 30.000,00)
  atualizadoEm: "", // opcional: data da última conferência, ex.: "2026-11-05"
};
```

A porcentagem (53,3%), o valor restante (R$ 14.000,00), a barra (53,33% de preenchimento) e a mensagem ("Já
percorremos mais da metade…") são calculados sozinhos e aparecem, sempre iguais, em quatro lugares: no **card em
destaque logo abaixo do banner** (com contador animado e botão "FAZER MINHA DOAÇÃO"), na **versão compacta da página
`/doar`** (acima da escolha de valores), no card da vaquinha e na seção "Nossa meta".

- **Regra de ouro:** `valorArrecadado` só muda com doações **conferidas no extrato ou no app do banco**. Escolher um
  valor, gerar o QR Code ou copiar o Pix nunca altera o total (há teste automatizado garantindo isso). O site apresenta
  os números como "informados pelos responsáveis" e avisa que não consulta o banco.
- O contador de R$ 0 até o valor é só efeito visual: o valor real já vem na página e é o que leitores de tela leem; com
  "reduzir movimento" ativado no aparelho, não há animação.
- A porcentagem exibida é arredondada para baixo (nunca mostra 100% antes da hora). Valores inválidos interrompem o
  build com mensagem clara. `null` em um dos campos esconde os números e mostra só o objetivo da campanha.
- Alternativa sem editar código: variáveis `FUNDRAISING_RAISED`, `FUNDRAISING_GOAL` e `FUNDRAISING_UPDATED_AT` na
  Vercel (exigem novo deploy).
- **Integração bancária no futuro:** `getFundraising()` em `src/lib/fundraising/index.ts` é o único ponto de leitura do
  total. Basta trocá-lo por uma consulta à sua API Pix (somente pagamentos confirmados) e devolver `source: "bank"`; os
  textos de transparência já mudam conforme a origem.

## Adicionar as fotos da May

Use **somente fotografias reais, autorizadas pela família ou pela organização**.

1. Copie as fotos (JPG, PNG ou WebP) para `public/fotos/`.
2. Liste-as em `src/content/photos.ts`, na ordem desejada. **A primeira é a capa** (banner, card e página de doação);
   a 2ª e a 3ª também aparecem na seção "Uma caminhada que merece apoio…":

```ts
export const photos: Photo[] = [
  { src: "/fotos/may-1.jpg", alt: "May sorrindo", position: "center top" },
  { src: "/fotos/may-2.jpg", alt: "May com a família", caption: "Legenda opcional" },
];
```

`alt` descreve a foto para leitores de tela; `position` escolhe o enquadramento ao cortar (`"center top"` evita cortar o
rosto). A galeria mostra a primeira foto em destaque e as próximas em grade (com "+N" quando houver mais de 5); todas
abrem em tela cheia com setas, gesto de deslizar, teclado e miniaturas. As imagens são otimizadas automaticamente.

**Imagem de compartilhamento (WhatsApp/Facebook):** hoje é gerada sem foto (`src/app/opengraph-image.tsx`). Para usar
uma foto real: apague esse arquivo e coloque `src/app/opengraph-image.jpg` (1200×630) e o texto alternativo em
`src/app/opengraph-image.alt.txt`.

## Transparência e textos

- `src/content/transparency.ts`: responsáveis pela arrecadação, dados verificáveis, contato oficial (ou variáveis
  `CONTACT_EMAIL`, `CONTACT_WHATSAPP`, `CONTACT_INSTAGRAM`) e atualizações publicadas. O que estiver vazio aparece como
  "em breve". Não inclua depoimentos, números de doadores ou selos que não existam.
- `src/content/story.ts`: história e seção emocional (texto oficial da campanha; escreva só fatos confirmados).
- `src/config/campaign.ts`: título, subtítulo, mensagem de destaque e valores sugeridos.
- `src/lib/share.ts`: texto pronto de compartilhamento.

## Publicar gratuitamente na Vercel

1. O código precisa estar no GitHub (este repositório tem outros sites; este projeto fica na pasta `ajude-may`).
2. Em [vercel.com](https://vercel.com), entre com o GitHub › **Add New… › Project** › importe o repositório.
3. Em **Root Directory**, clique em _Edit_ e escolha **`ajude-may`**. O framework Next.js é detectado sozinho.
4. Em **Environment Variables**, cadastre `PIX_KEY`, `PIX_RECEIVER_NAME` e `PIX_RECEIVER_CITY` (ou preencha o arquivo)
   e, se quiser, as demais do `.env.example`.
5. Clique em **Deploy**. Em cerca de um minuto o site estará em `https://seu-projeto.vercel.app`.
6. Domínio próprio (opcional): _Settings › Domains_; depois defina `NEXT_PUBLIC_SITE_URL` com o endereço final.
7. Para atualizar (meta, fotos, textos), edite os arquivos no GitHub e salve: a Vercel publica sozinha. **Variáveis de
   ambiente só valem após um novo deploy** (_Deployments › ⋯ › Redeploy_).

Cabeçalhos de segurança (CSP, nosniff, frame-ancestors) já vêm configurados em `next.config.ts`.

## Testes

```bash
npm test             # 68 testes unitários (Pix, chaves, valores, meta, compartilhamento)
npm run test:e2e     # 54 testes no navegador; constrói e sobe dois sites sozinho
```

Os testes no navegador usam dois sites: um **configurado** com uma chave **fictícia** de teste
(`chave-teste@example.com`) e meta de teste (R$ 7.500 de R$ 20.000), e outro no **estado padrão** (meta oficial, sem chave Pix
e sem fotos). Cobrem: card clicável, todos os botões de doação, menu, QR Code decodificado para R$ 5/10/20/50/100 e valores
personalizados, valores inválidos, COPIAR PIX, aviso do beneficiário, barra animada, galeria e ampliação,
compartilhamento (WhatsApp, Facebook, copiar link, nativo), Open Graph, erros de console e acessibilidade (axe, WCAG
A/AA), em desktop e celular (emulação no Chromium; não substitui aparelhos reais, principalmente o Safari do iPhone).

## Estrutura

```
src/
  app/              páginas: / (início), /doar, 404, erro, SEO (sitemap, robots, ícones, Open Graph)
  components/
    home/           Hero, StorySection + CampaignCard, JourneySection, PhotosSection, GoalSection, HowToHelp, Transparency
    donate/         DonationFlow, AmountPicker, PixPaymentCard, HowToPay, PixUnavailable
    photos/ share/ layout/ ui/
  config/
    pix.ts          PIX_KEY, PIX_RECEIVER_NAME, PIX_RECEIVER_CITY   <- chave oficial aqui
    fundraising.ts  meta e valor arrecadado                          <- atualize aqui
    campaign.ts     textos e valores sugeridos
  content/          photos.ts, story.ts, transparency.ts
  lib/              pix/ (BR Code, CRC16), fundraising/, payments/, money, share
tests/              unit/ (Vitest) e e2e/ (Playwright)
```
