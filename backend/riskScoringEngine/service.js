/**
 * TRUST SCORE SERVICE
 *
 * This service contains two layers:
 * 1. The academic soil/weather/crop RiskScoringEngine already present in riskScorer.js.
 * 2. The live claim Trust Score workflow used by FarmTrust insurance claims.
 *
 * The claim workflow produces five normalized component scores in the range 0..1:
 * N = NDVI stress score, G = GPS validation score, T = temporal progression score,
 * W = weather plausibility score, P = peer corroboration score.
 */

const crypto = require('crypto');
const axios = require('axios');
const { Prisma } = require('@prisma/client');
const { RiskScoringEngine } = require('./riskScorer');
const RiskAssessmentDatabase = require('./database');
const prisma = require('../config/prisma');

const NDVI_SERVICE_URL = process.env.NDVI_SERVICE_URL || 'http://localhost:8000';
const OPEN_METEO_API_URL = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1';
const MIN_GPS_POINTS = 5;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function decimalScore(value) {
  return new Prisma.Decimal(clamp01(value).toFixed(3));
}

function normalizeDiseaseType(value) {
  return String(value || 'unknown').trim().toLowerCase();
}

function extractPolygonPoints(gpsPolygon) {
  const polygon = typeof gpsPolygon === 'string' ? JSON.parse(gpsPolygon) : gpsPolygon;
  const coordinates = Array.isArray(polygon?.coordinates?.[0])
    ? polygon.coordinates[0]
    : Array.isArray(polygon?.coordinates)
      ? polygon.coordinates
      : Array.isArray(polygon)
        ? polygon
        : [];

  return coordinates
    .map((point) => {
      if (Array.isArray(point)) {
        return { longitude: Number(point[0]), latitude: Number(point[1]) };
      }
      return {
        longitude: Number(point?.longitude ?? point?.lng ?? point?.lon),
        latitude: Number(point?.latitude ?? point?.lat),
      };
    })
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function normalizeGpsPoint(point) {
  return {
    latitude: Number(point?.latitude ?? point?.lat),
    longitude: Number(point?.longitude ?? point?.lng ?? point?.lon),
    accuracy: point?.accuracy === undefined || point?.accuracy === null ? null : Number(point.accuracy),
    timestamp: point?.timestamp || new Date().toISOString(),
  };
}

function pointInPolygon(point, polygonPoints) {
  // Ray-casting algorithm: toggles the inside flag every time a horizontal ray crosses an edge.
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].longitude;
    const yi = polygonPoints[i].latitude;
    const xj = polygonPoints[j].longitude;
    const yj = polygonPoints[j].latitude;
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function centroid(points) {
  if (!points.length) return null;
  const total = points.reduce(
    (accumulator, point) => ({
      latitude: accumulator.latitude + point.latitude,
      longitude: accumulator.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

async function uploadJsonReportToIpfs(report) {
  const reportBody = JSON.stringify(report, null, 2);
  const localHash = `local-report-${crypto.createHash('sha256').update(reportBody).digest('hex')}`;

  if (!process.env.PINATA_JWT || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    return localHash;
  }

  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([Buffer.from(reportBody)], { type: 'application/json' }),
      `trust-score-${report.claimId || 'draft'}.json`,
    );
    formData.append(
      'pinataMetadata',
      JSON.stringify({
        name: `FarmTrust Trust Score Report ${report.claimId || 'draft'}`,
      }),
    );

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      timeout: 30000,
    });

    return response.data?.IpfsHash || localHash;
  } catch (error) {
    console.warn('Trust report IPFS upload failed; using local report hash:', error.message);
    return localHash;
  }
}

class RiskAssessmentService {
  constructor() {
    this.engine = new RiskScoringEngine();
    this.database = new RiskAssessmentDatabase();
  }

  /**
   * Academic/project API: score soil, weather, and crop history inputs.
   */
  async assessFarm(farmId, soilData, weatherData, cropData) {
    try {
      this._validateInputs(farmId, soilData, weatherData, cropData);
      const assessment = this.engine.assessRisk(soilData, weatherData, cropData);
      const storedRecord = await this.database.storeAssessment(String(farmId), assessment);
      return {
        success: true,
        recordId: storedRecord.id,
        assessment,
        storedAt: storedRecord.createdAt,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Production claim workflow:
   * validates farmer ownership, records scan session evidence, calculates the Trust Score,
   * creates a claim, uploads the audit report JSON, and writes all component scores to PostgreSQL.
   */
  async submitClaimWithTrustScore(userId, payload) {
    const farmId = Number(payload.farmId);
    const diseaseType = normalizeDiseaseType(payload.diseaseType);
    const diseaseSeverity = Number(payload.diseaseSeverity ?? 0);
    const sessionId = String(payload.sessionId || crypto.randomUUID());
    const gpsArray = Array.isArray(payload.gpsArray) ? payload.gpsArray.map(normalizeGpsPoint) : [];
    const ipfsHashes = Array.isArray(payload.ipfsHashes)
      ? payload.ipfsHashes.filter(Boolean)
      : payload.diseaseImageHash
        ? [payload.diseaseImageHash]
        : [];

    if (!farmId || !diseaseType || !sessionId) {
      throw new Error('farmId, diseaseType, and sessionId are required');
    }
    if (!Number.isFinite(diseaseSeverity) || diseaseSeverity < 0 || diseaseSeverity > 1) {
      throw new Error('Disease severity must be a number between 0 and 1');
    }
    if (!gpsArray.length || !ipfsHashes.length) {
      throw new Error('gpsArray and ipfsHashes are required for Trust Score evidence');
    }

    const farm = await prisma.farm.findFirst({
      where: { id: farmId, ownerId: userId },
      select: {
        id: true,
        gpsPolygon: true,
        baselineNdvi: true,
        locationLatitude: true,
        locationLongitude: true,
      },
    });

    if (!farm) {
      throw new Error('Farm not found');
    }

    await prisma.scanSession.create({
      data: {
        farmId,
        diseaseType,
        sessionData: sessionId,
        gpsArray,
        ipfsHashes,
      },
    });

    const trust = await this.calculateClaimTrustScore({
      farm,
      farmId,
      diseaseType,
      gpsArray,
      ipfsHashes,
      sessionId,
    });

    const claim = await prisma.claim.create({
      data: {
        farmId,
        policyId: payload.policyId ? Number(payload.policyId) : null,
        diseaseImageHash: ipfsHashes[0] || null,
        diseaseType,
        diseaseSeverity: new Prisma.Decimal(diseaseSeverity.toFixed(2)),
        gpsArray,
        ipfsHashes,
        sessionId,
        ndviVerified: trust.ndvi.currentNdvi !== null,
        ndviBaseline: trust.ndvi.baselineNdvi === null ? null : new Prisma.Decimal(trust.ndvi.baselineNdvi.toFixed(3)),
        ndviCurrent: trust.ndvi.currentNdvi === null ? null : new Prisma.Decimal(trust.ndvi.currentNdvi.toFixed(3)),
        ndviDropPercentage:
          trust.ndvi.dropPercentage === null ? null : new Prisma.Decimal(trust.ndvi.dropPercentage.toFixed(2)),
        trustScore: decimalScore(trust.scores.trustScore),
        nScore: decimalScore(trust.scores.n),
        gScore: decimalScore(trust.scores.g),
        tScore: decimalScore(trust.scores.t),
        wScore: decimalScore(trust.scores.w),
        pScore: decimalScore(trust.scores.p),
        routingTier: trust.routingTier,
        status: trust.status,
        trustReportJson: trust.report,
      },
    });

    const reportWithClaim = {
      ...trust.report,
      claimId: claim.id,
      generatedAt: new Date().toISOString(),
    };
    const trustReportHash = await uploadJsonReportToIpfs(reportWithClaim);

    const updatedClaim = await prisma.claim.update({
      where: { id: claim.id },
      data: {
        trustReportHash,
        trustReportJson: {
          ...reportWithClaim,
          trustReportHash,
        },
      },
    });

    return {
      claim: updatedClaim,
      trustScore: trust.scores.trustScore,
      componentScores: trust.scores,
      routingTier: trust.routingTier,
      status: trust.status,
      reportHash: trustReportHash,
    };
  }

  async calculateClaimTrustScore({ farm, farmId, diseaseType, gpsArray, ipfsHashes, sessionId }) {
    const [ndvi, gps, temporal, weather, peer] = await Promise.all([
      this._calculateNdviScore(farmId, farm.baselineNdvi),
      this._calculateGpsScore(farm.gpsPolygon, gpsArray),
      this._calculateTemporalScore(farmId, diseaseType),
      this._calculateWeatherScore(farm, diseaseType),
      this._calculatePeerScore(farmId, farm.gpsPolygon, diseaseType),
    ]);

    const trustScore = clamp01(
      0.35 * ndvi.score +
      0.25 * gps.score +
      0.20 * temporal.score +
      0.10 * weather.score +
      0.10 * peer.score,
    );

    const routing = this._routeTrustScore(trustScore);
    const scores = {
      n: Number(ndvi.score.toFixed(3)),
      g: Number(gps.score.toFixed(3)),
      t: Number(temporal.score.toFixed(3)),
      w: Number(weather.score.toFixed(3)),
      p: Number(peer.score.toFixed(3)),
      trustScore: Number(trustScore.toFixed(3)),
    };

    const report = {
      farmId,
      sessionId,
      diseaseType,
      ipfsHashes,
      gpsPointCount: gpsArray.length,
      routingTier: routing.routingTier,
      status: routing.status,
      scores,
      ndvi,
      gps,
      temporal,
      weather,
      peer,
      formula: 'TS = (0.35*N) + (0.25*G) + (0.20*T) + (0.10*W) + (0.10*P)',
    };

    return {
      scores,
      routingTier: routing.routingTier,
      status: routing.status,
      ndvi,
      report,
    };
  }

  async _calculateNdviScore(farmId, baselineNdviValue) {
    try {
      const response = await axios.post(
        `${NDVI_SERVICE_URL}/api/ndvi/verify-claim`,
        { farm_id: farmId, current_ndvi: null },
        { timeout: 30000 },
      );
      const baselineNdvi = Number(response.data.ndvi_baseline ?? baselineNdviValue);
      const currentNdvi = Number(response.data.ndvi_current);
      const score = clamp01((baselineNdvi - currentNdvi) / 0.30);
      return {
        score,
        baselineNdvi,
        currentNdvi,
        dropPercentage: Number(response.data.drop_percentage ?? ((baselineNdvi - currentNdvi) / baselineNdvi) * 100),
        source: 'ndvi-service',
      };
    } catch (error) {
      const baselineNdvi = baselineNdviValue === null || baselineNdviValue === undefined ? null : Number(baselineNdviValue);
      console.warn('NDVI Trust Score component unavailable:', error.message);
      return {
        score: 0,
        baselineNdvi,
        currentNdvi: null,
        dropPercentage: null,
        source: 'unavailable',
        warning: error.message,
      };
    }
  }

  _calculateGpsScore(gpsPolygon, gpsArray) {
    const polygonPoints = extractPolygonPoints(gpsPolygon);
    const submittedPoints = gpsArray.filter(
      (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
    );

    if (submittedPoints.length < MIN_GPS_POINTS || polygonPoints.length < 3) {
      return {
        score: 0,
        validPoints: 0,
        totalSubmitted: submittedPoints.length,
        minimumRequired: MIN_GPS_POINTS,
        reason: 'Minimum GPS evidence requirement not met or farm polygon is invalid',
      };
    }

    const validPoints = submittedPoints.filter((point) => pointInPolygon(point, polygonPoints)).length;
    return {
      score: clamp01(validPoints / submittedPoints.length),
      validPoints,
      totalSubmitted: submittedPoints.length,
      minimumRequired: MIN_GPS_POINTS,
    };
  }

  async _calculateTemporalScore(farmId, diseaseType) {
    const result = await prisma.scanSession.findMany({
      where: {
        farmId,
        diseaseType,
        sessionDate: {
          gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      distinct: ['sessionData'],
      select: { sessionData: true },
    });
    const sessionCount = result.length;
    return {
      score: clamp01(sessionCount / 3),
      sessionCount,
      lookbackDays: 14,
    };
  }

  async _calculateWeatherScore(farm, diseaseType) {
    const farmPoints = extractPolygonPoints(farm.gpsPolygon);
    const center =
      farm.locationLatitude && farm.locationLongitude
        ? { latitude: Number(farm.locationLatitude), longitude: Number(farm.locationLongitude) }
        : centroid(farmPoints);

    if (!center) {
      return { score: 0, reason: 'Farm centroid unavailable' };
    }

    try {
      const [profile, meteo] = await Promise.all([
        prisma.diseaseWeatherProfile.findFirst({
          where: { diseaseType },
        }),
        axios.get(`${OPEN_METEO_API_URL}/forecast`, {
          params: {
            latitude: center.latitude,
            longitude: center.longitude,
            daily: 'temperature_2m_max,precipitation_sum',
            past_days: 14,
            forecast_days: 1,
            timezone: 'auto',
          },
          timeout: 20000,
        }),
      ]);

      const daily = meteo.data?.daily || {};
      const tempValues = (daily.temperature_2m_max || []).map(Number).filter(Number.isFinite);
      const precipitationValues = (daily.precipitation_sum || []).map(Number).filter(Number.isFinite);
      const tempMax = tempValues.length ? Math.max(...tempValues) : null;
      const precipitationSum = precipitationValues.reduce((sum, value) => sum + value, 0);

      if (!profile) {
        return {
          score: 0.5,
          tempMax,
          precipitationSum,
          reason: 'Disease weather profile missing; neutral partial score applied',
        };
      }

      const checks = [
        tempMax !== null && tempMax >= Number(profile.tempMin ?? -Infinity) && tempMax <= Number(profile.tempMax ?? Infinity),
        precipitationSum >= Number(profile.precipitationMin ?? -Infinity) &&
          precipitationSum <= Number(profile.precipitationMax ?? Infinity),
      ];
      const matched = checks.filter(Boolean).length;
      const score = matched === checks.length ? 1 : matched > 0 ? 0.5 : 0;

      return {
        score,
        tempMax,
        precipitationSum,
        pastDays: 14,
        profile: {
          diseaseType: profile.diseaseType,
          tempMin: profile.tempMin === null ? null : Number(profile.tempMin),
          tempMax: profile.tempMax === null ? null : Number(profile.tempMax),
          precipitationMin: profile.precipitationMin === null ? null : Number(profile.precipitationMin),
          precipitationMax: profile.precipitationMax === null ? null : Number(profile.precipitationMax),
        },
      };
    } catch (error) {
      console.warn('Weather Trust Score component unavailable:', error.message);
      return { score: 0, reason: error.message };
    }
  }

  async _calculatePeerScore(farmId, gpsPolygon, diseaseType) {
    const refCenter = centroid(extractPolygonPoints(gpsPolygon));
    if (!refCenter) {
      return { score: 0, neighborCount: 0, reason: 'Farm polygon unavailable' };
    }

    const recentClaims = await prisma.claim.findMany({
      where: {
        farmId: { not: farmId },
        diseaseType,
        createdAt: {
          gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        farm: {
          select: { gpsPolygon: true },
        },
      },
    });

    const neighborCount = recentClaims.filter((claim) => {
      const claimCenter = centroid(extractPolygonPoints(claim.farm.gpsPolygon));
      return claimCenter && distanceMeters(refCenter, claimCenter) <= 500;
    }).length;

    return {
      score: clamp01(neighborCount / 3),
      neighborCount,
      radiusMeters: 500,
      lookbackDays: 14,
    };
  }

  _routeTrustScore(trustScore) {
    if (trustScore >= 0.65) {
      return { routingTier: 'FAST TRACK', status: 'Pending for Admin Review' };
    }
    if (trustScore >= 0.40) {
      return { routingTier: 'STANDARD', status: 'Pending for Admin Review' };
    }
    return { routingTier: 'FLAGGED', status: 'Marked for Field Inspection' };
  }

  async getFarmStatus(farmId) {
    try {
      const latest = await this.database.getLatestAssessment(farmId);
      const stats = await this.database.getAssessmentStatistics(farmId);
      return { success: true, farmId, latestAssessment: latest, statistics: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAssessmentHistory(farmId, limit = 10) {
    try {
      const history = await this.database.getAssessmentHistory(farmId, limit);
      return { success: true, farmId, count: history.length, history };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getFlaggedAssessments(limit = 50) {
    try {
      const flagged = await this.database.getFlaggedAssessments(limit);
      return { success: true, count: flagged.length, flagged };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStatistics(farmId) {
    try {
      const stats = await this.database.getAssessmentStatistics(farmId);
      return { success: true, farmId, statistics: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateStatus(assessmentId, status) {
    try {
      const validStatuses = ['completed', 'flagged', 'under_review', 'resolved'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      const updated = await this.database.updateAssessmentStatus(assessmentId, status);
      return { success: true, record: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async initialize() {
    try {
      await this.database.initializeDatabase();
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  _validateInputs(farmId, soilData, weatherData, cropData) {
    if (!farmId || !['string', 'number'].includes(typeof farmId)) {
      throw new Error('Invalid farmId. Must be a non-empty string or number.');
    }
    if (!soilData || typeof soilData !== 'object') throw new Error('Invalid soilData. Must be an object.');
    if (!('pH' in soilData) || !('moisture' in soilData) || !('nutrient' in soilData)) {
      throw new Error('Soil data must include: pH, moisture, nutrient');
    }
    if (!weatherData || typeof weatherData !== 'object') throw new Error('Invalid weatherData. Must be an object.');
    if (!('temperature' in weatherData) || !('humidity' in weatherData) || !('rainfall' in weatherData)) {
      throw new Error('Weather data must include: temperature, humidity, rainfall');
    }
    if (!cropData || typeof cropData !== 'object') throw new Error('Invalid cropData. Must be an object.');
    if (!('previousDiseaseRiskScore' in cropData) || !('pastDiseaseOccurrences' in cropData)) {
      throw new Error('Crop data must include: previousDiseaseRiskScore, pastDiseaseOccurrences');
    }
  }

  async shutdown() {
    await this.database.disconnect();
  }
}

module.exports = RiskAssessmentService;
