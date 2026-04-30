const prisma = require('../config/prisma');

/**
 * Clamp a numeric value between a minimum and maximum.
 * This ensures all normalized scores stay in the 0-100 range.
 */
function clamp(value, min = 0, max = 100) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate a score for a value based on an ideal range.
 * Returns 100 when within the ideal range and reduces the score as the value moves away.
 */
function scoreIdealRange(value, idealMin, idealMax, penaltyPerUnit) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value >= idealMin && value <= idealMax) {
    return 100;
  }

  const distance = value < idealMin ? idealMin - value : value - idealMax;
  return clamp(100 - distance * penaltyPerUnit);
}

/**
 * Score the soil pH against a realistic agricultural ideal range (6.0 - 7.0).
 */
function scorePh(ph) {
  return scoreIdealRange(Number(ph), 6.0, 7.0, 25);
}

/**
 * Score soil moisture based on the recommended range for most crops (40% - 60%).
 */
function scoreMoisture(moisture) {
  return scoreIdealRange(Number(moisture), 40, 60, 2.5);
}

/**
 * Score nutrient level within a 0-100 scale.
 */
function scoreNutrient(nutrient) {
  if (!Number.isFinite(nutrient)) {
    return 0;
  }
  return clamp(Number(nutrient));
}

/**
 * Score the temperature using an ideal range of 20°C - 30°C for common crops.
 */
function scoreTemperature(temperature) {
  return scoreIdealRange(Number(temperature), 20, 30, 4);
}

/**
 * Score humidity using a broadly accepted healthy range of 40% - 60%.
 */
function scoreHumidity(humidity) {
  return scoreIdealRange(Number(humidity), 40, 60, 2);
}

/**
 * Score rainfall in millimeters using a moderate ideal range of 10mm - 30mm.
 */
function scoreRainfall(rainfall) {
  return scoreIdealRange(Number(rainfall), 10, 30, 3);
}

/**
 * Calculate crop health score from past disease risk and historical occurrences.
 * A higher crop score means healthier crop status.
 */
function scoreCropHealth(previousDiseaseRiskScore, pastDiseaseOccurrences) {
  const normalizedRisk = clamp(Number(previousDiseaseRiskScore), 0, 100);
  const normalizedOccurrences = clamp(Number(pastDiseaseOccurrences), 0, 10);

  const diseaseRiskHealth = 100 - normalizedRisk;
  const occurrenceHealth = clamp(100 - normalizedOccurrences * 6);

  const cropScore = (diseaseRiskHealth * 0.6) + (occurrenceHealth * 0.4);
  return clamp(cropScore);
}

/**
 * Assign a risk level from 1 to 5 based on a normalized composite score.
 */
function classifyRiskLevel(compositeScore) {
  const score = clamp(Number(compositeScore));

  if (score >= 80) {
    return 1;
  }
  if (score >= 65) {
    return 2;
  }
  if (score >= 50) {
    return 3;
  }
  if (score >= 35) {
    return 4;
  }
  return 5;
}

/**
 * Decide whether to approve or flag the farm based on the risk level.
 */
function getDecision(riskLevel) {
  return riskLevel === 1 || riskLevel === 2 ? 'APPROVED' : 'FLAGGED';
}

/**
 * Normalize a score to 0-100 and round to two decimal places.
 */
function normalize(value) {
  return Number(clamp(value).toFixed(2));
}

/**
 * Evaluate risk using soil, weather, and crop history data.
 * Persists the evaluation log to the database for auditing and tracking.
 */
async function evaluateRisk({
  soilData,
  weatherData,
  cropHistoryData,
  farmId = null,
  userId = null,
}) {
  if (!soilData || !weatherData || !cropHistoryData) {
    throw new Error('soilData, weatherData, and cropHistoryData are all required');
  }

  const soilScore = normalize(
    (scorePh(soilData.ph) + scoreMoisture(soilData.moisture) + scoreNutrient(soilData.nutrient)) / 3
  );

  const weatherScore = normalize(
    (scoreTemperature(weatherData.temperature) + scoreHumidity(weatherData.humidity) + scoreRainfall(weatherData.rainfall)) / 3
  );

  const cropScore = normalize(
    scoreCropHealth(cropHistoryData.previousDiseaseRiskScore, cropHistoryData.pastDiseaseOccurrences)
  );

  const compositeScore = normalize(
    soilScore * 0.4 + weatherScore * 0.3 + cropScore * 0.3
  );

  const riskLevel = classifyRiskLevel(compositeScore);
  const decision = getDecision(riskLevel);

  const evaluationRecord = await prisma.riskEvaluationLog.create({
    data: {
      farmId,
      userId,
      soilPh: soilData.ph,
      soilMoisture: soilData.moisture,
      soilNutrient: soilData.nutrient,
      weatherTemperature: weatherData.temperature,
      weatherHumidity: weatherData.humidity,
      weatherRainfall: weatherData.rainfall,
      previousDiseaseRiskScore: cropHistoryData.previousDiseaseRiskScore,
      pastDiseaseOccurrences: cropHistoryData.pastDiseaseOccurrences,
      soilScore,
      weatherScore,
      cropScore,
      compositeScore,
      riskLevel,
      decision,
    },
  });

  return {
    soilScore,
    weatherScore,
    cropScore,
    compositeScore,
    riskLevel,
    decision,
    evaluatedAt: evaluationRecord.createdAt,
  };
}

/**
 * Main function for a sample run.
 * This can be executed directly with `node backend/services/riskScoring.js`.
 */
async function main() {
  try {
    const sampleRun = {
      soilData: {
        ph: 6.5,
        moisture: 52,
        nutrient: 78,
      },
      weatherData: {
        temperature: 24,
        humidity: 55,
        rainfall: 18,
      },
      cropHistoryData: {
        previousDiseaseRiskScore: 15,
        pastDiseaseOccurrences: 1,
      },
    };

    console.log('Running sample risk evaluation...');
    const result = await evaluateRisk(sampleRun);
    console.log('Sample evaluation result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Sample risk evaluation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  evaluateRisk,
  classifyRiskLevel,
  getDecision,
};

if (require.main === module) {
  main();
}
