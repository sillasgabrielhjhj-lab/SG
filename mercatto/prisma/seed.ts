/**
 * SEED DA MERCATTO
 *   SEED_MODE=minimal  -> produção: configurações, categorias/atributos, marcas,
 *                         regras de frete, administrador (ADMIN_EMAIL/ADMIN_PASSWORD)
 *                         e loja oficial. Nenhum dado fictício.
 *   SEED_MODE=demo     -> desenvolvimento: minimal + catálogo e histórico DEMO.
 * Idempotente: pode ser executado várias vezes.
 * Executar: npm run db:seed   (usa tsx --conditions=react-server)
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { recomputeProductAggregates } from "../src/features/catalog/aggregates";
import { recomputeStoreRating } from "../src/features/reviews/service";
import { syncPromotionStatuses } from "../src/features/promotions/sync.server";
import { seedReference } from "./seed/reference";
import { DEMO_PASSWORD, assertSafeDemoPassword, seedDemo } from "./seed/demo";

async function ensureAdminAndOfficialStore() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_MODE=minimal exige ADMIN_EMAIL e ADMIN_PASSWORD.");
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("ADMIN_PASSWORD deve ter 10+ caracteres com letras e números.");
  const admin = await db.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { email, name: process.env.ADMIN_NAME?.trim() || "Administrador Mercatto", passwordHash: await hashPassword(password), role: "ADMIN", emailVerifiedAt: new Date() },
  });
  const official = await db.store.findFirst({ where: { isOfficial: true } });
  if (!official) {
    await db.store.create({ data: { ownerId: admin.id, name: "Mercatto", slug: "mercatto", isOfficial: true, status: "ACTIVE", originCep: process.env.OFFICIAL_ORIGIN_CEP ?? "01001000", originState: "SP", description: "Loja oficial Mercatto." } });
  }
}

async function main() {
  const production = process.env.NODE_ENV === "production";
  const mode = process.env.SEED_MODE ?? (production ? "minimal" : "demo");
  if (mode === "demo" && production && process.env.SEED_ALLOW_DEMO_IN_PRODUCTION !== "true") {
    throw new Error("Seed DEMO bloqueado em produção. Use SEED_MODE=minimal.");
  }
  if (mode === "demo") assertSafeDemoPassword(production);
  console.info(`▶ Seed Mercatto (modo: ${mode})`);
  const ref = await seedReference(db);

  let summary: Record<string, unknown> = {};
  if (mode === "minimal") {
    await ensureAdminAndOfficialStore();
  } else {
    summary = await seedDemo(db, ref);
  }

  await syncPromotionStatuses();
  const productIds = (await db.product.findMany({ select: { id: true } })).map((p) => p.id);
  for (let i = 0; i < productIds.length; i += 50) await recomputeProductAggregates(productIds.slice(i, i + 50));
  for (const s of await db.store.findMany({ select: { id: true } })) await recomputeStoreRating(s.id);

  const counts = {
    categorias: await db.category.count(),
    marcas: await db.brand.count(),
    produtos: await db.product.count(),
    variantes: await db.productVariant.count(),
    lojas: await db.store.count(),
    usuarios: await db.user.count(),
    pedidos: await db.order.count(),
    avaliacoes: await db.review.count(),
  };
  console.info("✔ Seed concluído", counts, summary.products ? "" : "");
  if (mode === "demo") {
    console.info(`\nContas DEMO (senha: ${process.env.DEMO_PASSWORD ? "definida em DEMO_PASSWORD" : DEMO_PASSWORD})\n  admin@mercatto.dev (ADMIN — loja oficial)\n  suporte@mercatto.dev (SUPPORT)\n  technova@mercatto.dev (SELLER)\n  cliente@mercatto.dev (CUSTOMER)\n`);
  }
}

main()
  .catch((error) => {
    console.error("✖ Falha no seed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
