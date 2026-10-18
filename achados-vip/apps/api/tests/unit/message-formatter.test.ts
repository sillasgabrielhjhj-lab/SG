import { describe, expect, it } from 'vitest';
import type { MessageInput, OfferKindName } from '../../src/domain/types.js';
import { TELEGRAM_CAPTION_LIMIT, formatMessage, shortenTitle } from '../../src/services/message-formatter.js';

const DISCLOSURE = 'Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado.';
const URL_OK = 'https://meli.la/2abcDEF';

const base = (over: Partial<MessageInput> = {}): MessageInput => ({
  title: 'Fone de Ouvido Bluetooth JBL Tune 510BT',
  priceCents: 24990,
  originalPriceCents: 39990,
  discountPct: 38,
  affiliateUrl: URL_OK,
  kind: 'COMMON',
  disclosure: DISCLOSURE,
  ...over,
});

describe('formatMessage: exemplo do pedido (snapshot)', () => {
  it('WhatsApp', () => {
    expect(formatMessage(base(), 'whatsapp')).toBe(
      [
        '🔥 *OFERTA DO DIA!*',
        'Fone de Ouvido Bluetooth JBL Tune 510BT',
        '',
        'De: ~R$ 399,90~',
        'Por: *R$ 249,90*',
        '✅ 38% OFF',
        '',
        '🛒 Comprar com desconto:',
        'https://meli.la/2abcDEF',
        '',
        '_Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado._',
      ].join('\n'),
    );
  });
  it('Telegram HTML', () => {
    expect(formatMessage(base(), 'telegram_html')).toBe(
      [
        '🔥 <b>OFERTA DO DIA!</b>',
        'Fone de Ouvido Bluetooth JBL Tune 510BT',
        '',
        'De: <s>R$ 399,90</s>',
        'Por: <b>R$ 249,90</b>',
        '✅ 38% OFF',
        '',
        '🛒 Comprar com desconto:',
        'https://meli.la/2abcDEF',
        '',
        '<i>Oferta sujeita à disponibilidade e alteração de preço. Link de afiliado.</i>',
      ].join('\n'),
    );
  });
  it('texto simples', () => {
    expect(formatMessage(base(), 'plain')).toBe(
      ['🔥 OFERTA DO DIA!', 'Fone de Ouvido Bluetooth JBL Tune 510BT', '', 'De: R$ 399,90', 'Por: R$ 249,90', '✅ 38% OFF', '', '🛒 Comprar com desconto:', 'https://meli.la/2abcDEF', '', DISCLOSURE].join('\n'),
    );
  });
});

