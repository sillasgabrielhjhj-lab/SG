/**
 * Formatação das mensagens de oferta (pura). 6 modelos, um por OfferKindName.
 * Honestidade: "De"/"%OFF" só com originalPriceCents + discountPct coerentes; parcelamento, cupom e vendidos só se informados.
 * Lança erro se affiliateUrl for vazio/inválido/não-https (nunca publicar sem link de afiliado validado).
 */
import { calcDiscountPct, formatBRL } from '../domain/pricing.js';
import type { MessageFormat, MessageInput, OfferKindName } from '../domain/types.js';

export const TITLE_MAX = 80;
export const TELEGRAM_CAPTION_LIMIT = 1024;

const HEADERS: Record<OfferKindName, { emoji: string; text: string }> = {
  COMMON: { emoji: '🔥', text: 'OFERTA DO DIA!' },
  FLASH: { emoji: '⚡', text: 'OFERTA RELÂMPAGO!' },
  TOP_DISCOUNT_OF_DAY: { emoji: '🏆', text: 'MAIOR DESCONTO DO DIA!' },
  EXCEPTIONAL_PRICE: { emoji: '💎', text: 'PREÇO EXCEPCIONAL!' },
  POPULAR: { emoji: '⭐', text: 'MUITO PROCURADO!' },
  COUPON: { emoji: '🎟️', text: 'CUPOM DISPONÍVEL!' },
};

// ---------- título ----------

const LOWER_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'em', 'no', 'na', 'a', 'o', 'ou', 'por']);
const KEEP_UPPER = new Set(['HDMI', 'NVME', 'OLED', 'QLED', 'AMOLED', 'LCD', 'GPS', 'USB', 'RGB', 'WIFI']);

