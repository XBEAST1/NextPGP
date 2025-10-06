-- CreateTable
CREATE TABLE "IPRateLimit" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetTime" TIMESTAMP(3) NOT NULL,
    "lastRequest" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL DEFAULT 'default',
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IPRateLimit_ip_key" ON "IPRateLimit"("ip");

-- CreateIndex
CREATE INDEX "IPRateLimit_resetTime_idx" ON "IPRateLimit"("resetTime");

-- CreateIndex
CREATE INDEX "UserRateLimit_windowStart_idx" ON "UserRateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "UserRateLimit_userId_endpoint_windowStart_key" ON "UserRateLimit"("userId", "endpoint", "windowStart");