describe('formatMessage: os 6 modelos', () => {
  const headers: Record<OfferKindName, string> = {
    COMMON: 'OFERTA DO DIA!',
    FLASH: 'OFERTA RELÂMPAGO!',
    TOP_DISCOUNT_OF_DAY: 'MAIOR DESCONTO DO DIA!',
    EXCEPTIONAL_PRICE: 'PREÇO EXCEPCIONAL!',
    POPULAR: 'MUITO PROCURADO!',
    COUPON: 'CUPOM DISPONÍVEL!',
  };
  const full = (kind: OfferKindName) => base({ kind, soldQuantity: 1234, couponCode: 'ACHADOS10' });

  for (const kind of Object.keys(headers) as OfferKindName[]) {
    it(`${kind}: cabeçalho próprio, preço, link e rodapé`, () => {
      const msg = formatMessage(full(kind), 'plain');
      expect(msg.split('\n')[0]).toContain(headers[kind]);
      expect(msg).toContain('Por: R$ 249,90');
      expect(msg).toContain(URL_OK);
      expect(msg.trimEnd().endsWith(DISCLOSURE)).toBe(true);
    });
  }
  it('os 6 cabeçalhos são distintos', () => {
    const set = new Set((Object.keys(headers) as OfferKindName[]).map((k) => formatMessage(full(k), 'plain').split('\n')[0]));
    expect(set.size).toBe(6);
  });
  it('POPULAR mostra vendidos reais com milhar', () => {
    expect(formatMessage(full('POPULAR'), 'plain')).toContain('📦 1.234 vendidos');
    expect(formatMessage(full('COMMON'), 'plain')).not.toContain('vendidos');
  });
  it('POPULAR sem soldQuantity real cai para o modelo comum (sem alegar popularidade)', () => {
    for (const sold of [null, undefined, 0, -3]) {
      const msg = formatMessage(base({ kind: 'POPULAR', soldQuantity: sold }), 'plain');
      expect(msg).toContain('OFERTA DO DIA!');
      expect(msg).not.toContain('PROCURADO');
      expect(msg).not.toContain('vendidos');
    }
  });
  it('COUPON mostra o código; sem cupom informado cai para comum', () => {
    expect(formatMessage(base({ kind: 'COUPON', couponCode: 'ACHADOS10' }), 'plain')).toContain('🎟️ Cupom: ACHADOS10');
    const semCupom = formatMessage(base({ kind: 'COUPON', couponCode: '  ', couponDiscountCents: null }), 'plain');
    expect(semCupom).toContain('OFERTA DO DIA!');
    expect(semCupom).not.toContain('Cupom');
  });
  it('COUPON só com valor de desconto (sem código)', () => {
    const msg = formatMessage(base({ kind: 'COUPON', couponCode: null, couponDiscountCents: 2000 }), 'plain');
    expect(msg).toContain('CUPOM DISPONÍVEL!');
    expect(msg).toContain('💸 Cupom de R$ 20,00 de desconto');
    expect(msg).not.toContain('Cupom:');
  });
  it('cupom informado aparece mesmo em outros modelos; código em monoespaçado/code', () => {
    expect(formatMessage(base({ couponCode: 'X_Y' }), 'whatsapp')).toContain('🎟️ Cupom: ```X_Y```');
    expect(formatMessage(base({ couponCode: 'X<Y' }), 'telegram_html')).toContain('🎟️ Cupom: <code>X&lt;Y</code>');
  });
  it('TOP_DISCOUNT_OF_DAY sem desconto verificado cai para comum', () => {
    const msg = formatMessage(base({ kind: 'TOP_DISCOUNT_OF_DAY', originalPriceCents: null, discountPct: null }), 'plain');
    expect(msg).toContain('OFERTA DO DIA!');
    expect(msg).not.toContain('MAIOR DESCONTO');
  });
  it('kind desconhecido em runtime cai para comum', () => {
    expect(formatMessage(base({ kind: 'XYZ' as OfferKindName }), 'plain')).toContain('OFERTA DO DIA!');
  });
});

describe('formatMessage: honestidade de preço', () => {
  it('sem original => sem "De", "Por" nem "% OFF"; rótulo neutro', () => {
    const msg = formatMessage(base({ originalPriceCents: null, discountPct: null }), 'whatsapp');
    expect(msg).not.toMatch(/De:|Por:|OFF|~/);
    expect(msg).toContain('Preço: *R$ 249,90*');
    expect(msg).toContain('🛒 Ver a oferta:');
    expect(msg).not.toContain('com desconto');
  });
  it('original sem discountPct (ou vice-versa) => não mostra De/OFF', () => {
    expect(formatMessage(base({ discountPct: null }), 'plain')).not.toMatch(/De:|OFF/);
    expect(formatMessage(base({ discountPct: undefined }), 'plain')).not.toMatch(/De:|OFF/);
    expect(formatMessage(base({ originalPriceCents: undefined }), 'plain')).not.toMatch(/De:|OFF/);
  });
  it('original <= preço, zero ou desconto < 1% => não mostra De/OFF', () => {
    expect(formatMessage(base({ originalPriceCents: 24990, discountPct: 0 }), 'plain')).not.toMatch(/De:|OFF/);
    expect(formatMessage(base({ originalPriceCents: 20000, discountPct: 10 }), 'plain')).not.toMatch(/De:|OFF/);
    expect(formatMessage(base({ originalPriceCents: 0, discountPct: 10 }), 'plain')).not.toMatch(/De:|OFF/);
  });
  it('discountPct incoerente com original/preço é descartado (evita % errado)', () => {
    expect(formatMessage(base({ discountPct: 70 }), 'plain')).not.toMatch(/De:|OFF/);
  });
  it('tolera diferença de 1 ponto de arredondamento', () => {
    expect(formatMessage(base({ discountPct: 37 }), 'plain')).toContain('✅ 37% OFF');
  });
  it('preço em milhares', () => {
    expect(formatMessage(base({ priceCents: 129990, originalPriceCents: 199990, discountPct: 35 }), 'plain')).toContain('Por: R$ 1.299,90');
  });
  it('parcelamento só se informado', () => {
    expect(formatMessage(base(), 'plain')).not.toContain('💳');
    expect(formatMessage(base({ installments: { quantity: 10, amountCents: 2499, interestFree: true } }), 'plain')).toContain('💳 ou 10x de R$ 24,99 sem juros');
    expect(formatMessage(base({ installments: { quantity: 6, amountCents: 4500, interestFree: false } }), 'plain')).toContain('💳 ou 6x de R$ 45,00 (com juros)');
  });
  it('parcelamento inválido (1x, zero, fracionado) é ignorado', () => {
    for (const installments of [
      { quantity: 1, amountCents: 24990, interestFree: true },
      { quantity: 0, amountCents: 100, interestFree: true },
      { quantity: 3, amountCents: 0, interestFree: true },
      { quantity: 2.5, amountCents: 100, interestFree: true },
    ]) {
      expect(formatMessage(base({ installments }), 'plain')).not.toContain('💳');
    }
  });
  it('sem cupom informado, nenhuma linha de cupom', () => {
    expect(formatMessage(base(), 'plain')).not.toMatch(/Cupom|🎟️|💸/);
  });
});

