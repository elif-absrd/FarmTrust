/**
 * RISK SCORING ENGINE - Smart Agriculture System
 * 
 * This module implements a comprehensive risk assessment system for agricultural operations.
 * It evaluates soil, weather, and crop health factors to calculate a composite risk score
 * and provide actionable decision recommendations.
 * 
 * ARCHITECTURE:
 * - Individual Score Calculation: Each factor (soil, weather, crop) is independently scored
 * - Normalization: All scores are normalized to 0-100 scale for consistency
 * - Weighted Composition: Final score uses agricultural best-practice weights
 * - Risk Classification: Multi-level risk stratification (Level 1-5)
 * - Decision Engine: Automated approval/review-flag based on risk thresholds
 */

/**
 * SOIL SCORING LOGIC
 * 
 * Evaluates soil health based on three critical parameters:
 * - pH Level: Determines nutrient availability and microbial activity
 *   Ideal range: 6.0-7.0 (neutral to slightly acidic)
 *   Agricultural best practice: pH levels outside this range reduce nutrient uptake
 * 
 * - Moisture Level: Controls water availability and soil structure
 *   Ideal range: 25-35% (Field Capacity)
 *   Too low (< 15%): Water stress on crops
 *   Too high (> 40%): Anaerobic conditions, root rot
 * 
 * - Nutrient Level: Represents overall soil fertility (Nitrogen, Phosphorus, Potassium)
 *   Ideal range: 2.5-3.5 (arbitrary scale representing major nutrients)
 *   Low nutrients: Poor crop yield and disease resistance
 */
class SoilScorer {
  constructor() {
    // Agricultural thresholds and ideal ranges
    this.pH_IDEAL_MIN = 6.0;
    this.pH_IDEAL_MAX = 7.0;
    this.pH_CRITICAL_MIN = 4.0;
    this.pH_CRITICAL_MAX = 9.0;

    this.MOISTURE_IDEAL_MIN = 25;
    this.MOISTURE_IDEAL_MAX = 35;
    this.MOISTURE_CRITICAL_MIN = 5;
    this.MOISTURE_CRITICAL_MAX = 50;

    this.NUTRIENT_IDEAL_MIN = 2.5;
    this.NUTRIENT_IDEAL_MAX = 3.5;
    this.NUTRIENT_CRITICAL_MIN = 1.0;
    this.NUTRIENT_CRITICAL_MAX = 5.0;
  }

  /**
   * Calculate soil score using Gaussian distribution centered on ideal values
   * This creates a "sweet spot" effect - optimal conditions score highest
   * 
   * @param {number} pH - Soil pH level (0-14 scale)
   * @param {number} moisture - Soil moisture percentage (0-100)
   * @param {number} nutrient - Nutrient level (1-5 scale)
   * @returns {number} Soil score normalized to 0-100
   */
  calculateScore(pH, moisture, nutrient) {
    // Validate inputs
    this._validateInputs(pH, moisture, nutrient);

    // Calculate individual component scores (0-100)
    const phScore = this._calculateComponentScore(
      pH,
      this.pH_IDEAL_MIN,
      this.pH_IDEAL_MAX,
      this.pH_CRITICAL_MIN,
      this.pH_CRITICAL_MAX
    );

    const moistureScore = this._calculateComponentScore(
      moisture,
      this.MOISTURE_IDEAL_MIN,
      this.MOISTURE_IDEAL_MAX,
      this.MOISTURE_CRITICAL_MIN,
      this.MOISTURE_CRITICAL_MAX
    );

    const nutrientScore = this._calculateComponentScore(
      nutrient,
      this.NUTRIENT_IDEAL_MIN,
      this.NUTRIENT_IDEAL_MAX,
      this.NUTRIENT_CRITICAL_MIN,
      this.NUTRIENT_CRITICAL_MAX
    );

    // Average the three components
    const soilScore = (phScore + moistureScore + nutrientScore) / 3;

    return Math.round(soilScore);
  }

