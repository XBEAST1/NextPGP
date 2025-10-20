/*
  Warnings:

  - You are about to drop the `IPRateLimit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRateLimit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."IPRateLimit";

-- DropTable
DROP TABLE "public"."UserRateLimit";

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL DEFAULT 'default',
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_userId_endpoint_windowStart_key" ON "RateLimit"("userId", "endpoint", "windowStart");

-- CreateIndex
CREATE INDEX "PGPKeys_vaultId_idx" ON "PGPKeys"("vaultId");
