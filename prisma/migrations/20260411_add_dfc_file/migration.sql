-- CreateTable
CREATE TABLE "DFCFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dfcId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DFCFile_dfcId_fkey" FOREIGN KEY ("dfcId") REFERENCES "DFC" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DFCFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DFCFile_dfcId_idx" ON "DFCFile"("dfcId");

-- CreateIndex
CREATE INDEX "DFCFile_uploadedById_idx" ON "DFCFile"("uploadedById");
