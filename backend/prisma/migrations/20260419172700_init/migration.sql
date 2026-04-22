-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidationSource" AS ENUM ('GOOGLE_EARTH', 'NDVI_SERVICE', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "wallet_address" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "phone" VARCHAR(20),
    "farmer_name" VARCHAR(255),
    "region" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'FARMER',
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "farm_name" VARCHAR(255),
    "crop_type" VARCHAR(255),
    "orchard_type" VARCHAR(255),
    "farm_token_id" VARCHAR(255),
    "chain_tx_hash" VARCHAR(255),
    "chain_network" VARCHAR(100),
    "chain_identity_assigned_at" TIMESTAMP(3),
    "state" VARCHAR(255),
    "district" VARCHAR(255),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "village" VARCHAR(255),
    "city" VARCHAR(255),
    "pincode" VARCHAR(20),
    "landmark" VARCHAR(255),
    "full_address" TEXT,
    "area_acres" DECIMAL(10,2),
    "number_of_trees" INTEGER,
    "tree_types" JSONB,
    "gps_polygon" JSONB,
    "location_latitude" DECIMAL(10,7),
    "location_longitude" DECIMAL(10,7),
    "location_validated" BOOLEAN NOT NULL DEFAULT false,
    "location_validated_at" TIMESTAMP(3),
    "location_validation_source" "ValidationSource",
    "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "baseline_ndvi" DECIMAL(5,3),
    "baseline_date" TIMESTAMP(3),
    "ndvi_score" DECIMAL(5,3),
    "ndvi_scored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchard_registrations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "farm_id" INTEGER,
    "orchard_name" VARCHAR(255) NOT NULL,
    "orchard_type" VARCHAR(255) NOT NULL,
    "address_line_1" VARCHAR(255) NOT NULL,
    "address_line_2" VARCHAR(255),
    "village" VARCHAR(255),
    "city" VARCHAR(255),
    "district" VARCHAR(255) NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "pincode" VARCHAR(20) NOT NULL,
    "landmark" VARCHAR(255),
    "full_address" TEXT NOT NULL,
    "gps_polygon" JSONB NOT NULL,
    "location_latitude" DECIMAL(10,7),
    "location_longitude" DECIMAL(10,7),
    "number_of_trees" INTEGER NOT NULL,
    "tree_types" JSONB NOT NULL,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "registration_status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "location_validated" BOOLEAN NOT NULL DEFAULT false,
    "location_validation_source" "ValidationSource",
    "location_validation_message" TEXT,
    "location_validation_score" DECIMAL(5,3),
    "ndvi_score" DECIMAL(5,3),
    "ndvi_scored_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orchard_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchard_documents" (
    "id" SERIAL NOT NULL,
    "orchard_registration_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" VARCHAR(255),
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orchard_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ndvi_history" (
    "id" SERIAL NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "ndvi_value" DECIMAL(5,3),
    "fetch_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ndvi_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "crop_type" VARCHAR(255),
    "coverage_amount" DECIMAL(12,2),
    "premium" DECIMAL(12,2),
    "severity_threshold" DECIMAL(3,2),
    "status" VARCHAR(50),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" SERIAL NOT NULL,
    "farm_id" INTEGER NOT NULL,
    "policy_id" INTEGER,
    "disease_image_hash" VARCHAR(255),
    "disease_type" VARCHAR(255),
    "disease_severity" DECIMAL(3,2),
    "ndvi_verified" BOOLEAN NOT NULL DEFAULT false,
    "ndvi_baseline" DECIMAL(5,3),
    "ndvi_current" DECIMAL(5,3),
    "ndvi_drop_percentage" DECIMAL(5,2),
    "status" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orchard_registrations_user_id_key" ON "orchard_registrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orchard_registrations_farm_id_key" ON "orchard_registrations"("farm_id");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchard_registrations" ADD CONSTRAINT "orchard_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchard_registrations" ADD CONSTRAINT "orchard_registrations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchard_documents" ADD CONSTRAINT "orchard_documents_orchard_registration_id_fkey" FOREIGN KEY ("orchard_registration_id") REFERENCES "orchard_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ndvi_history" ADD CONSTRAINT "ndvi_history_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
