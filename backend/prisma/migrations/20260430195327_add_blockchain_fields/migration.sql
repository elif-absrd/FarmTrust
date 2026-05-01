/*
  Warnings:

  - Added the required column `farmTokenId` to the `claims` table without a default value. This is not possible if the table is not empty.
  - Added the required column `farmerWalletAddress` to the `claims` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "farmTokenId" INTEGER NOT NULL,
ADD COLUMN     "farmerWalletAddress" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "claimId" INTEGER NOT NULL,
    "ipfsHash" TEXT NOT NULL,
    "auction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
