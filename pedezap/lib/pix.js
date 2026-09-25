'use strict';

// Gera o "PIX Copia e Cola" (BR Code estático, padrão EMV do Banco Central).
// Não depende de banco nem de API: o QR já leva chave, valor e identificador.

const KEY_TYPES = ['cpf', 'cnpj', 'telefone', 'email', 'aleatoria'];

class PixError extends Error {}

function field(id, value) {
  return id + String(value.length).padStart(2, '0') + value;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nome e cidade do recebedor: só ASCII maiúsculo, sem acento.
function plainText(value, max) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function normalizePixKey(type, value) {
  const raw = String(value || '').trim();
  if (!raw) throw new PixError('Informe a chave PIX.');
  const digits = raw.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      if (digits.length !== 11) throw new PixError('CPF deve ter 11 dígitos.');
      return digits;
    case 'cnpj':
      if (digits.length !== 14) throw new PixError('CNPJ deve ter 14 dígitos.');
      return digits;
    case 'telefone':
      if (digits.length === 10 || digits.length === 11) return '+55' + digits;
      if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return '+' + digits;
      throw new PixError('Telefone deve ter DDD + número, ex: (81) 99999-9999.');
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 77) throw new PixError('E-mail da chave PIX inválido.');
      return raw.toLowerCase();
    case 'aleatoria': {
      const key = raw.toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)) {
        throw new PixError('Chave aleatória deve estar no formato 123e4567-e89b-12d3-a456-426614174000.');
      }
      return key;
    }
    default:
      throw new PixError('Tipo de chave PIX inválido.');
  }
}

function buildPixPayload({ key, name, city, amountCents, txid }) {
  if (!key) throw new PixError('Chave PIX não configurada.');
  const merchantName = plainText(name, 25) || 'RECEBEDOR';
  const merchantCity = plainText(city, 15) || 'BRASIL';
  const id = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let payload =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986');
  if (amountCents && amountCents > 0) payload += field('54', (amountCents / 100).toFixed(2));
  payload +=
    field('58', 'BR') +
    field('59', merchantName) +
    field('60', merchantCity) +
    field('62', field('05', id)) +
    '6304';
  return payload + crc16(payload);
}

module.exports = { KEY_TYPES, PixError, crc16, plainText, normalizePixKey, buildPixPayload };
