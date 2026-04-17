-- Add explicit assigned responsible on DFC
ALTER TABLE "DFC" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "DFC" ADD COLUMN "assignedAt" DATETIME;

-- Backfill historical records to keep dashboard metrics consistent
UPDATE "DFC"
SET
  "assignedToId" = "createdById",
  "assignedAt" = COALESCE("updatedAt", "createdAt")
WHERE "assignedToId" IS NULL;

-- Indexes to speed up responsible dashboard filters and KPI queries
CREATE INDEX "DFC_assignedToId_idx" ON "DFC"("assignedToId");
CREATE INDEX "DFC_assignedToId_faisabilite_idx" ON "DFC"("assignedToId", "faisabilite");
CREATE INDEX "DFC_assignedToId_dateReponse_idx" ON "DFC"("assignedToId", "dateReponse");
