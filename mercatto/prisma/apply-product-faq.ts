/**
 * Perguntas frequentes escritas pela LOJA (prisma/content/product-faq.json),
 * cadastradas no anúncio como "Pergunta frequente · respondida pela loja" —
 * nunca como se fossem perguntas de clientes.
 *
 * Idempotente: só cria o que ainda não existe (mesmo produto + mesma pergunta);
 * não altera respostas já editadas pelo vendedor no painel nem apaga nada.
 * Produto inexistente é ignorado. Executado no build da Vercel.
 * Uso: tsx --conditions=react-server prisma/apply-product-faq.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "../src/server/db";

type FaqFile = Record<string, { q: string; a: string }[]>;

async function main() {
  const path = process.env.FAQ_CONTENT_PATH ?? new URL("./content/product-faq.json", import.meta.url);
  const content = JSON.parse(readFileSync(path, "utf8")) as FaqFile;
  let created = 0;
  for (const [slug, items] of Object.entries(content)) {
    const product = await db.product.findUnique({ where: { slug }, select: { id: true, storeId: true, store: { select: { ownerId: true } } } });
    if (!product) {
      console.info(`[faq] Produto "${slug}" não encontrado — ignorado.`);
      continue;
    }
    // Criadas de trás para frente: a página lista as mais recentes primeiro, então
    // a ordem exibida fica igual à do arquivo.
    for (const item of [...items].reverse()) {
      const question = item.q.trim();
      const answer = item.a.trim();
      if (!question || !answer) continue;
      const exists = await db.question.findFirst({ where: { productId: product.id, isFaq: true, body: question }, select: { id: true } });
      if (exists) continue;
      await db.question.create({
        data: {
          productId: product.id,
          userId: product.store.ownerId,
          body: question,
          status: "PUBLISHED",
          isFaq: true,
          answer: { create: { storeId: product.storeId, userId: product.store.ownerId, body: answer } },
        },
      });
      created++;
    }
  }
  console.info(`[faq] ${created} pergunta(s) frequente(s) criada(s).`);
}

main()
  .catch((error) => {
    // Conteúdo opcional: falha aqui não deve impedir a publicação do site.
    console.warn("[faq] Não foi possível aplicar as perguntas frequentes:", error instanceof Error ? error.message : error);
  })
  .finally(() => db.$disconnect());
