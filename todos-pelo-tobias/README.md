# Todos pelo Tobias

Site da campanha solidária **Todos pelo Tobias**: página inicial com meta de arrecadação, história, galeria de fotos e
compartilhamento, e uma página `/doar` que gera **QR Code Pix e Pix Copia e Cola** com o valor escolhido. Feito com
Next.js (App Router), React, TypeScript e Tailwind CSS. Gratuito de hospedar na Vercel e **sem gateway de pagamento**.

## Rodar no seu computador

Requisitos: Node.js 20.19 ou superior.

```bash
cd todos-pelo-tobias
npm install
npm run dev          # http://localhost:3000
```

Outros comandos: `npm run build` (versão de produção), `npm run check` (tipos, lint e testes unitários),
`npm run test:e2e` (testes no navegador; veja "Testes").

## Antes de publicar (checklist)

| #   | O quê                                                                                          | Onde                                                                                                                                                          | Obrigatório            |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **Nome e cidade do recebedor** (como no cadastro da chave Pix; sem acento, até 25 e 15 letras) | `src/config/campaign.ts` (`receiverName`, `receiverCity`) **ou** variáveis `NEXT_PUBLIC_PIX_RECEIVER_NAME` / `NEXT_PUBLIC_PIX_RECEIVER_CITY` (`.env.example`) | **Sim**                |
| 2   | Contato da organização (e-mail, WhatsApp, Instagram)                                           | `src/config/campaign.ts` (`contact`) ou variáveis do `.env.example`                                                                                           | Recomendado            |
| 3   | Fotos do Tobias                                                                                | `public/fotos/` + `src/content/photos.ts`                                                                                                                     | Recomendado            |
| 4   | História verdadeira do Tobias                                                                  | `src/content/story.ts`                                                                                                                                        | Recomendado            |
| 5   | Meta e valor arrecadado                                                                        | `src/config/fundraising.ts`                                                                                                                                   | Já preenchido          |
| 6   | Endereço do site, se usar domínio próprio                                                      | `NEXT_PUBLIC_SITE_URL`                                                                                                                                        | Só com domínio próprio |
| 7   | **Teste real com um app de banco** (veja "Validação do Pix")                                   | —                                                                                                                                                             | **Sim**                |

> **Segurança:** em produção, enquanto o nome e a cidade do recebedor não forem preenchidos, o site **não exibe o QR
> Code** e mostra "Doações por Pix em breve". Nenhum dado do beneficiário é inventado. No `npm run dev` aparece um aviso
> amarelo com valores provisórios, apenas para você ver o fluxo funcionando.

## Meta de arrecadação

Tudo é calculado a partir de **`src/config/fundraising.ts`**, o único arquivo que você edita:

```ts
export const fundraising = {
  enabled: true, // false esconde o card
  raised: 22000, // valor arrecadado, em reais
  goal: 50000, // meta, em reais
  updatedAt: "", // opcional: "2026-10-27" aparece no card
};
```

A barra, a porcentagem (44%), o valor restante (R$ 28.000,00) e a mensagem de agradecimento (R$ 22 mil / R$ 50 mil)
são recalculados sozinhos. Depois de editar, publique de novo (na Vercel, salvar o arquivo no GitHub já basta).

**Regras de ouro**

- O `raised` só deve ser alterado com base em **doações efetivamente confirmadas** (conferidas no extrato ou no app do
  banco). Escolher um valor, gerar o QR Code ou copiar o código Pix **nunca** altera o total: o site não tem como saber
  se o pagamento foi feito (há teste automatizado garantindo isso).
- O card apresenta o número como **"Total informado pela organização da campanha"** e avisa que o site **não consulta
  o banco nem confirma pagamentos**. Mantenha essa transparência.
- A barra nunca exagera: a porcentagem é arredondada para baixo (49.999,99 de 50.000 mostra 99,9%, não 100%).
- Meta alcançada ou superada: o card muda para "Meta alcançada!". Valores inválidos (negativos, meta 0) interrompem o
  build com uma mensagem clara, em vez de publicar um número errado.

**Integração bancária no futuro:** `getFundraising()` em `src/lib/fundraising/index.ts` é o único ponto de leitura do
total. Para automatizar, consulte ali a sua API Pix/conta (apenas pagamentos confirmados), devolva `source: "bank"` e,
se quiser atualização sem novo deploy, adicione `export const revalidate = 300` em `src/app/page.tsx`. O texto de
transparência já muda conforme a origem.

## Adicionar as fotos do Tobias

1. Copie as fotos (JPG, PNG ou WebP) para a pasta `public/fotos/`.
2. Abra `src/content/photos.ts` e liste cada uma, na ordem desejada. **A primeira é a foto de capa** (banner, card e
   página de doação):

```ts
export const photos: Photo[] = [
  {
    src: "/fotos/tobias-1.jpg",
    alt: "Tobias sorrindo",
    caption: "Legenda opcional",
    position: "center top",
  },
  { src: "/fotos/tobias-2.jpg", alt: "Tobias brincando" },
];
```

`alt` descreve a foto para leitores de tela; `position` (opcional) escolhe o enquadramento ao cortar (use `"center top"`
para não cortar o rosto). Enquanto a lista estiver vazia, o site mostra espaços reservados elegantes, **nunca fotos de
terceiros**. As imagens são otimizadas automaticamente (AVIF/WebP, tamanhos responsivos).