  /**
   * Helper: Calculate component score using Gaussian distribution
   * Assigns maximum score to ideal range, decreases towards boundaries
   * 
   * @private
   */
  _calculateComponentScore(value, idealMin, idealMax, criticalMin, criticalMax) {
    // If value is in ideal range, give high score
    if (value >= idealMin && value <= idealMax) {
      return 100;
    }

    // If value is beyond critical range, give minimum score
    if (value < criticalMin || value > criticalMax) {
      return 10; // Minimum 10 to avoid complete failure
    }

    // Calculate score based on distance from ideal range
    let distanceFromIdeal;
    if (value < idealMin) {
      distanceFromIdeal = idealMin - value;
      const rangeToMin = idealMin - criticalMin;
      return Math.max(10, 100 - (distanceFromIdeal / rangeToMin) * 90);
    } else {
      distanceFromIdeal = value - idealMax;
      const rangeToMax = criticalMax - idealMax;
      return Math.max(10, 100 - (distanceFromIdeal / rangeToMax) * 90);
    }
  }

  /**
   * Validate soil inputs are within reasonable agricultural ranges
   * @private
   */
  _validateInputs(pH, moisture, nutrient) {
    if (pH < 0 || pH > 14) {
      throw new Error(`Invalid pH: ${pH}. Must be between 0-14`);
    }
    if (moisture < 0 || moisture > 100) {
      throw new Error(`Invalid moisture: ${moisture}. Must be between 0-100`);
    }
    if (nutrient < 0 || nutrient > 5) {
      throw new Error(`Invalid nutrient: ${nutrient}. Must be between 0-5`);
    }
  }

  /**
   * Generate detailed explanation of soil score
   * @private
   */
  getExplanation(pH, moisture, nutrient) {
    let explanation = "Soil Assessment: ";
    
    if (pH < this.pH_IDEAL_MIN || pH > this.pH_IDEAL_MAX) {
      explanation += `pH ${pH} is outside ideal range (${this.pH_IDEAL_MIN}-${this.pH_IDEAL_MAX}). `;
    }
    if (moisture < this.MOISTURE_IDEAL_MIN || moisture > this.MOISTURE_IDEAL_MAX) {
      explanation += `Moisture ${moisture}% is outside ideal range (${this.MOISTURE_IDEAL_MIN}-${this.MOISTURE_IDEAL_MAX}%). `;
    }
    if (nutrient < this.NUTRIENT_IDEAL_MIN || nutrient > this.NUTRIENT_IDEAL_MAX) {
      explanation += `Nutrient level ${nutrient} is outside ideal range (${this.NUTRIENT_IDEAL_MIN}-${this.NUTRIENT_IDEAL_MAX}). `;
    }

    return explanation || "Soil conditions are optimal.";
  }
}

/**
 * WEATHER SCORING LOGIC
 * 
 * Evaluates weather conditions for crop suitability and disease risk:
 * - Temperature: Affects crop growth rate and pest/disease activity
 *   Ideal range: 20-30°C (varies by crop type)
 *   Below 10°C: Growth stalls, pest/disease dormancy (lower risk)
 *   Above 35°C: Heat stress, crop failure risk
 * 
 * - Humidity: Critical for fungal disease development
 *   Ideal: 40-70% (balance between water availability and disease prevention)
 *   > 80%: Fungal disease risk increases significantly
 *   < 30%: Water stress and pest activity increase
 * 
 * - Rainfall: Affects irrigation needs and fungal disease risk
 *   Ideal: 100-200mm/month (seasonal average)
 *   Excessive rainfall (> 300mm/month): Waterlogging, fungal diseases
 *   Drought (< 50mm/month): Water stress, crop failure
 */
class WeatherScorer {
  constructor() {
    // Temperature thresholds (Celsius) - applicable for most crops
    this.TEMP_IDEAL_MIN = 20;
    this.TEMP_IDEAL_MAX = 30;
    this.TEMP_CRITICAL_MIN = 0;
    this.TEMP_CRITICAL_MAX = 45;

    // Humidity thresholds (%) - affects disease risk
    this.HUMIDITY_IDEAL_MIN = 40;
    this.HUMIDITY_IDEAL_MAX = 70;
    this.HUMIDITY_CRITICAL_MIN = 10;
    this.HUMIDITY_CRITICAL_MAX = 100;

    // Rainfall thresholds (mm/month)
    this.RAINFALL_IDEAL_MIN = 100;
    this.RAINFALL_IDEAL_MAX = 200;
    this.RAINFALL_CRITICAL_MIN = 0;
    this.RAINFALL_CRITICAL_MAX = 500; // Extreme flooding
  }

