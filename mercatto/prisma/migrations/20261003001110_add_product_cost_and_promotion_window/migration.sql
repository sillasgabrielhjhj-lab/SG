-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "promotionEndsAt" TIMESTAMP(3),
ADD COLUMN     "promotionStartsAt" TIMESTAMP(3);
