/**
 * RISK SCORING ENGINE - COMPREHENSIVE DEMO & TEST FILE
 * 
 * This file demonstrates the complete Risk Scoring Engine functionality:
 * 1. Creating sample farm data with realistic agricultural conditions
 * 2. Running risk assessments
 * 3. Storing results in database
 * 4. Generating reports
 * 5. Analyzing trends
 * 
 * SAMPLE DATA SCENARIOS:
 * =====================
 * 
 * Farm 1 (OPTIMAL CONDITIONS):
 * - Soil: Perfect pH, moisture, nutrients
 * - Weather: Ideal temperature and humidity
 * - Crop: Excellent health history
 * Expected: Risk Level 1 (Very Low) → APPROVED
 * 
 * Farm 2 (MODERATE CHALLENGES):
 * - Soil: pH slightly off, moisture acceptable
 * - Weather: High humidity increases disease risk
 * - Crop: Some history of disease
 * Expected: Risk Level 3 (Moderate) → FLAGGED FOR REVIEW
 * 
 * Farm 3 (CRITICAL CONDITION):
 * - Soil: Poor nutrients, moisture imbalance
 * - Weather: Excessive rainfall, high humidity
 * - Crop: Multiple past disease occurrences
 * Expected: Risk Level 5 (Very High) → FLAGGED FOR REVIEW
 */

const { RiskScoringEngine } = require('./riskScorer');
const RiskAssessmentService = require('./service');

/**
 * REALISTIC AGRICULTURAL DATA
 * 
 * These sample datasets represent real-world farm conditions:
 */

const SAMPLE_FARMS = {
  // SCENARIO 1: High-performing farm with excellent conditions
  farm_optimal: {
    farmId: 'farm_optimal_001',
    name: 'Sunrise Orchards - Block A',
    location: 'California Valley',
    cropType: 'Apple Orchard',
    soilData: {
      pH: 6.5,          // Perfect - center of ideal range (6.0-7.0)
      moisture: 30,      // Perfect - center of ideal range (25-35%)
      nutrient: 3.0      // Perfect - center of ideal range (2.5-3.5)
    },
    weatherData: {
      temperature: 25,   // Ideal - center of optimal range (20-30°C)
      humidity: 55,      // Ideal - center of optimal range (40-70%)
      rainfall: 150      // Ideal - center of optimal range (100-200mm)
    },
    cropData: {
      previousDiseaseRiskScore: 15,    // Very good - low historical risk
      pastDiseaseOccurrences: 0        // Excellent - no history of disease
    },
    expectedRiskLevel: 1,
    expectedDecision: 'APPROVED'
  },

  // SCENARIO 2: Farm with moderate challenges requiring monitoring
  farm_moderate: {
    farmId: 'farm_moderate_001',
    name: 'Hillside Vineyard - South Section',
    location: 'Napa Valley',
    cropType: 'Grapes',
    soilData: {
      pH: 5.8,           // Slightly low - below ideal but manageable
      moisture: 32,      // Good - upper end of ideal range
      nutrient: 2.3      // Acceptable - slightly below ideal
    },
    weatherData: {
      temperature: 28,   // Good - within ideal range
      humidity: 75,      // Elevated - above ideal, increases fungal risk
      rainfall: 180      // Good - within ideal range
    },
    cropData: {
      previousDiseaseRiskScore: 45,    // Moderate - some historical concerns
      pastDiseaseOccurrences: 2        // Some history of disease events
    },
    expectedRiskLevel: 3,
    expectedDecision: 'FLAGGED FOR REVIEW'
  },

  // SCENARIO 3: Farm in crisis - critical conditions requiring immediate action
  farm_critical: {
    farmId: 'farm_critical_001',
    name: 'Desert Citrus - Northern Plot',
    location: 'Arizona Desert',
    cropType: 'Citrus',
    soilData: {
      pH: 4.2,           // Acidic - well below ideal range (6.0-7.0)
      moisture: 18,      // Dry - below ideal range (25-35%)
      nutrient: 1.5      // Poor - significantly below ideal (2.5-3.5)
    },
    weatherData: {
      temperature: 38,   // Hot - above ideal range (20-30°C), heat stress
      humidity: 85,      // High - above ideal, fungal disease risk
      rainfall: 320      // Excessive - above ideal, flooding risk
    },
    cropData: {
      previousDiseaseRiskScore: 75,    // Poor - high historical risk
      pastDiseaseOccurrences: 6        // Serious - multiple disease events
    },
    expectedRiskLevel: 5,
    expectedDecision: 'FLAGGED FOR REVIEW'
  },

  // SCENARIO 4: Good farm with one risk factor
  farm_mixed: {
    farmId: 'farm_mixed_001',
    name: 'Prairie Crops - East Field',
    location: 'Iowa',
    cropType: 'Corn',
    soilData: {
      pH: 6.8,           // Good - center of ideal range
      moisture: 28,      // Good - within ideal range
      nutrient: 3.2      // Good - within ideal range
    },
    weatherData: {
      temperature: 22,   // Ideal - within optimal range
      humidity: 82,      // High - above ideal, disease risk present
      rainfall: 200      // Good - within ideal range
    },
    cropData: {
      previousDiseaseRiskScore: 35,    // Fair - some historical concerns
      pastDiseaseOccurrences: 1        // Minimal - one past event
    },
    expectedRiskLevel: 3,
    expectedDecision: 'FLAGGED FOR REVIEW'
  }
};

