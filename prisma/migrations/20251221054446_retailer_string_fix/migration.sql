-- AlterTable
ALTER TABLE "Offer" ALTER COLUMN "inStock" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Click_retailer_idx" ON "Click"("retailer");

-- CreateIndex
CREATE INDEX "Offer_retailer_idx" ON "Offer"("retailer");

-- CreateIndex
CREATE INDEX "Offer_updatedAt_idx" ON "Offer"("updatedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_retailer_idx" ON "PriceHistory"("retailer");

-- CreateIndex
CREATE INDEX "PriceHistory_recordedAt_idx" ON "PriceHistory"("recordedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_setIdRef_retailer_recordedAt_idx" ON "PriceHistory"("setIdRef", "retailer", "recordedAt");

-- CreateIndex
CREATE INDEX "Set_setId_idx" ON "Set"("setId");

-- CreateIndex
CREATE INDEX "Set_updatedAt_idx" ON "Set"("updatedAt");
