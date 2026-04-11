-- CreateTable
CREATE TABLE "Derogation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dfcId" TEXT NOT NULL,
    "numero" TEXT,
    "dateReception" DATETIME,
    "dateApplicationEstimee" DATETIME,
    "dateApplicationEffective" DATETIME,
    "commentaire" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Derogation_dfcId_fkey" FOREIGN KEY ("dfcId") REFERENCES "DFC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Derogation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ECO" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dfcId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedAt" DATETIME,
    "commentaire" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ECO_dfcId_fkey" FOREIGN KEY ("dfcId") REFERENCES "DFC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ECO_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Derogation_dfcId_idx" ON "Derogation"("dfcId");
CREATE INDEX "Derogation_createdById_idx" ON "Derogation"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ECO_dfcId_key" ON "ECO"("dfcId");
CREATE INDEX "ECO_createdById_idx" ON "ECO"("createdById");

-- Backfill existing flat derogation fields from DFC into Derogation
INSERT INTO "Derogation" (
    "id",
    "dfcId",
    "numero",
    "dateReception",
    "dateApplicationEstimee",
    "dateApplicationEffective",
    "commentaire",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))) AS id,
    d."id",
    d."numeroDerogation",
    d."dateReceptionDerogation",
    d."dateApplicationEstimee",
    d."dateApplicationDerogation",
    d."commentaire",
    d."createdById",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "DFC" d
WHERE d."numeroDerogation" IS NOT NULL
   OR d."dateReceptionDerogation" IS NOT NULL
   OR d."dateApplicationEstimee" IS NOT NULL
   OR d."dateApplicationDerogation" IS NOT NULL;
