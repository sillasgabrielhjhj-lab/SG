'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function money(cents) {
  return brl.format((cents || 0) / 100).replace(/ /g, ' ');
}

function text(value, { max, label, required = false }) {
  const out = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !out) throw bad(`Informe ${label}.`);
  if (out.length > max) throw bad(`${capitalize(label)} pode ter no máximo ${max} caracteres.`);
  return out;
}

function cents(value, { label, min = 0, max = 10_000_000 }) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`Valor inválido em ${label}.`);
  return n;
}

function flag(value) {
  return value ? 1 : 0;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// WhatsApp sempre salvo como 55 + DDD + número (formato do wa.me).
function normalizeWhatsapp(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  throw bad('WhatsApp inválido. Use DDD + número, ex: (81) 99999-9999.');
}

function formatPhone(digits) {
  const d = String(digits || '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'painel', 'entrar', 'cadastro', 'sair', 'loja', 'static', 'img', 'suporte',
  'ajuda', 'termos', 'privacidade', 'blog', 'www', 'pedezap', 'healthz', 'qr', 'demo',
]);

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function validateSlug(value) {
  const slug = slugify(value);
  if (slug.length < 3) throw bad('O endereço da loja precisa ter pelo menos 3 letras ou números.');
  if (RESERVED_SLUGS.has(slug)) throw bad('Esse endereço é reservado. Escolha outro.');
  return slug;
}

function validateEmail(value) {
  const email = text(value, { max: 120, label: 'o e-mail', required: true }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('E-mail inválido.');
  return email;
}

function validateColor(value) {
  const color = String(value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw bad('Cor inválida.');
  return color.toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  HttpError,
  bad,
  money,
  text,
  cents,
  flag,
  normalizeWhatsapp,
  formatPhone,
  slugify,
  validateSlug,
  validateEmail,
  validateColor,
  escapeHtml,
};
