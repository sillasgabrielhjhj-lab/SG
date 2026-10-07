-- Dados empresariais exibidos no rodapé e em "Fale conosco" (só quando preenchidos).
ALTER TABLE "StoreSettings" ADD COLUMN "companyLegalName" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "companyDocument" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "supportHours" TEXT;