describe('formatMessage: link obrigatório', () => {
  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['http', 'http://meli.la/abc'],
    ['sem esquema', 'meli.la/abc'],
    ['esquema perigoso', 'javascript:alert(1)'],
    ['credenciais', 'https://user:pw@meli.la/abc'],
    ['com espaço', 'https://meli.la/a b'],
    ['com quebra de linha', 'https://meli.la/a\nb'],
  ])('lança erro: %s', (_n, affiliateUrl) => {
    for (const f of ['whatsapp', 'telegram_html', 'plain'] as const) expect(() => formatMessage(base({ affiliateUrl }), f)).toThrow(/affiliateUrl/);
  });
  it('affiliateUrl ausente em runtime', () => {
    expect(() => formatMessage(base({ affiliateUrl: undefined as unknown as string }), 'plain')).toThrow(/obrigatório/);
  });
  it('preço inválido ou título vazio lançam erro', () => {
    expect(() => formatMessage(base({ priceCents: 0 }), 'plain')).toThrow(/priceCents/);
    expect(() => formatMessage(base({ priceCents: Number.NaN }), 'plain')).toThrow(/priceCents/);
    expect(() => formatMessage(base({ title: '   ' }), 'plain')).toThrow(/title/);
  });
  it('preserva a URL exatamente (underscores, ~, parâmetros e & de rastreio)', () => {
    const url = 'https://meli.la/2a_b~c?matt_tool=1&matt_word=x_y';
    expect(formatMessage(base({ affiliateUrl: url }), 'whatsapp')).toContain(`\n${url}\n`);
    expect(formatMessage(base({ affiliateUrl: url }), 'plain')).toContain(`\n${url}\n`);
    expect(formatMessage(base({ affiliateUrl: url }), 'telegram_html')).toContain('https://meli.la/2a_b~c?matt_tool=1&amp;matt_word=x_y');
  });
});

describe('formatMessage: escape e formatação segura', () => {
  it('Telegram escapa HTML em título, rodapé e cupom', () => {
    const msg = formatMessage(base({ title: 'Fone <b>X</b> & "Y" > Z', disclosure: 'a<b & c>d', couponCode: 'A&B' }), 'telegram_html');
    expect(msg).toContain('Fone &lt;b&gt;X&lt;/b&gt; &amp; "Y" &gt; Z');
    expect(msg).toContain('<i>a&lt;b &amp; c&gt;d</i>');
    expect(msg).toContain('<code>A&amp;B</code>');
    expect(msg.replace(/<\/?(b|s|i|code)>/g, '')).not.toMatch(/<|>(?!$)/);
  });
  it('WhatsApp remove marcadores *_~` do título/rodapé para não quebrar nem forjar estilos', () => {
    const msg = formatMessage(base({ title: '*Fone* _JBL_ ~barato~ `x`', disclosure: 'Oferta *sujeita* a _mudança_' }), 'whatsapp');
    const lines = msg.split('\n');
    expect(lines[1]).toBe('Fone JBL barato x');
    expect(lines[lines.length - 1]).toBe('_Oferta sujeita a mudança_');
  });
  it('Telegram e texto simples não removem *_~ do título', () => {
    expect(formatMessage(base({ title: 'Cabo USB_C 2*m' }), 'plain')).toContain('Cabo USB_C 2*m');
    expect(formatMessage(base({ title: 'Cabo USB_C 2*m' }), 'telegram_html')).toContain('Cabo USB_C 2*m');
  });
  it('rodapé vazio é omitido (sem linha em branco sobrando)', () => {
    const msg = formatMessage(base({ disclosure: '   ' }), 'plain');
    expect(msg.endsWith(URL_OK)).toBe(true);
  });
  it('não vaza nada além dos campos recebidos', () => {
    expect(formatMessage(base(), 'plain')).not.toMatch(/undefined|null|NaN/);
  });
});

