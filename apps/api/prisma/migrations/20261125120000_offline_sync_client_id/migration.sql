-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "WellnessEntry" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientId_key" ON "Session"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessEntry_clientId_key" ON "WellnessEntry"("clientId");

