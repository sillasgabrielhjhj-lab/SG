'use strict';

const crypto = require('node:crypto');
const { hashPassword } = require('./auth');
const { transaction } = require('./db');

const DEMO_PRODUCTS = [
  ['Lanches', 'X-Burguer', 'Pão brioche, hambúrguer 150g, queijo, alface, tomate e molho da casa.', 2200],
  ['Lanches', 'X-Bacon', 'Hambúrguer 150g, muito bacon crocante, cheddar e cebola caramelizada.', 2790],
  ['Lanches', 'X-Tudo', 'Dois hambúrgueres, ovo, presunto, queijo, bacon, salada e batata palha.', 3490],
  ['Salgados', 'Coxinha de frango', 'Massa crocante com recheio cremoso de frango com catupiry.', 700],
  ['Salgados', 'Cento de salgados', '100 salgados sortidos para festa: coxinha, bolinha de queijo e risole.', 8900],
  ['Porções', 'Batata frita', 'Porção de 400g com cheddar e bacon.', 2400],
  ['Açaí', 'Açaí 500ml', 'Com banana, granola e leite condensado.', 1990],
  ['Bebidas', 'Refrigerante lata', 'Coca-Cola, Guaraná ou Fanta — 350ml.', 600],
  ['Bebidas', 'Suco natural 500ml', 'Laranja, maracujá ou acerola.', 900],
];

// Cria a loja /loja/demo usada na landing page. O WhatsApp e o PIX da demo são
// os do suporte (variáveis de ambiente): quem testa a demo cai direto na sua conversa.
async function seedDemo(db, { supportWhatsapp, billingPix }) {
  if (!db.prepare("SELECT 1 FROM stores WHERE slug = 'demo'").get()) {
    await createDemo(db, supportWhatsapp);
  }
  db.prepare("UPDATE stores SET whatsapp = ?, pix_key = ?, pix_name = ?, pix_city = ? WHERE slug = 'demo'").run(
    supportWhatsapp || '5500000000000',
    billingPix.key,
    billingPix.name,
    billingPix.city
  );
}

async function createDemo(db, supportWhatsapp) {
  const passwordHash = await hashPassword(crypto.randomBytes(24).toString('base64url'));
  const now = Date.now();
  transaction(db, () => {
    const user = db
      .prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('demo@pedezap.invalid', 'Demonstração', passwordHash, now);
    const store = db
      .prepare(
        `INSERT INTO stores (user_id, slug, name, description, whatsapp, color, address, hours,
           delivery_fee_cents, min_order_cents, plan_expires_at, created_at)
         VALUES (?, 'demo', ?, ?, ?, '#e8590c', ?, ?, 500, 1500, ?, ?)`
      )
      .run(
        user.lastInsertRowid,
        'Lanchonete Demonstração',
        'Loja de exemplo: faça um pedido de teste e veja como ele chega no WhatsApp.',
        supportWhatsapp || '5500000000000',
        'Rua do Exemplo, 123 - Recife/PE',
        'Seg a Sáb, 18h às 23h',
        Date.UTC(2100, 0, 1),
        now
      );
    const insert = db.prepare(
      `INSERT INTO products (store_id, category, name, description, price_cents, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    DEMO_PRODUCTS.forEach(([category, name, description, price], i) => {
      insert.run(store.lastInsertRowid, category, name, description, price, i, now);
    });
  });
}

module.exports = { seedDemo };
