-- AlterTable
ALTER TABLE "User" ADD COLUMN     "healthConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HealthConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthConsentEvent_userId_createdAt_idx" ON "HealthConsentEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HealthConsentEvent" ADD CONSTRAINT "HealthConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
