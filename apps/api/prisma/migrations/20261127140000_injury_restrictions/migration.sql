-- #21: scope injuries to the squad whose physio recorded them (I-14), and add physio-set
-- training restrictions that the squad's coaches can see. Existing injury rows keep a null squadId,
-- which no squad route returns (fail closed).

-- DropIndex
DROP INDEX "Injury_athleteId_idx";

-- AlterTable
ALTER TABLE "Injury" ADD COLUMN     "squadId" TEXT;

-- CreateTable
CREATE TABLE "Restriction" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "recordedById" TEXT,
    "description" TEXT NOT NULL,
    "reviewOn" DATE,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Restriction_athleteId_squadId_idx" ON "Restriction"("athleteId", "squadId");

-- CreateIndex
CREATE INDEX "Injury_athleteId_squadId_idx" ON "Injury"("athleteId", "squadId");

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restriction" ADD CONSTRAINT "Restriction_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restriction" ADD CONSTRAINT "Restriction_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restriction" ADD CONSTRAINT "Restriction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
