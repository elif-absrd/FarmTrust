-- CreateTable
CREATE TABLE "risk_evaluation_logs" (
    "id" SERIAL NOT NULL,
    "farm_id" INTEGER,
    "user_id" INTEGER,
    "soil_ph" DECIMAL(5,2),
    "soil_moisture" DECIMAL(5,2),
    "soil_nutrient" DECIMAL(5,2),
    "weather_temperature" DECIMAL(5,2),
    "weather_humidity" DECIMAL(5,2),
    "weather_rainfall" DECIMAL(7,2),
    "previous_disease_risk_score" DECIMAL(5,2),
    "past_disease_occurrences" INTEGER,
    "soil_score" DECIMAL(5,2),
    "weather_score" DECIMAL(5,2),
    "crop_score" DECIMAL(5,2),
    "composite_score" DECIMAL(5,2),
    "risk_level" INTEGER,
    "decision" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_evaluation_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "risk_evaluation_logs" ADD CONSTRAINT "risk_evaluation_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluation_logs" ADD CONSTRAINT "risk_evaluation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