  /**
   * Calculate weather score based on temperature, humidity, and rainfall
   * Weather conditions significantly influence disease and pest risk
   * 
   * @param {number} temperature - Current temperature in Celsius
   * @param {number} humidity - Current humidity percentage (0-100)
   * @param {number} rainfall - Monthly rainfall in mm
   * @returns {number} Weather score normalized to 0-100
   */
  calculateScore(temperature, humidity, rainfall) {
    this._validateInputs(temperature, humidity, rainfall);

    const tempScore = this._calculateComponentScore(
      temperature,
      this.TEMP_IDEAL_MIN,
      this.TEMP_IDEAL_MAX,
      this.TEMP_CRITICAL_MIN,
      this.TEMP_CRITICAL_MAX
    );

    const humidityScore = this._calculateComponentScore(
      humidity,
      this.HUMIDITY_IDEAL_MIN,
      this.HUMIDITY_IDEAL_MAX,
      this.HUMIDITY_CRITICAL_MIN,
      this.HUMIDITY_CRITICAL_MAX
    );

    const rainfallScore = this._calculateComponentScore(
      rainfall,
      this.RAINFALL_IDEAL_MIN,
      this.RAINFALL_IDEAL_MAX,
      this.RAINFALL_CRITICAL_MIN,
      this.RAINFALL_CRITICAL_MAX
    );

    // Weight humidity and rainfall higher for disease risk assessment
    // Temperature: 33%, Humidity: 40%, Rainfall: 27%
    const weatherScore = (tempScore * 0.33) + (humidityScore * 0.40) + (rainfallScore * 0.27);

    return Math.round(weatherScore);
  }

  /**
   * @private
   */
  _calculateComponentScore(value, idealMin, idealMax, criticalMin, criticalMax) {
    if (value >= idealMin && value <= idealMax) {
      return 100;
    }

    if (value < criticalMin || value > criticalMax) {
      return 10;
    }

    let distanceFromIdeal;
    if (value < idealMin) {
      distanceFromIdeal = idealMin - value;
      const rangeToMin = idealMin - criticalMin;
      return Math.max(10, 100 - (distanceFromIdeal / rangeToMin) * 90);
    } else {
      distanceFromIdeal = value - idealMax;
      const rangeToMax = criticalMax - idealMax;
      return Math.max(10, 100 - (distanceFromIdeal / rangeToMax) * 90);
    }
  }

  /**
   * @private
   */
  _validateInputs(temperature, humidity, rainfall) {
    if (temperature < -50 || temperature > 60) {
      throw new Error(`Invalid temperature: ${temperature}. Must be between -50 to 60°C`);
    }
    if (humidity < 0 || humidity > 100) {
      throw new Error(`Invalid humidity: ${humidity}. Must be between 0-100%`);
    }
    if (rainfall < 0) {
      throw new Error(`Invalid rainfall: ${rainfall}. Must be non-negative`);
    }
  }
}

/**
 * CROP HEALTH SCORING LOGIC
 * 
 * Evaluates crop health based on historical disease and health data:
 * - Previous Disease Risk Score: Historical assessment of crop vulnerability
 *   Score 0-100, higher = worse health status
 * 
 * - Number of Past Disease Occurrences: Frequency of disease events
 *   Indicates crop susceptibility and field history
 *   Multiple occurrences increase likelihood of recurrence
 */
class CropHealthScorer {
  /**
   * Calculate crop health score based on historical disease data
   * 
   * @param {number} previousDiseaseRiskScore - Previous risk assessment (0-100)
   * @param {number} pastDiseaseOccurrences - Number of past disease events
   * @returns {number} Crop health score normalized to 0-100
   */
  calculateScore(previousDiseaseRiskScore, pastDiseaseOccurrences) {
    this._validateInputs(previousDiseaseRiskScore, pastDiseaseOccurrences);

    // Convert previous risk score to health score (inverse relationship)
    // High risk = low health
    const healthFromHistory = 100 - previousDiseaseRiskScore;

    // Penalize based on frequency of past occurrences
    // Each occurrence reduces score by 10 points (up to 50% reduction)
    const occurrencePenalty = Math.min(50, pastDiseaseOccurrences * 10);
    const healthFromOccurrences = 100 - occurrencePenalty;

    // Combine: 60% weight on previous score, 40% on occurrence history
    const cropScore = (healthFromHistory * 0.6) + (healthFromOccurrences * 0.4);

    return Math.round(cropScore);
  }

