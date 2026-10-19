import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/domain/settings.js';
import { buildQuickPost, checkQuickUrl, decodeEntities, parseProductHtml, toCents } from '../../src/services/quick-post.js';

const settings = defaultSettings();
const LINK = 'https://meli.la/2aBcDeF';

describe('toCents', () => {
  it('aceita número, "199.9" e pt-BR', () => {
    expect(toCents(199.9)).toBe(19990);
    expect(toCents('199.9')).toBe(19990);
    expect(toCents('1.299,90')).toBe(129990);
    expect(toCents('R$ 49,90')).toBe(4990);
  });
  it('recusa zero, negativo e lixo', () => {
    for (const v of [0, -5, 'abc', '', null, undefined, NaN]) expect(toCents(v)).toBeNull();
  });
});

describe('parseProductHtml', () => {
  it('lê JSON-LD Product (nome, imagem, preço BRL)', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Fone Bluetooth TWS | Mercado Livre',
      image: ['https://http2.mlstatic.com/D_NQ_NP_123-F.webp'],
      offers: { '@type': 'Offer', price: 49.9, priceCurrency: 'BRL' },
    })}</script>`;
    expect(parseProductHtml(html)).toEqual({ title: 'Fone Bluetooth TWS', imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_123-F.webp', priceCents: 4990 });
  });
  it('acha o Product dentro de @graph', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, { '@type': 'Product', name: 'Cafeteira', offers: [{ price: '199.90', priceCurrency: 'BRL' }] }] })}</script>`;
    expect(parseProductHtml(html).priceCents).toBe(19990);
  });
  it('sem JSON-LD usa og:title/og:image (qualquer ordem de atributos) e decodifica entidades', () => {
    const html = `<head><meta content="Caixa &amp; Som &#39;Pro&#39; - Mercado Livre" property="og:title"><meta property="og:image" content="https://http2.mlstatic.com/a.jpg"></head>`;
    expect(parseProductHtml(html)).toEqual({ title: "Caixa & Som 'Pro'", imageUrl: 'https://http2.mlstatic.com/a.jpg', priceCents: null });
  });
  it('preço em outra moeda é ignorado; imagem não-https é ignorada', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'X', image: 'http://insecure.example/x.jpg', offers: { price: 10, priceCurrency: 'USD' } })}</script>`;
    expect(parseProductHtml(html)).toEqual({ title: 'X', imageUrl: null, priceCents: null });
  });
  it('JSON-LD inválido não quebra e página vazia devolve tudo null', () => {
    expect(parseProductHtml('<script type="application/ld+json">{quebrado</script>')).toEqual({ title: null, imageUrl: null, priceCents: null });
    expect(parseProductHtml('')).toEqual({ title: null, imageUrl: null, priceCents: null });
  });
  it('decodeEntities ignora entidade desconhecida', () => {
    expect(decodeEntities('a &nada; b &amp; &#x41;')).toBe('a &nada; b & A');
  });
});

describe('buildQuickPost', () => {
  it('sem preço original: só preço atual, sem De/Por nem %OFF, link intacto e rodapé de afiliado', () => {
    const r = buildQuickPost({ url: LINK, title: 'Fone Bluetooth TWS', priceCents: 4990 }, settings);
    expect(r.whatsapp).toContain('R$ 49,90');
    expect(r.whatsapp).not.toMatch(/De:|OFF/);
    expect(r.whatsapp).toContain(LINK);
    expect(r.whatsapp).toContain('Link de afiliado');
    expect(r.discountPct).toBeNull();
  });
  it('com preço original maior: De/Por e % calculado, com aviso de que o dado é do admin', () => {
    const r = buildQuickPost({ url: LINK, title: 'Fone Bluetooth TWS', priceCents: 4990, originalPriceCents: 9990 }, settings);
    expect(r.whatsapp).toContain('~R$ 99,90~');
    expect(r.whatsapp).toContain('50% OFF');
    expect(r.discountPct).toBe(50);
    expect(r.warnings.join(' ')).toContain('VOCÊ informou');
  });
  it('original <= atual: ignora e avisa', () => {
    const r = buildQuickPost({ url: LINK, title: 'X Y Z produto', priceCents: 5000, originalPriceCents: 5000 }, settings);
    expect(r.whatsapp).not.toMatch(/De:|OFF/);
    expect(r.warnings[0]).toContain('não é maior');
  });
  it('cupom usa o modelo de cupom; versão Telegram escapa HTML', () => {
    const r = buildQuickPost({ url: LINK, title: 'Tênis <Run> & Cia', priceCents: 15990, couponCode: 'ACHADOS10' }, settings);
    expect(r.whatsapp).toContain('ACHADOS10');
    expect(r.telegram).toContain('&lt;Run&gt;');
    expect(r.telegram).toContain('&amp;');
  });
});

describe('checkQuickUrl', () => {
  it('aceita hosts do ML/meli.la e recusa outros, http e credenciais', () => {
    expect(checkQuickUrl(LINK, settings)).toBeNull();
    expect(checkQuickUrl('https://mercadolivre.com/sec/abc', settings)).toBeNull();
    expect(checkQuickUrl('https://evil.example.com/x', settings)).not.toBeNull();
    expect(checkQuickUrl('http://meli.la/x', settings)).not.toBeNull();
    expect(checkQuickUrl('https://user:pass@meli.la/x', settings)).not.toBeNull();
  });
});
