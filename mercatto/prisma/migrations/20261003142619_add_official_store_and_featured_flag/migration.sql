-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "isOfficialStore" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isActive_isFeatured_idx" ON "Product"("isActive", "isFeatured");

-- CreateIndex
CREATE INDEX "Seller_isOfficialStore_idx" ON "Seller"("isOfficialStore");