**Imagem de compartilhamento (WhatsApp/Facebook):** por padrão é um cartão verde com o nome da campanha
(`src/app/opengraph-image.tsx`). Para usar uma foto real, salve uma imagem 1200×630 como
`src/app/opengraph-image.jpg` e apague o arquivo `.tsx`.

## Escrever a história

Em `src/content/story.ts`, escreva um parágrafo por item de `paragraphs`. Enquanto estiver vazio, o site mostra um texto
neutro. Escreva apenas fatos reais.

## Como o Pix funciona (e o que ele não faz)

- O site gera um **BR Code estático** padrão do Banco Central (EMV) no próprio navegador, com a chave
  `tobiasvaquinha87@gmail.com`, o valor escolhido e o CRC16 correto (`src/lib/pix/`). O **QR Code e o Copia e Cola
  saem exatamente do mesmo texto**.
- Valores sugeridos: R$ 5, 10, 20, 50 e 100 (`src/config/campaign.ts`), mais "Outro valor" com até duas casas
  decimais. Valores vazios, negativos, zerados, com texto, com mais de 2 decimais ou acima de R$ 99.999,99 são recusados
  com mensagem amigável.
- **O pagamento acontece no app do banco.** O site não pede dados bancários nem senhas e **não confirma pagamentos**:
  copiar o código não significa "doação concluída", e a página diz isso.
- Sem gateway e sem custo: não há API de pagamento envolvida.

### Validação do Pix: o que foi testado e o que falta

Testado automaticamente: CRC16 contra vetores calculados à parte (Python); estrutura EMV campo a campo; leitura do
código por um parser independente (`pix-utils`), que valida CRC, chave, recebedor e valor; e **decodificação do QR Code
exibido na tela**, que precisa ser idêntico ao Copia e Cola, para cada valor.

**Não foi possível testar em um aplicativo bancário real.** Antes de divulgar, faça um teste de verdade: gere o QR Code
de R$ 1,00, pague com um app de banco (Copia e Cola e leitura do QR) e confirme que o valor e o nome do recebedor
aparecem corretos. Faça o mesmo em Android e iPhone.

## Publicar gratuitamente na Vercel

1. Garanta que o código está no GitHub (este repositório contém outros sites; este projeto está na pasta
   `todos-pelo-tobias`).
2. Em [vercel.com](https://vercel.com), entre com o GitHub › **Add New… › Project** › importe o repositório.
3. Em **Root Directory**, clique em _Edit_ e escolha **`todos-pelo-tobias`**. O framework **Next.js** é detectado
   sozinho.
4. Em **Environment Variables**, cadastre `NEXT_PUBLIC_PIX_RECEIVER_NAME` e `NEXT_PUBLIC_PIX_RECEIVER_CITY` (e, se
   quiser, as de contato). Alternativa: preencher direto em `src/config/campaign.ts`.
5. Clique em **Deploy**. Em cerca de um minuto o site estará em `https://seu-projeto.vercel.app`.
6. Domínio próprio (opcional): _Settings › Domains_; depois defina `NEXT_PUBLIC_SITE_URL` com o endereço final e faça
   um novo deploy.
7. Para atualizar o site (meta, fotos, textos), edite os arquivos no GitHub e salve: a Vercel publica sozinha. Variáveis
   de ambiente só valem após um novo deploy.

Cabeçalhos de segurança já vêm configurados (`next.config.ts`). Se um dia você adicionar Google Analytics, Meta Pixel ou
similares, inclua o domínio deles na `Content-Security-Policy` desse arquivo.

## Testes

```bash
npm test             # 81 testes unitários (Pix, valores, meta de arrecadação)
npm run test:e2e     # testes no navegador: desktop, Android e iPhone (emulação); sobe o site sozinho
```

Os testes e2e rodam em Chromium com emulação de tela, toque e user agent de celular. Isso **não substitui** testar em
aparelhos reais (principalmente o Safari do iPhone). Cobrem: card clicável, botões, QR Code decodificado, valores
personalizados e inválidos, cópia, galeria, compartilhamento, meta (texto, barra, animação, movimento reduzido),
metadados/Open Graph, erros de console/CSP e acessibilidade (axe, WCAG A/AA).

## Estrutura

```
src/
  app/                 páginas: / (início), /doar, 404, erro, SEO (sitemap, robots, ícones, Open Graph)
  components/
    home/              Hero, GoalCard (meta), CampaignCard, Story, PhotosSection, HowToHelp, Trust
    donate/            DonationFlow, AmountPicker, PixPaymentCard, HowToPay
    photos/            PhotoFrame, Gallery, Lightbox (troque as fotos em src/content/photos.ts)
    share/ layout/ ui/ cabeçalho, rodapé, compartilhamento e peças reutilizáveis
  config/
    campaign.ts        chave Pix, recebedor, valores sugeridos, contato
    fundraising.ts     META e valor arrecadado  <- atualize aqui
  content/             photos.ts (fotos) e story.ts (história)
  lib/
    pix/               BR Code, CRC16 e validações
    fundraising/       cálculo da meta, textos e ponto de integração bancária
    payments/          tipos e provedor atual (Pix estático)
tests/                 unit/ (Vitest) e e2e/ (Playwright)
```

## Outras observações

- Fontes (Fraunces e Plus Jakarta Sans) são servidas pelo próprio site; não há dependência do Google Fonts.
- Sem cookies de rastreamento nem analytics.
- Animações respeitam a preferência "reduzir movimento" do sistema.
