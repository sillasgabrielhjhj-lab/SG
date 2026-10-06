-- Variações de catálogo nascem sem preço (rascunho); a aplicação impede vender ou publicar sem preço.
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_price_positive";
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_nonnegative" CHECK ("priceCents" >= 0);
