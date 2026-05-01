/**
 * DATABASE STORAGE MODULE - Risk Assessment Data Persistence
 * 
 * Manages all database operations for the Risk Scoring Engine:
 * - Store risk assessments with complete audit trail
 * - Retrieve historical assessments for analysis
 * - Maintain data integrity and timestamping
 * 
 * Uses Prisma ORM for database abstraction and type safety
 * Database: PostgreSQL (configured in backend/.env)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * DATABASE SCHEMA NOTES:
 * 
 * The RiskAssessment table stores:
 * - id: Unique identifier for each assessment
 * - farmId: Reference to the farm/orchard being assessed
 * - timestamp: When the assessment was performed
 * - 
 * - INPUTS (recorded for audit trail):
 *   - Soil: pH, moisture, nutrient values
 *   - Weather: temperature, humidity, rainfall
 *   - Crop: previousDiseaseRiskScore, pastDiseaseOccurrences
 * 
 * - OUTPUTS (computed scores):
 *   - soilScore, weatherScore, cropScore (individual: 0-100)
 *   - compositeScore: Final weighted average (0-100)
 * 
 * - DECISION:
 *   - riskLevel: Classification 1-5
 *   - decision: "APPROVED" or "FLAGGED FOR REVIEW"
 *   - recommendation: Actionable guidance
 * 
 * - AUDIT TRAIL:
 *   - createdAt: Timestamp
 *   - status: Record status ("completed", "flagged", "under_review")
 */

class RiskAssessmentDatabase {
  constructor() {
    this.prisma = prisma;
  }