/**
 * DEMONSTRATION FUNCTIONS
 */

/**
 * Initialize and run comprehensive demo
 */
async function runComprehensiveDemo() {
  console.log('\n' + '='.repeat(80));
  console.log('RISK SCORING ENGINE - COMPREHENSIVE DEMONSTRATION');
  console.log('Smart Agriculture Risk Assessment System');
  console.log('='.repeat(80) + '\n');

  // Initialize service
  const service = new RiskAssessmentService();
  await service.initialize();

  // Run assessments for each sample farm
  const results = {};

  for (const [farmKey, farmData] of Object.entries(SAMPLE_FARMS)) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`FARM ASSESSMENT: ${farmData.name}`);
    console.log(`Location: ${farmData.location} | Crop Type: ${farmData.cropType}`);
    console.log('─'.repeat(80));

    // Display input data
    displayInputData(farmData);

    try {
      // Perform assessment
      const result = await service.assessFarm(
        farmData.farmId,
        farmData.soilData,
        farmData.weatherData,
        farmData.cropData
      );

      if (result.success) {
        results[farmKey] = result;

        // Display comprehensive results
        displayAssessmentResults(result.assessment);

        // Verify against expected outcome
        verifyExpectedOutcome(farmData, result.assessment);
      } else {
        console.error(`❌ Assessment failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error during assessment: ${error.message}`);
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(80) + '\n');
  generateSummaryReport(results);

  // Test individual scorers for educational insight
  console.log('\n' + '='.repeat(80));
  console.log('EDUCATIONAL BREAKDOWN - Component Scoring');
  console.log('='.repeat(80) + '\n');
  demonstrateComponentScoring();

  // Cleanup
  await service.shutdown();
}

/**
 * Display input data in formatted table
 */
function displayInputData(farmData) {
  console.log('\nINPUT DATA:');
  console.log('─'.repeat(80));

  console.log('\n📍 SOIL DATA:');
  console.log(`   pH Level:        ${farmData.soilData.pH} (Ideal: 6.0-7.0)`);
  console.log(`   Moisture:        ${farmData.soilData.moisture}% (Ideal: 25-35%)`);
  console.log(`   Nutrient Level:  ${farmData.soilData.nutrient} (Ideal: 2.5-3.5)`);

  console.log('\n🌤️  WEATHER DATA:');
  console.log(`   Temperature:     ${farmData.weatherData.temperature}°C (Ideal: 20-30°C)`);
  console.log(`   Humidity:        ${farmData.weatherData.humidity}% (Ideal: 40-70%)`);
  console.log(`   Rainfall:        ${farmData.weatherData.rainfall}mm (Ideal: 100-200mm)`);

  console.log('\n🌾 CROP HEALTH DATA:');
  console.log(`   Previous Risk Score:     ${farmData.cropData.previousDiseaseRiskScore} (0-100, lower is better)`);
  console.log(`   Past Disease Events:     ${farmData.cropData.pastDiseaseOccurrences}`);
}

/**
 * Display assessment results
 */
