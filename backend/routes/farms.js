const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const { authenticateToken } = require('../middleware/auth');
const { assignFarmIdentityOnPolygon } = require('../services/chainIdentity');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'orchard-documents');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildFullAddress(parts) {
  return [
    parts.addressLine1,
    parts.addressLine2,
    parts.village,
    parts.city,
    parts.district,
    parts.state,
    parts.pincode,
    parts.landmark,
  ]
    .filter(Boolean)
    .join(', ');
}

function calculateCentroid(gpsPolygon) {
  const coordinates = Array.isArray(gpsPolygon?.coordinates)
    ? gpsPolygon.coordinates[0]
    : Array.isArray(gpsPolygon)
      ? gpsPolygon
      : [];

  if (!coordinates.length) {
    return { latitude: null, longitude: null };
  }

  const sums = coordinates.reduce(
    (accumulator, point) => {
      const longitude = Array.isArray(point) ? Number(point[0]) : Number(point?.lon);
      const latitude = Array.isArray(point) ? Number(point[1]) : Number(point?.lat);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return accumulator;
      }
      accumulator.latitude += latitude;
      accumulator.longitude += longitude;
      accumulator.count += 1;
      return accumulator;
    },
    { latitude: 0, longitude: 0, count: 0 },
  );

  if (!sums.count) {
    return { latitude: null, longitude: null };
  }

  return {
    latitude: sums.latitude / sums.count,
    longitude: sums.longitude / sums.count,
  };
}

// Create new farm
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { farmName, gpsPolygon, cropType, areaAcres, district, state } = req.body;
    const userId = req.user.userId;

    if (!farmName || !gpsPolygon) {
      return res.status(400).json({ error: 'Farm name and GPS polygon are required' });
    }

    const farm = await prisma.farm.create({
      data: {
        ownerId: userId,
        farmName,
        gpsPolygon,
        cropType: cropType || null,
        district: district || null,
        state: state || null,
        areaAcres: areaAcres ? Number(areaAcres) : null,
      },
    });

    res.status(201).json({
      message: 'Farm created successfully',
      farm
    });
  } catch (error) {
    console.error('Farm creation error:', error);
    res.status(500).json({ error: 'Farm creation failed' });
  }
});

