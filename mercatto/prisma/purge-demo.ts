/**
 * Remove os dados de DEMONSTRAÇÃO para iniciar a operação real, preservando a
 * estrutura (configurações, categorias, atributos, marcas, regras de frete) e
 * a loja oficial, que passa a pertencer ao administrador real (ADMIN_EMAIL).
 *
 * Remove:
 *  - compras de usuários DEMO, compras pagas no gateway de desenvolvimento
 *    (sandbox) e compras que contenham produtos DEMO (pedidos, pagamentos,
 *    reembolsos, envios, eventos);
 *  - produtos, lojas parceiras, usuários, avaliações e perguntas DEMO;
 *  - promoções "[DEMO]", cupons e campanha de exemplo, banners com ilustrações
 *    de demonstração e termos de busca semeados.
 *
 * Nunca remove clientes reais nem pagamentos reais (não sandbox) de produtos
 * reais. Idempotente: rodar de novo não faz nada se não houver dados DEMO.
 * Uso: ADMIN_EMAIL=... tsx --conditions=react-server prisma/purge-demo.ts
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { recomputeProductAggregates } from "../src/features/catalog/aggregates";
import { recomputeStoreRating } from "../src/features/reviews/service";

const DEMO_COUPONS = ["BEMVINDO10", "FRETEGRATIS", "MERCATTO50", "EXPIRADO10", "TECHNOVA15"];
const DEMO_CAMPAIGNS = ["semana-mercatto"];
const DEMO_SEARCH_TERMS = ["iphone", "air fryer", "smart tv", "notebook", "fone bluetooth", "tenis", "playstation 5", "geladeira", "jbl", "galaxy"];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error("Defina ADMIN_EMAIL (administrador real que assumirá a loja oficial).");
  const admin = await db.user.findUnique({ where: { email: adminEmail }, select: { id: true, role: true, isDemo: true } });
  if (!admin || admin.role !== "ADMIN" || admin.isDemo) {
    throw new Error(`O administrador real ${adminEmail} precisa existir antes da limpeza (rode o seed minimal com ADMIN_EMAIL/ADMIN_PASSWORD).`);
  }

  const demoUsers = (await db.user.findMany({ where: { isDemo: true }, select: { id: true } })).map((u) => u.id);
  const official = await db.store.findFirst({ where: { isOfficial: true }, select: { id: true, ownerId: true } });
  const demoStores = (await db.store.findMany({ where: { isDemo: true, isOfficial: false }, select: { id: true } })).map((s) => s.id);
  const demoProducts = (await db.product.findMany({ where: { OR: [{ isDemo: true }, { storeId: { in: demoStores } }] }, select: { id: true } })).map((p) => p.id);

  // Compras a remover: de usuários DEMO, pagas no sandbox, com produtos DEMO ou de lojas DEMO.
  const checkouts = (
    await db.checkout.findMany({
      where: {
        OR: [
          { userId: { in: demoUsers } },
          { payments: { some: { isSandbox: true } } },
          { orders: { some: { OR: [{ storeId: { in: demoStores } }, { items: { some: { productId: { in: demoProducts } } } }] } } },
        ],
      },
      select: { id: true },
    })
  ).map((c) => c.id);

  const summary: Record<string, number> = {};
  const count = (key: string, n: { count: number }) => (summary[key] = (summary[key] ?? 0) + n.count);

  await db.$transaction(
    async (tx) => {
      // 1) Compras (respeitando as FKs Restrict: reembolso → pagamento → pedido → checkout).
      count("reembolsos", await tx.refund.deleteMany({ where: { payment: { checkoutId: { in: checkouts } } } }));
      count("pagamentos", await tx.payment.deleteMany({ where: { checkoutId: { in: checkouts } } }));
      count("pedidos", await tx.order.deleteMany({ where: { checkoutId: { in: checkouts } } }));
      count("checkouts", await tx.checkout.deleteMany({ where: { id: { in: checkouts } } }));

      // 2) Marketing de exemplo.
      count("promocoes", await tx.promotion.deleteMany({ where: { OR: [{ name: { startsWith: "[DEMO]" } }, { storeId: { in: demoStores } }] } }));
      count("cupons", await tx.coupon.deleteMany({ where: { OR: [{ code: { in: DEMO_COUPONS } }, { storeId: { in: demoStores } }] } }));
      count("campanhas", await tx.campaign.deleteMany({ where: { slug: { in: DEMO_CAMPAIGNS } } }));
      count("banners", await tx.banner.deleteMany({ where: { OR: [{ imageUrl: { startsWith: "/demo-assets/" } }, { link: { in: DEMO_CAMPAIGNS.map((s) => `/campanha/${s}`) } }] } }));
      count("termos de busca", await tx.searchTerm.deleteMany({ where: { term: { in: DEMO_SEARCH_TERMS } } }));

      // 3) Conteúdo e catálogo DEMO (produtos levam variações, fotos, estoque, avaliações e perguntas).
      count("avaliacoes", await tx.review.deleteMany({ where: { OR: [{ isDemo: true }, { userId: { in: demoUsers } }] } }));
      count("perguntas", await tx.question.deleteMany({ where: { OR: [{ isDemo: true }, { userId: { in: demoUsers } }] } }));
      count("produtos", await tx.product.deleteMany({ where: { id: { in: demoProducts } } }));

      // 4) Loja oficial passa ao administrador real; lojas e usuários DEMO saem.
      if (official && official.ownerId !== admin.id) {
        await tx.store.update({ where: { id: official.id }, data: { ownerId: admin.id, isDemo: false } });
        summary["loja oficial transferida"] = 1;
      }
      count("lojas", await tx.store.deleteMany({ where: { id: { in: demoStores } } }));
      count("usuarios", await tx.user.deleteMany({ where: { id: { in: demoUsers.filter((id) => id !== admin.id) } } }));
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // 5) Contadores das lojas restantes passam a refletir só pedidos reais.
  for (const s of await db.store.findMany({ select: { id: true } })) {
    const [sales, cancelled] = await Promise.all([
      db.order.count({ where: { storeId: s.id, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
      db.order.count({ where: { storeId: s.id, status: "CANCELLED" } }),
    ]);
    await db.store.update({ where: { id: s.id }, data: { salesCount: sales, cancelledCount: cancelled } });
  }

  // 6) Contatos de exemplo do seed antigo saem do rodapé (preencha os reais no admin).
  const settings = await db.storeSettings.findUnique({ where: { id: "default" } });
  if (settings) {
    const links = (settings.socialLinks as Record<string, string | null> | null) ?? {};
    const placeholder = (v: string | null | undefined) => !v || /^https:\/\/(www\.)?(instagram|facebook|tiktok|youtube)\.com\/?$/i.test(v);
    await db.storeSettings.update({
      where: { id: "default" },
      data: {
        ...(settings.contactEmail === "atendimento@mercatto.com.br" ? { contactEmail: null } : {}),
        ...(settings.contactPhone === "4000-0000" ? { contactPhone: null } : {}),
        ...(settings.whatsapp === "11900000000" ? { whatsapp: null } : {}),
        socialLinks: Object.fromEntries(Object.entries(links).map(([k, v]) => [k, placeholder(v) ? null : v])),
      },
    });
  }

  // 7) Recalcula agregados (estoque, preço efetivo, reputação) do que restou.
  const remaining = (await db.product.findMany({ select: { id: true } })).map((p) => p.id);
  for (let i = 0; i < remaining.length; i += 50) await recomputeProductAggregates(remaining.slice(i, i + 50));
  for (const s of await db.store.findMany({ select: { id: true } })) await recomputeStoreRating(s.id);

  const removed = Object.entries(summary).filter(([, n]) => n > 0);
  console.info(removed.length ? `✔ Dados DEMO removidos: ${removed.map(([k, n]) => `${k}=${n}`).join(", ")}` : "✔ Nenhum dado DEMO encontrado.");
}

main()
  .catch((error) => {
    console.error("✖ Falha na limpeza:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
