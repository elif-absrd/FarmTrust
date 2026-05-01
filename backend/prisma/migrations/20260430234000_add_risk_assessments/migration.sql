CREATE TABLE IF NOT EXISTS "risk_assessments" (
  "id" SERIAL NOT NULL,
  "farm_id" VARCHAR(255) NOT NULL,
  "soil_ph" DECIMAL(3,1) NOT NULL,
  "soil_moisture" DECIMAL(5,2) NOT NULL,
  "soil_nutrient" DECIMAL(3,1) NOT NULL,
  "weather_temperature" DECIMAL(5,2) NOT NULL,
  "weather_humidity" DECIMAL(5,2) NOT NULL,
  "weather_rainfall" DECIMAL(7,2) NOT NULL,
  "crop_previous_disease_risk_score" INTEGER NOT NULL,
  "crop_past_disease_occurrences" INTEGER NOT NULL,
  "soil_score" INTEGER NOT NULL,
  "weather_score" INTEGER NOT NULL,
  "crop_score" INTEGER NOT NULL,
  "composite_score" INTEGER NOT NULL,
  "risk_level" INTEGER NOT NULL,
  "risk_level_name" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "risk_assessments_farm_id_idx" ON "risk_assessments"("farm_id");
CREATE INDEX IF NOT EXISTS "risk_assessments_created_at_idx" ON "risk_assessments"("created_at");
CREATE INDEX IF NOT EXISTS "risk_assessments_status_idx" ON "risk_assessments"("status");
CREATE INDEX IF NOT EXISTS "risk_assessments_risk_level_idx" ON "risk_assessments"("risk_level");