  /**
   * Initialize database schema
   * Creates RiskAssessment table if it doesn't exist
   * 
   * NOTE: In production, use proper Prisma migrations
   * This is for development/setup purposes
   */
  async initializeDatabase() {
    try {
      console.log('Initializing Risk Assessment database...');

      // Create table using raw SQL - alternative to migrations
      // In production, use: npx prisma migrate dev --name create_risk_assessment
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "RiskAssessment" (
          "id" SERIAL PRIMARY KEY,
          "farmId" TEXT NOT NULL,
          
          -- INPUT DATA (Soil)
          "soilPH" DECIMAL(3,1) NOT NULL,
          "soilMoisture" DECIMAL(5,2) NOT NULL,
          "soilNutrient" DECIMAL(3,1) NOT NULL,
          
          -- INPUT DATA (Weather)
          "weatherTemperature" DECIMAL(5,2) NOT NULL,
          "weatherHumidity" DECIMAL(5,2) NOT NULL,
          "weatherRainfall" DECIMAL(7,2) NOT NULL,
          
          -- INPUT DATA (Crop)
          "cropPreviousDiseaseRiskScore" INTEGER NOT NULL,
          "cropPastDiseaseOccurrences" INTEGER NOT NULL,
          
          -- OUTPUT SCORES
          "soilScore" INTEGER NOT NULL,
          "weatherScore" INTEGER NOT NULL,
          "cropScore" INTEGER NOT NULL,
          "compositeScore" INTEGER NOT NULL,
          
          -- RISK CLASSIFICATION
          "riskLevel" INTEGER NOT NULL,
          "riskLevelName" TEXT NOT NULL,
          "decision" TEXT NOT NULL,
          "recommendation" TEXT NOT NULL,
          
          -- AUDIT TRAIL
          "status" TEXT DEFAULT 'completed',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create index on farmId for faster queries
        CREATE INDEX IF NOT EXISTS "idx_farm_id" ON "RiskAssessment"("farmId");
        
        -- Create index on timestamp for time-series queries
        CREATE INDEX IF NOT EXISTS "idx_created_at" ON "RiskAssessment"("createdAt");
      `;

      await this.prisma.$executeRawUnsafe(createTableSQL);
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "risk_assessments" (
          "id" SERIAL PRIMARY KEY,
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
          "status" TEXT DEFAULT 'completed',
          "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Database schema initialized');
      return true;
    } catch (error) {
      console.error('Database initialization error:', error.message);
      // Don't throw - table might already exist
      return false;
    }
  }

  /**
   * Store a risk assessment record in database
   * 
   * @param {string} farmId - Unique farm identifier
   * @param {object} assessment - Complete assessment object from RiskScoringEngine
   * @returns {object} Stored record with database ID
   */
  async storeAssessment(farmId, assessment) {
    try {
      const record = await this.prisma.riskAssessment.create({
        data: {
          farmId: farmId,

          // Store input data
          soilPH: parseFloat(assessment.inputs.soil.pH),
          soilMoisture: parseFloat(assessment.inputs.soil.moisture),
          soilNutrient: parseFloat(assessment.inputs.soil.nutrient),

          weatherTemperature: parseFloat(assessment.inputs.weather.temperature),
          weatherHumidity: parseFloat(assessment.inputs.weather.humidity),
          weatherRainfall: parseFloat(assessment.inputs.weather.rainfall),

          cropPreviousDiseaseRiskScore: parseInt(assessment.inputs.crop.previousDiseaseRiskScore),
          cropPastDiseaseOccurrences: parseInt(assessment.inputs.crop.pastDiseaseOccurrences),

          // Store calculated scores
          soilScore: parseInt(assessment.scores.soil),
          weatherScore: parseInt(assessment.scores.weather),
          cropScore: parseInt(assessment.scores.crop),
          compositeScore: parseInt(assessment.scores.composite),

          // Store decision
          riskLevel: parseInt(assessment.riskLevel),
          riskLevelName: assessment.riskLevelName,
          decision: assessment.decision,
          recommendation: assessment.recommendation,

          // Status
          status: assessment.decision === 'APPROVED' ? 'completed' : 'flagged'
        }
      });

      console.log(`✓ Assessment stored (ID: ${record.id}) for farm: ${farmId}`);
      return record;
    } catch (error) {
      console.error('Error storing assessment:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve assessment history for a specific farm
   * 
   * @param {string} farmId - Farm identifier
   * @param {number} limit - Maximum number of records (default: 10)
   * @returns {array} Array of historical assessments
   */
  async getAssessmentHistory(farmId, limit = 10) {
    try {
      const history = await this.prisma.riskAssessment.findMany({
        where: { farmId: farmId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return history;
    } catch (error) {
      console.error('Error retrieving history:', error.message);
      throw error;
    }
  }

  /**
   * Get latest assessment for a farm
   * Useful for current status dashboard
   * 
   * @param {string} farmId - Farm identifier
   * @returns {object} Most recent assessment
   */
  async getLatestAssessment(farmId) {
    try {
      const latest = await this.prisma.riskAssessment.findFirst({
        where: { farmId: farmId },
        orderBy: { createdAt: 'desc' }
      });

      return latest;
    } catch (error) {
      console.error('Error retrieving latest assessment:', error.message);
      throw error;
    }
  }

  /**
   * Get all flagged assessments for review
   * Returns assessments requiring manual intervention
   * 
   * @param {number} limit - Maximum records to return
   * @returns {array} Flagged assessments
   */
  async getFlaggedAssessments(limit = 50) {
    try {
      const flagged = await this.prisma.riskAssessment.findMany({
        where: { status: 'flagged' },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return flagged;
    } catch (error) {
      console.error('Error retrieving flagged assessments:', error.message);
      throw error;
    }
  }

  /**
   * Get statistics for a farm's assessments
   * Useful for trend analysis
   * 
   * @param {string} farmId - Farm identifier
   * @returns {object} Statistics including averages, trends
   */
  async getAssessmentStatistics(farmId) {
    try {
      const assessments = await this.prisma.riskAssessment.findMany({
        where: { farmId: farmId },
        orderBy: { createdAt: 'desc' },
        take: 30 // Last 30 assessments
      });

      if (assessments.length === 0) {
        return null;
      }

      // Calculate statistics
      const soilScores = assessments.map(a => a.soilScore);
      const weatherScores = assessments.map(a => a.weatherScore);
      const cropScores = assessments.map(a => a.cropScore);
      const compositeScores = assessments.map(a => a.compositeScore);

      const stats = {
        totalAssessments: assessments.length,
        averages: {
          soilScore: Math.round(soilScores.reduce((a, b) => a + b, 0) / soilScores.length),
          weatherScore: Math.round(weatherScores.reduce((a, b) => a + b, 0) / weatherScores.length),
          cropScore: Math.round(cropScores.reduce((a, b) => a + b, 0) / cropScores.length),
          compositeScore: Math.round(compositeScores.reduce((a, b) => a + b, 0) / compositeScores.length)
        },
        trends: {
          soilTrend: this._calculateTrend(soilScores),
          weatherTrend: this._calculateTrend(weatherScores),
          cropTrend: this._calculateTrend(cropScores),
          compositeTrend: this._calculateTrend(compositeScores)
        },
        flaggedCount: assessments.filter(a => a.status === 'flagged').length,
        latestAssessment: assessments[0]
      };

      return stats;
    } catch (error) {
      console.error('Error calculating statistics:', error.message);
      throw error;
    }
  }

  /**
   * Calculate trend (improving/declining/stable)
   * @private
   */
  _calculateTrend(scores) {
    if (scores.length < 2) return 'insufficient_data';

    const recent = scores.slice(0, 5); // Last 5 scores
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = scores.slice(5, 10); // Previous 5 scores
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const change = recentAvg - olderAvg;
    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * Update assessment status (e.g., mark as reviewed)
   * 
   * @param {number} assessmentId - Assessment ID
   * @param {string} newStatus - New status ("completed", "flagged", "under_review", "resolved")
   * @returns {object} Updated record
   */
  async updateAssessmentStatus(assessmentId, newStatus) {
    try {
      const updated = await this.prisma.riskAssessment.update({
        where: { id: parseInt(assessmentId) },
        data: {
          status: newStatus,
          updatedAt: new Date()
        }
      });

      return updated;
    } catch (error) {
      console.error('Error updating status:', error.message);
      throw error;
    }
  }

  /**
   * Delete old assessments (archive/cleanup)
   * Keeps database lean by removing old records
   * 
   * @param {number} daysToKeep - Number of days of history to maintain
   * @returns {number} Number of records deleted
   */
  async archiveOldAssessments(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await this.prisma.riskAssessment.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      console.log(`✓ Archived ${deleted.count} old assessments`);
      return deleted.count;
    } catch (error) {
      console.error('Error archiving assessments:', error.message);
      throw error;
    }
  }

  /**
   * Close database connection
   * Call when application shuts down
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = RiskAssessmentDatabase;