function displayAssessmentResults(assessment) {
  console.log('\n📊 CALCULATED SCORES:');
  console.log('─'.repeat(80));

  console.log(`\n   Soil Score (40% weight):      ${assessment.scores.soil}/100`);
  console.log(`   Weather Score (30% weight):   ${assessment.scores.weather}/100`);
  console.log(`   Crop Score (30% weight):      ${assessment.scores.crop}/100`);

  const weights = [
    (assessment.scores.soil * 0.40),
    (assessment.scores.weather * 0.30),
    (assessment.scores.crop * 0.30)
  ];

  console.log(`\n   Weighted Contributions:
     Soil:    ${weights[0].toFixed(1)} points
     Weather: ${weights[1].toFixed(1)} points
     Crop:    ${weights[2].toFixed(1)} points`);

  console.log(`\n   ✓ COMPOSITE SCORE: ${assessment.scores.composite}/100`);

  console.log('\n🎯 RISK CLASSIFICATION:');
  console.log('─'.repeat(80));

  const riskLevelInfo = {
    1: '✓ Very Low Risk',
    2: '✓ Low Risk',
    3: '⚠ Moderate Risk',
    4: '⚠ High Risk',
    5: '❌ Very High Risk'
  };

  console.log(`\n   Risk Level: ${assessment.riskLevel} - ${assessment.riskLevelName}`);
  console.log(`   Decision:   ${assessment.decision}`);
  console.log(`\n   Recommendation: ${assessment.recommendation}`);

  console.log('\n📋 TIMESTAMP: ' + assessment.timestamp);
}

/**
 * Verify results match expected outcomes
 */
function verifyExpectedOutcome(farmData, assessment) {
  console.log('\n✅ VERIFICATION:');
  console.log('─'.repeat(80));

  const riskMatch = assessment.riskLevel === farmData.expectedRiskLevel;
  const decisionMatch = assessment.decision === farmData.expectedDecision;

  console.log(`   Expected Risk Level: ${farmData.expectedRiskLevel} | Actual: ${assessment.riskLevel} | ${riskMatch ? '✓ PASS' : '❌ FAIL'}`);
  console.log(`   Expected Decision: ${farmData.expectedDecision} | Actual: ${assessment.decision} | ${decisionMatch ? '✓ PASS' : '❌ FAIL'}`);
}

/**
 * Generate summary report
 */
function generateSummaryReport(results) {
  const assessments = Object.values(results).map(r => r.assessment);

  const approved = assessments.filter(a => a.decision === 'APPROVED').length;
  const flagged = assessments.filter(a => a.decision === 'FLAGGED FOR REVIEW').length;

  const avgScore = Math.round(
    assessments.reduce((sum, a) => sum + a.scores.composite, 0) / assessments.length
  );

  console.log('📈 ASSESSMENT SUMMARY:');
  console.log(`   Total Assessments:    ${assessments.length}`);
  console.log(`   Approved:             ${approved} (${Math.round(approved / assessments.length * 100)}%)`);
  console.log(`   Flagged for Review:   ${flagged} (${Math.round(flagged / assessments.length * 100)}%)`);
  console.log(`   Average Risk Score:   ${avgScore}/100`);

  console.log('\n📊 RISK LEVEL DISTRIBUTION:');
  for (let level = 1; level <= 5; level++) {
    const count = assessments.filter(a => a.riskLevel === level).length;
    const names = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
    const bar = '█'.repeat(count * 10);
    console.log(`   Level ${level} (${names[level - 1]}): ${bar} ${count}`);
  }
}

/**
 * Demonstrate individual component scoring
 * Educational breakdown showing how each scorer works
 */