// Orchard registration endpoint (same storage table as farms)
router.post('/register-orchard', authenticateToken, upload.array('documents', 10), async (req, res) => {
  try {
    const {
      orchardName,
      orchardType,
      addressLine1,
      addressLine2,
      village,
      city,
      district,
      state,
      pincode,
      landmark,
      areaAcres,
      numberOfTrees,
      treeTypes,
      gpsPolygon,
    } = req.body;
    const userId = req.user.userId;
    const files = req.files || [];

    const parsedTreeTypes = parseJsonField(treeTypes, []);
    const parsedGpsPolygon = parseJsonField(gpsPolygon, null);
    const treeCount = Number(numberOfTrees);
    const areaValue = areaAcres ? Number(areaAcres) : null;
    const centroid = calculateCentroid(parsedGpsPolygon);
    const fullAddress = buildFullAddress({
      addressLine1,
      addressLine2,
      village,
      city,
      district,
      state,
      pincode,
      landmark,
    });

    if (
      !orchardName ||
      !orchardType ||
      !addressLine1 ||
      !district ||
      !state ||
      !pincode ||
      !numberOfTrees ||
      !parsedGpsPolygon
    ) {
      return res.status(400).json({
        error: 'Orchard name, orchard type, address, number of trees, and GPS polygon are required',
      });
    }

    const farm = await prisma.farm.create({
      data: {
        ownerId: userId,
        farmName: orchardName,
        orchardType,
        gpsPolygon: parsedGpsPolygon,
        areaAcres: areaValue,
        state,
        district,
        addressLine1,
        addressLine2: addressLine2 || null,
        village: village || null,
        city: city || null,
        pincode,
        landmark: landmark || null,
        fullAddress,
        locationLatitude: centroid.latitude === null ? null : new Prisma.Decimal(centroid.latitude.toFixed(7)),
        locationLongitude: centroid.longitude === null ? null : new Prisma.Decimal(centroid.longitude.toFixed(7)),
        numberOfTrees: treeCount,
        treeTypes: parsedTreeTypes,
        registrationStatus: 'PENDING',
      },
    });

    const orchardRegistration = await prisma.orchardRegistration.create({
      data: {
        userId,
        farmId: farm.id,
        orchardName,
        orchardType,
        addressLine1,
        addressLine2: addressLine2 || null,
        village: village || null,
        city: city || null,
        district,
        state,
        pincode,
        landmark: landmark || null,
        fullAddress,
        gpsPolygon: parsedGpsPolygon,
        locationLatitude: centroid.latitude === null ? null : new Prisma.Decimal(centroid.latitude.toFixed(7)),
        locationLongitude: centroid.longitude === null ? null : new Prisma.Decimal(centroid.longitude.toFixed(7)),
        numberOfTrees: treeCount,
        treeTypes: parsedTreeTypes,
        subscriptionPlan: 'FREE',
        registrationStatus: 'PENDING',
      },
    });

    const savedDocuments = await Promise.all(
      files.map((file) =>
        prisma.orchardDocument.create({
          data: {
            orchardRegistrationId: orchardRegistration.id,
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            mimeType: file.mimetype,
            fileSize: file.size,
          },
        })
      )
    );

    let validationResult = null;

    const chainIdentity = await assignFarmIdentityOnPolygon({
      farmId: farm.id,
      userId,
      farmName: orchardName,
    });

    await prisma.farm.update({
      where: { id: farm.id },
      data: {
        farmTokenId: chainIdentity.farmTokenId,
        chainTxHash: chainIdentity.chainTxHash,
        chainNetwork: chainIdentity.chainNetwork,
        chainIdentityAssignedAt: new Date(),
      },
    });

    try {
      const ndviResponse = await axios.get(
        `${process.env.NDVI_SERVICE_URL || 'http://localhost:8000'}/api/ndvi/current/${farm.id}`,
        { timeout: 30000 }
      );

      validationResult = {
        locationValidated: true,
        locationValidationSource: 'GOOGLE_EARTH',
        locationValidationMessage: 'Farm validated with Google Earth Engine and NDVI score computed',
        locationValidationScore: ndviResponse.data.ndvi,
        ndviScore: ndviResponse.data.ndvi,
      };

      await prisma.$transaction([
        prisma.ndviHistory.create({
          data: {
            farmId: farm.id,
            ndviValue: new Prisma.Decimal(Number(ndviResponse.data.ndvi).toFixed(3)),
            fetchDate: new Date(),
          },
        }),
        prisma.farm.update({
          where: { id: farm.id },
          data: {
            locationValidated: true,
            locationValidatedAt: new Date(),
            locationValidationSource: 'GOOGLE_EARTH',
            registrationStatus: 'VERIFIED',
            baselineNdvi: ndviResponse.data.ndvi,
            baselineDate: new Date(),
            ndviScore: ndviResponse.data.ndvi,
            ndviScoredAt: new Date(),
          },
        }),
        prisma.orchardRegistration.update({
          where: { id: orchardRegistration.id },
          data: {
            locationValidated: true,
            locationValidationSource: 'GOOGLE_EARTH',
            locationValidationMessage: 'Farm validated with Google Earth Engine and NDVI score computed',
            locationValidationScore: ndviResponse.data.ndvi,
            ndviScore: ndviResponse.data.ndvi,
            ndviScoredAt: new Date(),
            registrationStatus: 'VERIFIED',
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { onboardingCompleted: true },
        }),
      ]);
    } catch (validationError) {
      console.warn('NDVI validation unavailable during orchard registration:', validationError.message);
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingCompleted: true },
      });
    }

    res.status(201).json({
      message: 'Orchard registered successfully',
      farm: await prisma.farm.findUnique({
        where: { id: farm.id },
        include: {
          orchardRegistration: {
            include: {
              documents: true,
            },
          },
          ndviHistory: {
            orderBy: { fetchDate: 'desc' },
            take: 5,
          },
        },
      }),
      orchardRegistration: await prisma.orchardRegistration.findUnique({
        where: { id: orchardRegistration.id },
        include: { documents: true },
      }),
      documents: savedDocuments,
      validationResult,
      chainIdentity,
    });
  } catch (error) {
    console.error('Orchard registration error:', error);
    res.status(500).json({ error: 'Orchard registration failed' });
  }
});

// Get all farms for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const farms = await prisma.farm.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      farms
    });
  } catch (error) {
    console.error('Fetch farms error:', error);
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Get farm by ID
router.get('/:farmId', authenticateToken, async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.userId;

    const farm = await prisma.farm.findFirst({
      where: {
        id: Number(farmId),
        ownerId: userId,
      },
    });

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({
      farm
    });
  } catch (error) {
    console.error('Fetch farm error:', error);
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// Update farm
router.put('/:farmId', authenticateToken, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { farmName, gpsPolygon, cropType, areaAcres, district, state } = req.body;
    const userId = req.user.userId;

    const existing = await prisma.farm.findFirst({
      where: {
        id: Number(farmId),
        ownerId: userId,
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const farm = await prisma.farm.update({
      where: { id: Number(farmId) },
      data: {
        farmName: farmName || undefined,
        gpsPolygon: gpsPolygon || undefined,
        cropType: cropType || undefined,
        areaAcres: areaAcres ? Number(areaAcres) : undefined,
        district: district || undefined,
        state: state || undefined,
      },
    });

    res.json({
      message: 'Farm updated successfully',
      farm
    });
  } catch (error) {
    console.error('Farm update error:', error);
    res.status(500).json({ error: 'Farm update failed' });
  }
});

// Proxy current NDVI lookup for authenticated farm owners
router.get('/:farmId/ndvi-current', authenticateToken, async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.userId;

    const farm = await prisma.farm.findFirst({
      where: {
        id: Number(farmId),
        ownerId: userId,
      },
      select: { id: true },
    });

    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const ndviResponse = await axios.get(
      `${process.env.NDVI_SERVICE_URL || 'http://localhost:8000'}/api/ndvi/current/${farm.id}`,
      { timeout: 30000 }
    );

    res.json(ndviResponse.data);
  } catch (error) {
    console.error('NDVI current fetch error:', error.message);
    res.status(502).json({ error: 'Failed to fetch NDVI data from service' });
  }
});

module.exports = router;