/** Título em CAIXA ALTA (>70% das letras) vira "Caixa Normal", preservando siglas curtas e palavras com número. */
function softenCaps(t: string): string {
  const letters = t.match(/\p{L}/gu) ?? [];
  const upper = t.match(/\p{Lu}/gu) ?? [];
  if (letters.length < 10 || upper.length / letters.length <= 0.7) return t;
  return t
    .split(' ')
    .map((w, i) => {
      if (/\d/.test(w) || w.length <= 3 || KEEP_UPPER.has(w)) return LOWER_WORDS.has(w.toLowerCase()) && i > 0 ? w.toLowerCase() : w;
      const lower = w.toLowerCase();
      if (LOWER_WORDS.has(lower) && i > 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** Título curto (<= max caracteres), sem caracteres de controle e sem CAIXA ALTA excessiva. Corta em palavra com "…". */
export function shortenTitle(raw: string, max = TITLE_MAX): string {
  const clean = softenCaps(
    (raw ?? '')
      .replace(/\p{Cf}/gu, '') // invisíveis (zero-width etc.)
      .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  const chars = [...clean];
  if (chars.length <= max) return clean;
  let cut = chars.slice(0, max - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.5) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s,;:.\-–/]+$/u, '') + '…';
}

// ---------- estilos por formato ----------

interface Style {
  text(s: string): string;
  /** URL: nunca remove marcadores (underscores/til são válidos em links); só escapa HTML no Telegram. */
  url(s: string): string;
  bold(s: string): string;
  strike(s: string): string;
  italic(s: string): string;
  code(s: string): string;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** WhatsApp não tem escape: remove marcadores de formatação do texto dinâmico para não quebrar/forjar estilos. */
const stripWaMarkup = (s: string) => s.replace(/[*_~`]/g, '');

function styleFor(format: MessageFormat): Style {
  switch (format) {
    case 'whatsapp':
      return {
        text: stripWaMarkup,
        url: (s) => s,
        bold: (s) => `*${stripWaMarkup(s)}*`,
        strike: (s) => `~${stripWaMarkup(s)}~`,
        italic: (s) => `_${stripWaMarkup(s)}_`,
        code: (s) => '```' + s.replace(/`/g, '') + '```',
      };
    case 'telegram_html':
      return {
        text: escapeHtml,
        url: escapeHtml,
        bold: (s) => `<b>${escapeHtml(s)}</b>`,
        strike: (s) => `<s>${escapeHtml(s)}</s>`,
        italic: (s) => `<i>${escapeHtml(s)}</i>`,
        code: (s) => `<code>${escapeHtml(s)}</code>`,
      };
    default:
      return { text: (s) => s, url: (s) => s, bold: (s) => s, strike: (s) => s, italic: (s) => s, code: (s) => s };
  }
}

// ---------- validações ----------

function assertAffiliateUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) throw new Error('affiliateUrl é obrigatório: não é possível formatar mensagem sem link de afiliado');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('affiliateUrl inválido');
  }
  if (u.protocol !== 'https:') throw new Error('affiliateUrl precisa usar https');
  if (u.username || u.password) throw new Error('affiliateUrl não pode conter credenciais');
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) throw new Error('affiliateUrl contém espaços ou caracteres de controle');
  return raw;
}

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const groupThousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** De/OFF só quando original e discountPct existem e são coerentes entre si (±1 ponto) com o preço atual. */
function verifiedPair(i: MessageInput): { original: number; pct: number } | null {
  const { originalPriceCents: original, discountPct: pct, priceCents: price } = i;
  if (!isPositive(original) || typeof pct !== 'number' || !Number.isFinite(pct) || pct < 1) return null;
  const real = calcDiscountPct(original, price);
  if (real === null || Math.abs(real - pct) > 1) return null;
  return { original, pct: Math.round(pct) };
}

/** Modelo efetivo: se faltar o dado que sustenta o modelo, cai para COMMON (nunca afirma sem dado). */
function effectiveKind(i: MessageInput, pair: unknown, couponCode: string | null): OfferKindName {
  if (i.kind === 'POPULAR' && !isPositive(i.soldQuantity)) return 'COMMON';
  if (i.kind === 'COUPON' && !couponCode && !isPositive(i.couponDiscountCents)) return 'COMMON';
  if (i.kind === 'TOP_DISCOUNT_OF_DAY' && !pair) return 'COMMON';
  return i.kind in HEADERS ? i.kind : 'COMMON';
}

// ---------- montagem ----------

function render(i: MessageInput, format: MessageFormat, url: string, titleMax: number, disclosure: string): string {
  const st = styleFor(format);
  const pair = verifiedPair(i);
  const couponCode = i.couponCode?.trim().slice(0, 40) || null;
  const kind = effectiveKind(i, pair, couponCode);
  const head = HEADERS[kind];
  const lines: string[] = [`${head.emoji} ${st.bold(head.text)}`, st.text(shortenTitle(i.title, titleMax)), ''];

  if (pair) {
    lines.push(`De: ${st.strike(formatBRL(pair.original))}`, `Por: ${st.bold(formatBRL(i.priceCents))}`, `✅ ${pair.pct}% OFF`);
  } else {
    lines.push(`Preço: ${st.bold(formatBRL(i.priceCents))}`);
  }

  const inst = i.installments;
  if (inst && Number.isInteger(inst.quantity) && inst.quantity >= 2 && isPositive(inst.amountCents)) {
    lines.push(`💳 ou ${inst.quantity}x de ${formatBRL(inst.amountCents)}${inst.interestFree ? ' sem juros' : ' (com juros)'}`);
  }
  if (couponCode) lines.push(`🎟️ Cupom: ${st.code(couponCode)}`);
  if (isPositive(i.couponDiscountCents)) lines.push(`💸 Cupom de ${formatBRL(i.couponDiscountCents)} de desconto`);
  if (kind === 'POPULAR' && isPositive(i.soldQuantity)) lines.push(`📦 ${groupThousands(i.soldQuantity)} vendidos`);

  lines.push('', pair ? '🛒 Comprar com desconto:' : '🛒 Ver a oferta:', st.url(url));
  if (disclosure) lines.push('', st.italic(disclosure));
  return lines.join('\n');
}

/**
 * Formata a mensagem para o canal. Lança Error se affiliateUrl ausente/inválido/não-https ou preço inválido.
 * Telegram (legenda de foto): reduz o título e, em último caso, o rodapé para caber em 1024 caracteres visíveis.
 */
export function formatMessage(input: MessageInput, format: MessageFormat): string {
  const url = assertAffiliateUrl(input.affiliateUrl);
  if (!isPositive(input.priceCents)) throw new Error('priceCents inválido');
  if (!input.title?.trim()) throw new Error('title é obrigatório');

  const disclosure = (input.disclosure ?? '').replace(/\s+/g, ' ').trim();
  if (format !== 'telegram_html') return render(input, format, url, TITLE_MAX, disclosure);

  const visibleLength = (titleMax: number, d: string) => render(input, 'plain', url, titleMax, d).length;
  let titleMax = TITLE_MAX;
  while (titleMax > 20 && visibleLength(titleMax, disclosure) > TELEGRAM_CAPTION_LIMIT) titleMax -= 20;
  let d = disclosure;
  const over = visibleLength(titleMax, d) - TELEGRAM_CAPTION_LIMIT;
  if (over > 0) d = over >= d.length ? '' : [...d].slice(0, d.length - over - 1).join('').trimEnd() + '…';
  return render(input, format, url, titleMax, d);
}
