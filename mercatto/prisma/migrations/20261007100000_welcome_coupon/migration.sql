-- Campanha de boas-vindas configurável (pop-up da home).
ALTER TABLE "StoreSettings" ADD COLUMN "welcomeCouponCode" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "welcomeCouponReshowDays" INTEGER NOT NULL DEFAULT 7;

-- Cupom MERCATTO30 (30% OFF). Nasce INATIVO e sem produtos: só passa a valer
-- depois que a loja escolher os produtos/categorias participantes e ativá-lo
-- no painel (sem produtos escolhidos, o cupom valeria para a loja inteira).
INSERT INTO "Coupon" ("id", "code", "description", "type", "value", "minOrderCents", "usageLimitPerUser", "productIds", "categoryIds", "isActive", "isPublic", "createdAt", "updatedAt")
VALUES ('cpn_welcome_mercatto30', 'MERCATTO30', 'Presente de boas-vindas: 30% OFF em produtos selecionados.', 'PERCENT', 30, 0, 1, ARRAY[]::TEXT[], ARRAY[]::TEXT[], false, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "StoreSettings" ("id", "welcomeCouponCode", "updatedAt")
VALUES ('default', 'MERCATTO30', NOW())
ON CONFLICT ("id") DO UPDATE SET "welcomeCouponCode" = COALESCE("StoreSettings"."welcomeCouponCode", EXCLUDED."welcomeCouponCode");
