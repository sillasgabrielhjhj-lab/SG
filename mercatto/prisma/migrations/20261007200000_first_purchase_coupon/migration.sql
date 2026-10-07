-- Nova campanha oficial: 25% OFF na PRIMEIRA COMPRA (MERCATTO25), válida nas
-- categorias dos banners (TV e Áudio, Eletrodomésticos e Celulares, com as
-- subcategorias). 1 uso por cliente; sem valor mínimo nem teto de desconto —
-- ajustáveis no painel (Admin → Cupons). Se nenhuma dessas categorias
-- existir, nasce INATIVO: sem categorias o cupom valeria para a loja toda.
WITH cats AS (
  SELECT COALESCE(array_agg("id"), ARRAY[]::TEXT[]) AS ids
  FROM "Category"
  WHERE "slug" IN ('tv-e-audio', 'eletrodomesticos', 'celulares')
)
INSERT INTO "Coupon" ("id", "code", "description", "type", "value", "minOrderCents", "usageLimitPerUser", "firstPurchaseOnly", "productIds", "categoryIds", "isActive", "isPublic", "createdAt", "updatedAt")
SELECT 'cpn_welcome_mercatto25', 'MERCATTO25', 'Primeira compra: 25% OFF em TV e áudio, eletrodomésticos e celulares.', 'PERCENT', 25, 0, 1, true, ARRAY[]::TEXT[], cats.ids, cardinality(cats.ids) > 0, true, NOW(), NOW()
FROM cats
ON CONFLICT ("code") DO NOTHING;

-- A campanha de boas-vindas (pop-up, aba e banners) passa a ser a MERCATTO25.
UPDATE "StoreSettings" SET "welcomeCouponCode" = 'MERCATTO25', "updatedAt" = NOW()
WHERE "welcomeCouponCode" IS NULL OR "welcomeCouponCode" = 'MERCATTO30';
INSERT INTO "StoreSettings" ("id", "welcomeCouponCode", "updatedAt")
VALUES ('default', 'MERCATTO25', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Campanha anterior (30% OFF) encerrada.
UPDATE "Coupon" SET "isActive" = false, "updatedAt" = NOW() WHERE "code" = 'MERCATTO30';
