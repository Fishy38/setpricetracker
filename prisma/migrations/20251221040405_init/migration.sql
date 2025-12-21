-- CreateEnum
CREATE TYPE "Retailer" AS ENUM ('LEGO', 'Amazon', 'Walmart', 'Target');

-- CreateTable
CREATE TABLE "Set" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT NOT NULL,
    "msrp" INTEGER,
    "legoUrl" TEXT,
    "canonicalUrl" TEXT,
    "rakutenProductId" TEXT,
    "advertiserId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "setIdRef" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "price" INTEGER,
    "url" TEXT,
    "inStock" BOOLEAN DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "setIdRef" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "setIdRef" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "price" INTEGER,
    "inStock" BOOLEAN,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Set_setId_key" ON "Set"("setId");

-- CreateIndex
CREATE INDEX "Offer_setIdRef_idx" ON "Offer"("setIdRef");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_setIdRef_retailer_key" ON "Offer"("setIdRef", "retailer");

-- CreateIndex
CREATE INDEX "Click_setIdRef_idx" ON "Click"("setIdRef");

-- CreateIndex
CREATE UNIQUE INDEX "Click_setIdRef_retailer_key" ON "Click"("setIdRef", "retailer");

-- CreateIndex
CREATE INDEX "PriceHistory_setIdRef_idx" ON "PriceHistory"("setIdRef");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_setIdRef_fkey" FOREIGN KEY ("setIdRef") REFERENCES "Set"("setId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_setIdRef_fkey" FOREIGN KEY ("setIdRef") REFERENCES "Set"("setId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_setIdRef_fkey" FOREIGN KEY ("setIdRef") REFERENCES "Set"("setId") ON DELETE CASCADE ON UPDATE CASCADE;
