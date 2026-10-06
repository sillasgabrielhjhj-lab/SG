-- Catálogo versionado, destaques e faixa de preço ("a partir de").
ALTER TABLE "Product" ADD COLUMN "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "maxPriceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "catalogKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "catalogVersion" INTEGER;
CREATE UNIQUE INDEX "Product_catalogKey_key" ON "Product"("catalogKey");
