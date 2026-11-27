-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "teamSessionId" TEXT;

-- CreateTable
CREATE TABLE "TeamSession" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "createdById" TEXT,
    "type" "SessionType" NOT NULL,
    "date" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSession_squadId_date_idx" ON "TeamSession"("squadId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Session_athleteId_teamSessionId_key" ON "Session"("athleteId", "teamSessionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_teamSessionId_fkey" FOREIGN KEY ("teamSessionId") REFERENCES "TeamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSession" ADD CONSTRAINT "TeamSession_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSession" ADD CONSTRAINT "TeamSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

