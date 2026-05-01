-- Trust Score Engine workflow storage.
-- These columns keep the evidence, component scores, routing decision, and audit report
-- directly on the claim record so admin review screens can load one complete claim object.
ALTER TABLE "claims"
ADD COLUMN IF NOT EXISTS "gps_array" JSONB,
ADD COLUMN IF NOT EXISTS "ipfs_hashes" JSONB,
ADD COLUMN IF NOT EXISTS "session_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "trust_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "n_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "g_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "t_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "w_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "p_score" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "routing_tier" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "trust_report_hash" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "trust_report_json" JSONB;

CREATE TABLE IF NOT EXISTS "scan_sessions" (
  "id" SERIAL NOT NULL,
  "farm_id" INTEGER NOT NULL,
  "disease_type" VARCHAR(255) NOT NULL,
  "session_data" VARCHAR(255) NOT NULL,
  "gps_array" JSONB,
  "ipfs_hashes" JSONB,
  "session_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "scan_sessions_farm_id_disease_type_session_date_idx"
ON "scan_sessions"("farm_id", "disease_type", "session_date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scan_sessions_farm_id_fkey'
  ) THEN
    ALTER TABLE "scan_sessions"
    ADD CONSTRAINT "scan_sessions_farm_id_fkey"
    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "disease_weather_profile" (
  "id" SERIAL NOT NULL,
  "disease_type" VARCHAR(255) NOT NULL,
  "temp_min" DECIMAL(5,2),
  "temp_max" DECIMAL(5,2),
  "precipitation_min" DECIMAL(7,2),
  "precipitation_max" DECIMAL(7,2),
  "humidity_min" DECIMAL(5,2),
  "humidity_max" DECIMAL(5,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disease_weather_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "disease_weather_profile_disease_type_key"
ON "disease_weather_profile"("disease_type");

-- Seed broad disease-weather lookup bands. Projects can refine these by crop and region later.
INSERT INTO "disease_weather_profile"
("disease_type", "temp_min", "temp_max", "precipitation_min", "precipitation_max", "humidity_min", "humidity_max")
VALUES
('fungal', 18, 30, 20, 250, 70, 100),
('bacterial', 24, 35, 10, 220, 60, 100),
('viral', 20, 35, 0, 120, 40, 90),
('pest', 25, 40, 0, 80, 30, 85),
('healthy', 15, 35, 0, 200, 30, 90),
('unknown', 18, 35, 0, 250, 30, 100)
ON CONFLICT ("disease_type") DO NOTHING;
