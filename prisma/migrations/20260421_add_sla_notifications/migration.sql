-- SLA tracking fields on DFC
ALTER TABLE "DFC" ADD COLUMN "slaDueDate" DATETIME;
ALTER TABLE "DFC" ADD COLUMN "slaDelayDays" INTEGER;
ALTER TABLE "DFC" ADD COLUMN "isOverdue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DFC" ADD COLUMN "overdueSince" DATETIME;

-- SLA rule per project (configurable from admin)
CREATE TABLE "SlaRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "typeDFC" TEXT,
  "delayDays" INTEGER NOT NULL DEFAULT 3,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SlaRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SlaRule_projectId_typeDFC_key" ON "SlaRule"("projectId", "typeDFC");
CREATE INDEX "SlaRule_projectId_active_idx" ON "SlaRule"("projectId", "active");

-- In-app notifications (one-shot alert supported with dedupeKey)
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dfcId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_dfcId_fkey" FOREIGN KEY ("dfcId") REFERENCES "DFC" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_dfcId_idx" ON "Notification"("dfcId");

-- DFC performance indexes for overdue scanning and dashboard filters
CREATE INDEX "DFC_projectId_slaDueDate_idx" ON "DFC"("projectId", "slaDueDate");
CREATE INDEX "DFC_isOverdue_slaDueDate_idx" ON "DFC"("isOverdue", "slaDueDate");

-- Backfill Renault default rule behavior for existing DFC records
UPDATE "DFC"
SET
  "slaDelayDays" = 3,
  "slaDueDate" = datetime(date("dateReception"), '+3 day', '+23 hours', '+59 minutes', '+59 seconds'),
  "isOverdue" = CASE
    WHEN "dateReponse" IS NULL
      AND datetime('now') > datetime(date("dateReception"), '+3 day', '+23 hours', '+59 minutes', '+59 seconds')
    THEN true
    ELSE false
  END,
  "overdueSince" = CASE
    WHEN "dateReponse" IS NULL
      AND datetime('now') > datetime(date("dateReception"), '+3 day', '+23 hours', '+59 minutes', '+59 seconds')
    THEN datetime(date("dateReception"), '+3 day', '+23 hours', '+59 minutes', '+59 seconds')
    ELSE NULL
  END
WHERE "projectId" IN (
  SELECT "id" FROM "Project" WHERE lower("name") = 'renault'
);
