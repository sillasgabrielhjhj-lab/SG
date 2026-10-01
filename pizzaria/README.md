# Pizzaria — site de pedidos (Next.js)

Site da **Hunt Brothers Pizza** focado em gerar pedidos: o cliente escolhe a pizza, personaliza (tamanho, meio a meio, borda, adicionais, observações), revisa a sacola e finaliza pelo **WhatsApp** com a mensagem do pedido montada automaticamente.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Zustand

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm run lint && npm run typecheck
```

## O que editar antes de publicar

| O quê | Onde |
| --- | --- |
| Nome, **WhatsApp**, telefone, e-mail, endereço, Instagram, horários, taxa de entrega, pedido mínimo | `src/config/site.ts` |
| Cardápio (produtos, preços, ingredientes, selos, destaques) | `src/data/menu.ts` |
| Tamanhos, bordas, adicionais, sabores de bebidas e combos | `src/data/options.ts` |
| Categorias e ordem do cardápio | `src/data/categories.ts` |
| **Fotos** (hoje são fotos de banco gratuito, apenas exemplo) | `src/data/images.ts` |
| Galeria | `src/data/gallery.ts` |
| Avaliações (**hoje são placeholders**: substitua por avaliações reais) | `src/data/reviews.ts` |
| Textos (hero, história, processo, chamada final) | `src/data/content.ts` |
| Logo | `public/brand/logo.png` (gerada por `node scripts/prepare-brand.mjs` a partir de `scripts/logo-original.png`) |

> Todas as informações de contato, endereço, horários e preços são **placeholders**. Em desenvolvimento, o console avisa enquanto o número de WhatsApp não for configurado.

## Funcionalidades

- Header fixo com status **Aberto/Fechado** em tempo real (fuso da pizzaria), menu mobile e contador da sacola
- Hero, faixa de sabores, **mais pedidos**, cardápio com **busca sem acento**, categorias e filtros (vegetariano, picante…)
- Produto em modal (bottom sheet no celular): tamanho, **meio a meio** (vale o preço do mais caro), borda, adicionais com limite, quantidade, observações e preço ao vivo
- Sacola: editar item, quantidades, progresso para **entrega grátis**, pedido mínimo, sugestões de bebidas/sobremesas, entrega ou retirada
- Checkout com validação, máscara de telefone, **busca de endereço por CEP** (ViaCEP), troco, e “lembrar meus dados”
- Mensagem completa do pedido enviada ao WhatsApp + tela de confirmação (reabrir WhatsApp / copiar pedido)
- Barra fixa no celular **“🍕 Pedir agora”** (vira “Ver sacola” quando há itens)
- Sobre, processo de produção, avaliações, galeria com lightbox (teclado e swipe), contato com mapa sob demanda, rodapé e páginas de privacidade/termos
- SEO: metadados, Open Graph, JSON-LD `Restaurant` com cardápio, sitemap, robots, manifest
- Acessibilidade: foco visível, modais com foco preso e Esc, rótulos, `prefers-reduced-motion`
- Performance: páginas estáticas, imagens responsivas (AVIF/WebP via CDN), lazy loading, modais carregados sob demanda

## Publicação

- **Vercel / Node:** `npm run build && npm start` (ou importe o repositório na Vercel, com a pasta `pizzaria` como raiz).
- **Hospedagem estática (GitHub Pages, Netlify…):** `npm run build:static`. Os arquivos ficam em `out/`. Em subpasta, defina o caminho:
  `NEXT_PUBLIC_BASE_PATH=/SG/pizzaria npm run build:static`
- Defina `NEXT_PUBLIC_SITE_URL` com o domínio final (veja `.env.example`).