  /**
   * @private
   */
  _validateInputs(previousScore, occurrences) {
    if (previousScore < 0 || previousScore > 100) {
      throw new Error(`Invalid previous risk score: ${previousScore}. Must be 0-100`);
    }
    if (occurrences < 0 || !Number.isInteger(occurrences)) {
      throw new Error(`Invalid past occurrences: ${occurrences}. Must be non-negative integer`);
    }
  }
}

/**
 * COMPOSITE RISK SCORING ENGINE
 * 
 * Integrates individual scores using weighted average:
 * - Soil Score: 40% weight
 *   Rationale: Soil is foundation of agriculture; poor soil affects all crops
 * 
 * - Weather Score: 30% weight
 *   Rationale: Weather influences disease risk but varies naturally
 * 
 * - Crop Health Score: 30% weight
 *   Rationale: Historical data indicates crop susceptibility
 * 
 * The composite score determines risk level classification.
 */
class CompositeRiskEngine {
  constructor() {
    this.SOIL_WEIGHT = 0.40;
    this.WEATHER_WEIGHT = 0.30;
    this.CROP_WEIGHT = 0.30;

    // Risk level thresholds
    this.RISK_LEVELS = {
      1: { name: 'Very Low Risk', range: [80, 100] },
      2: { name: 'Low Risk', range: [65, 79] },
      3: { name: 'Moderate Risk', range: [50, 64] },
      4: { name: 'High Risk', range: [35, 49] },
      5: { name: 'Very High Risk', range: [0, 34] }
    };

    // Decision thresholds
    this.APPROVE_THRESHOLD = 65; // Level 1 & 2
    this.FLAG_FOR_REVIEW_THRESHOLD = 50; // Levels 3, 4, 5
  }

  /**
   * Calculate composite risk score from individual component scores
   * 
   * @param {number} soilScore - Soil health score (0-100)
   * @param {number} weatherScore - Weather risk score (0-100)
   * @param {number} cropScore - Crop health score (0-100)
   * @returns {number} Composite score normalized to 0-100
   */
  calculateCompositeScore(soilScore, weatherScore, cropScore) {
    // Validate inputs
    if (soilScore < 0 || soilScore > 100) {
      throw new Error(`Invalid soil score: ${soilScore}`);
    }
    if (weatherScore < 0 || weatherScore > 100) {
      throw new Error(`Invalid weather score: ${weatherScore}`);
    }
    if (cropScore < 0 || cropScore > 100) {
      throw new Error(`Invalid crop score: ${cropScore}`);
    }

    // Apply weighted average
    const compositeScore =
      (soilScore * this.SOIL_WEIGHT) +
      (weatherScore * this.WEATHER_WEIGHT) +
      (cropScore * this.CROP_WEIGHT);

    return Math.round(compositeScore);
  }

  /**
   * Classify composite score into risk level (1-5)
   * 
   * Level 1: 80-100 (Very Low Risk) - Excellent conditions
   * Level 2: 65-79  (Low Risk)       - Good conditions
   * Level 3: 50-64  (Moderate Risk)  - Fair conditions, monitoring needed
   * Level 4: 35-49  (High Risk)      - Poor conditions, intervention needed
   * Level 5: 0-34   (Very High Risk) - Critical conditions, immediate action
   * 
   * @param {number} compositeScore - Composite risk score
   * @returns {number} Risk level (1-5)
   */
  getRiskLevel(compositeScore) {
    for (let level = 1; level <= 5; level++) {
      const range = this.RISK_LEVELS[level].range;
      if (compositeScore >= range[0] && compositeScore <= range[1]) {
        return level;
      }
    }
    return 5; // Default to highest risk
  }

  /**
   * Get risk level name and description
   * @param {number} riskLevel - Risk level (1-5)
   * @returns {object} Risk level information
   */
  getRiskLevelInfo(riskLevel) {
    return this.RISK_LEVELS[riskLevel] || this.RISK_LEVELS[5];
  }

