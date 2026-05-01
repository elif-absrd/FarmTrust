/*
  Warnings:

  - The `status` column on the `claims` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SURVEYED_PENDING', 'PAID');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_claimId_fkey";

-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" INTEGER,
ADD COLUMN     "component_scores" JSONB,
ADD COLUMN     "ipfs_hashes" JSONB,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "trust_score" DECIMAL(5,3),
ADD COLUMN     "tx_hash" VARCHAR(255),
DROP COLUMN "status",
ADD COLUMN     "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "orchard_registrations" ADD COLUMN     "account_name" VARCHAR(255),
ADD COLUMN     "account_number" VARCHAR(255),
ADD COLUMN     "area_acres" DECIMAL(10,2),
ADD COLUMN     "bank_name" VARCHAR(255);

-- DropTable
DROP TABLE "AuditLog";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "claim_id" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "image_ipfs_hash" VARCHAR(255),
    "ndvi_report_ipfs_hash" VARCHAR(255),
    "threshold_report_ipfs_hash" VARCHAR(255),
    "trust_score" DECIMAL(5,3),
    "component_scores" JSONB,
    "approved_by" INTEGER,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