function demonstrateComponentScoring() {
  const { SoilScorer, WeatherScorer, CropHealthScorer } = require('./riskScorer');

  console.log('This section shows how individual scorers calculate their components:\n');

  // SOIL SCORING EXAMPLE
  console.log('1️⃣  SOIL SCORER - Example Calculation:');
  console.log('─'.repeat(80));

  const soilScorer = new SoilScorer();

  const soilExamples = [
    { pH: 6.5, moisture: 30, nutrient: 3.0, description: 'Optimal' },
    { pH: 5.0, moisture: 20, nutrient: 2.0, description: 'Poor' },
    { pH: 8.5, moisture: 50, nutrient: 1.0, description: 'Critical' }
  ];

  soilExamples.forEach(ex => {
    const score = soilScorer.calculateScore(ex.pH, ex.moisture, ex.nutrient);
    console.log(`   ${ex.description}: pH=${ex.pH}, Moisture=${ex.moisture}%, Nutrient=${ex.nutrient} → Score: ${score}/100`);
  });

  // WEATHER SCORING EXAMPLE
  console.log('\n2️⃣  WEATHER SCORER - Example Calculation:');
  console.log('─'.repeat(80));

  const weatherScorer = new WeatherScorer();

  const weatherExamples = [
    { temp: 25, humidity: 55, rainfall: 150, description: 'Optimal' },
    { temp: 35, humidity: 80, rainfall: 300, description: 'Poor' },
    { temp: 10, humidity: 30, rainfall: 50, description: 'Critical' }
  ];

  weatherExamples.forEach(ex => {
    const score = weatherScorer.calculateScore(ex.temp, ex.humidity, ex.rainfall);
    console.log(`   ${ex.description}: Temp=${ex.temp}°C, Humidity=${ex.humidity}%, Rainfall=${ex.rainfall}mm → Score: ${score}/100`);
  });

  // CROP HEALTH SCORING EXAMPLE
  console.log('\n3️⃣  CROP HEALTH SCORER - Example Calculation:');
  console.log('─'.repeat(80));

  const cropScorer = new CropHealthScorer();

  const cropExamples = [
    { prevRisk: 20, occurrences: 0, description: 'Excellent' },
    { prevRisk: 50, occurrences: 2, description: 'Fair' },
    { prevRisk: 80, occurrences: 5, description: 'Poor' }
  ];

  cropExamples.forEach(ex => {
    const score = cropScorer.calculateScore(ex.prevRisk, ex.occurrences);
    console.log(`   ${ex.description}: PrevRisk=${ex.prevRisk}, PastEvents=${ex.occurrences} → Score: ${score}/100`);
  });

  // RISK LEVEL THRESHOLDS
  console.log('\n4️⃣  RISK LEVEL CLASSIFICATION - Thresholds:');
  console.log('─'.repeat(80));

  const thresholds = [
    { level: 1, name: 'Very Low Risk', range: '80-100', decision: 'APPROVED' },
    { level: 2, name: 'Low Risk', range: '65-79', decision: 'APPROVED' },
    { level: 3, name: 'Moderate Risk', range: '50-64', decision: 'FLAGGED' },
    { level: 4, name: 'High Risk', range: '35-49', decision: 'FLAGGED' },
    { level: 5, name: 'Very High Risk', range: '0-34', decision: 'FLAGGED' }
  ];

  thresholds.forEach(t => {
    console.log(`   Level ${t.level}: ${t.name.padEnd(20)} (${t.range.padEnd(8)}) → ${t.decision}`);
  });

  console.log('\n5️⃣  COMPOSITE SCORE CALCULATION - Weight Distribution:');
  console.log('─'.repeat(80));
  console.log('   Soil Score:        40% weight (Foundation of agriculture)');
  console.log('   Weather Score:     30% weight (Environmental conditions)');
  console.log('   Crop Health Score: 30% weight (Historical susceptibility)');
  console.log('\n   Formula: CompositeScore = (Soil × 0.40) + (Weather × 0.30) + (Crop × 0.30)');
}

/**
 * QUICK TEST - Minimal example
 */
async function runQuickTest() {
  console.log('\n' + '='.repeat(80));
  console.log('QUICK TEST - Single Assessment');
  console.log('='.repeat(80) + '\n');

  const engine = new RiskScoringEngine();

  const soilData = {
    pH: 6.5,
    moisture: 30,
    nutrient: 3.0
  };

  const weatherData = {
    temperature: 25,
    humidity: 55,
    rainfall: 150
  };

  const cropData = {
    previousDiseaseRiskScore: 20,
    pastDiseaseOccurrences: 0
  };

  try {
    const assessment = engine.assessRisk(soilData, weatherData, cropData);

    console.log('Assessment Result:');
    console.log(JSON.stringify(assessment, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * EXPORT FOR TESTING
 */
module.exports = {
  runComprehensiveDemo,
  runQuickTest,
  SAMPLE_FARMS,
  displayInputData,
  displayAssessmentResults,
  demonstrateComponentScoring
};

/**
 * MAIN EXECUTION
 * 
 * Uncomment to run demo directly:
 * node demo.js
 */
if (require.main === module) {
  // Run comprehensive demo
  runComprehensiveDemo().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