  /**
   * DECISION ENGINE
   * 
   * Produces actionable decision based on risk level:
   * - APPROVED: Levels 1-2 (score >= 65)
   *   Safe to proceed with normal agricultural operations
   * 
   * - FLAGGED FOR REVIEW: Levels 3-5 (score < 65)
   *   Manual review recommended; conditions require intervention/monitoring
   * 
   * @param {number} riskLevel - Risk level (1-5)
   * @returns {object} Decision information
   */
  makeDecision(riskLevel) {
    const decision = {
      approved: riskLevel <= 2,
      status: riskLevel <= 2 ? 'APPROVED' : 'FLAGGED FOR REVIEW',
      riskLevel: riskLevel,
      recommendation: this._getRecommendation(riskLevel)
    };

    return decision;
  }

  /**
   * Generate actionable recommendation based on risk level
   * @private
   */
  _getRecommendation(riskLevel) {
    const recommendations = {
      1: 'Conditions are optimal. Continue standard operations.',
      2: 'Conditions are favorable. Monitor routine parameters.',
      3: 'Conditions are fair. Increase monitoring frequency. Consider preventive measures.',
      4: 'Conditions are poor. Implement intervention strategies. Contact agricultural expert.',
      5: 'Conditions are critical. Immediate action required. Consult specialist immediately.'
    };

    return recommendations[riskLevel] || recommendations[5];
  }
}

/**
 * UNIFIED RISK ASSESSMENT SYSTEM
 * 
 * Orchestrates the complete risk assessment workflow:
 * 1. Collects input data (soil, weather, crop)
 * 2. Calculates individual scores
 * 3. Computes composite score
 * 4. Classifies risk level
 * 5. Makes decision
 * 6. Returns comprehensive output
 * 
 * This is the main interface for using the risk scoring engine.
 */
class RiskScoringEngine {
  constructor() {
    this.soilScorer = new SoilScorer();
    this.weatherScorer = new WeatherScorer();
    this.cropScorer = new CropHealthScorer();
    this.compositeEngine = new CompositeRiskEngine();
  }

  /**
   * Perform comprehensive risk assessment
   * 
   * @param {object} soilData - {pH, moisture, nutrient}
   * @param {object} weatherData - {temperature, humidity, rainfall}
   * @param {object} cropData - {previousDiseaseRiskScore, pastDiseaseOccurrences}
   * @returns {object} Complete risk assessment with all scores and decision
   */
  assessRisk(soilData, weatherData, cropData) {
    try {
      // Calculate individual scores
      const soilScore = this.soilScorer.calculateScore(
        soilData.pH,
        soilData.moisture,
        soilData.nutrient
      );

      const weatherScore = this.weatherScorer.calculateScore(
        weatherData.temperature,
        weatherData.humidity,
        weatherData.rainfall
      );

      const cropScore = this.cropScorer.calculateScore(
        cropData.previousDiseaseRiskScore,
        cropData.pastDiseaseOccurrences
      );

      // Calculate composite score
      const compositeScore = this.compositeEngine.calculateCompositeScore(
        soilScore,
        weatherScore,
        cropScore
      );

      // Determine risk level
      const riskLevel = this.compositeEngine.getRiskLevel(compositeScore);
      const riskLevelInfo = this.compositeEngine.getRiskLevelInfo(riskLevel);

      // Make decision
      const decision = this.compositeEngine.makeDecision(riskLevel);

      // Compile comprehensive output
      const assessment = {
        timestamp: new Date().toISOString(),
        inputs: {
          soil: soilData,
          weather: weatherData,
          crop: cropData
        },
        scores: {
          soil: soilScore,
          weather: weatherScore,
          crop: cropScore,
          composite: compositeScore
        },
        riskLevel: riskLevel,
        riskLevelName: riskLevelInfo.name,
        decision: decision.status,
        recommendation: decision.recommendation,
        details: {
          approved: decision.approved,
          reviewRequired: !decision.approved
        }
      };

      return assessment;
    } catch (error) {
      throw new Error(`Risk assessment failed: ${error.message}`);
    }
  }
}

// Export all components for modular use
module.exports = {
  SoilScorer,
  WeatherScorer,
  CropHealthScorer,
  CompositeRiskEngine,
  RiskScoringEngine
};
