'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { crc16, normalizePixKey, buildPixPayload, PixError } = require('../lib/pix');

test('CRC16 bate com o exemplo do manual do BR Code (Banco Central)', () => {
  const payload =
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000' +
    '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(payload), '1D3D');
});

test('normaliza os tipos de chave PIX', () => {
  assert.equal(normalizePixKey('telefone', '(81) 99197-6644'), '+5581991976644');
  assert.equal(normalizePixKey('telefone', '5581991976644'), '+5581991976644');
  assert.equal(normalizePixKey('cpf', '123.456.789-09'), '12345678909');
  assert.equal(normalizePixKey('cnpj', '12.345.678/0001-95'), '12345678000195');
  assert.equal(normalizePixKey('email', ' Loja@Email.com '), 'loja@email.com');
  assert.throws(() => normalizePixKey('cpf', '123'), PixError);
  assert.throws(() => normalizePixKey('aleatoria', 'nada'), PixError);
});

test('monta payload com valor, nome sem acento e CRC no final', () => {
  const payload = buildPixPayload({
    key: '+5581991976644',
    name: 'Açaí do João',
    city: 'São Lourenço da Mata',
    amountCents: 4750,
    txid: 'PEDIDO-12',
  });
  assert.ok(payload.startsWith('000201'));
  assert.ok(payload.includes('540547.50'));
  assert.ok(payload.includes('5912ACAI DO JOAO'));
  assert.ok(payload.includes('6015SAO LOURENCO D'));
  assert.ok(payload.includes('0508PEDIDO12'));
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
});