describe('shortenTitle', () => {
  it('título normal passa intacto', () => {
    expect(shortenTitle('Fone JBL Tune 510BT')).toBe('Fone JBL Tune 510BT');
  });
  it('limita a 80 caracteres cortando em palavra e usando reticências', () => {
    const t = shortenTitle('Smartphone Samsung Galaxy A54 5G 128GB 8GB RAM Tela 6.4 Câmera Tripla 50MP Preto Grafite Edição Especial');
    expect([...t].length).toBeLessThanOrEqual(80);
    expect(t.endsWith('…')).toBe(true);
    expect(t).not.toMatch(/\s…$/);
    expect(t.startsWith('Smartphone Samsung Galaxy A54')).toBe(true);
  });
  it('palavra única gigante é cortada em 80', () => {
    const t = shortenTitle('x'.repeat(200));
    expect([...t].length).toBe(80);
  });
  it('respeita o limite customizado', () => {
    expect([...shortenTitle('um dois tres quatro cinco seis', 15)].length).toBeLessThanOrEqual(15);
  });
  it('CAIXA ALTA excessiva vira caixa normal preservando siglas e números', () => {
    expect(shortenTitle('SMARTPHONE SAMSUNG GALAXY A54 5G 128GB COM CARREGADOR')).toBe('Smartphone Samsung Galaxy A54 5G 128GB com Carregador');
    expect(shortenTitle('MONITOR GAMER LG 27 POLEGADAS USB HDMI')).toBe('Monitor Gamer LG 27 Polegadas USB HDMI');
  });
  it('título misto (marcas em caixa alta) não é alterado', () => {
    expect(shortenTitle('Fone JBL Tune 510BT com Microfone USB')).toBe('Fone JBL Tune 510BT com Microfone USB');
  });
  it('títulos curtos em caixa alta (<10 letras) são preservados', () => {
    expect(shortenTitle('CABO USB')).toBe('CABO USB');
  });
  it('remove caracteres de controle e colapsa espaços', () => {
    expect(shortenTitle(`  Fone\n\tJBL${String.fromCharCode(0x200b)}   Tune  `)).toBe('Fone JBL Tune');
  });
  it('não corta emoji no meio (pares substitutos)', () => {
    const t = shortenTitle('😀'.repeat(100));
    expect([...t].length).toBeLessThanOrEqual(80);
    expect(t.endsWith('…')).toBe(true);
    expect(t).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
  });
  it('formatMessage aplica o resumo de título', () => {
    const msg = formatMessage(base({ title: 'A'.repeat(300) }), 'plain');
    expect([...msg.split('\n')[1]!].length).toBeLessThanOrEqual(80);
  });
});

describe('Telegram: limite de 1024 caracteres (legenda de foto)', () => {
  const visible = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  it('mensagem normal fica bem abaixo do limite', () => {
    expect(visible(formatMessage(base(), 'telegram_html')).length).toBeLessThan(TELEGRAM_CAPTION_LIMIT);
  });
  it('rodapé gigante é truncado para caber, mantendo link e preço', () => {
    const msg = formatMessage(base({ disclosure: 'aviso '.repeat(400) }), 'telegram_html');
    expect(visible(msg).length).toBeLessThanOrEqual(TELEGRAM_CAPTION_LIMIT);
    expect(msg).toContain(URL_OK);
    expect(msg).toContain('<b>R$ 249,90</b>');
    expect(msg).toContain('…</i>');
  });
  it('rodapé gigante em WhatsApp não é truncado (sem limite de legenda)', () => {
    const msg = formatMessage(base({ disclosure: 'aviso '.repeat(400) }), 'whatsapp');
    expect(msg.length).toBeGreaterThan(TELEGRAM_CAPTION_LIMIT);
  });
  it('conta o tamanho visível (entidades não inflam)', () => {
    const msg = formatMessage(base({ disclosure: '&'.repeat(900) }), 'telegram_html');
    expect(visible(msg).length).toBeLessThanOrEqual(TELEGRAM_CAPTION_LIMIT);
    expect(msg.length).toBeGreaterThan(TELEGRAM_CAPTION_LIMIT); // o HTML cru passa; o que vale é o texto visível
  });
});
