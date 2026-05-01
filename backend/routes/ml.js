const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../config/prisma');

const router = express.Router();
const execFileAsync = promisify(execFile);
const labelsPath = path.resolve(__dirname, '..', 'ml', 'labels.json');

const uploadDir = path.join(__dirname, '..', 'uploads', 'scan-images');
fs.mkdirSync(uploadDir, { recursive: true });

function resolvePythonBin() {
  const candidates = [
    process.env.PYTHON_BIN,
    path.resolve(__dirname, '..', '..', 'venv', 'Scripts', 'python.exe'),
    path.resolve(__dirname, '..', '..', 'venv', 'bin', 'python'),
    'python',
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const looksLikePath = candidate.includes('\\') || candidate.includes('/');
    if (looksLikePath) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate;
  }

  return 'python';
}

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
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are supported'));
      return;
    }
    cb(null, true);
  },
});

async function loadSupportedCrops() {
  if (!fs.existsSync(labelsPath)) {
    throw new Error(`Missing required ML file: ${labelsPath}`);
  }
  const raw = await fs.promises.readFile(labelsPath, 'utf8');
  const labels = JSON.parse(raw);
  const crops = Array.from(
    new Set(
      labels
        .map((entry) => {
          const label = entry?.display || entry?.raw || '';
          if (typeof label !== 'string') return null;
          if (label.includes(' - ')) return label.split(' - ')[0].trim();
          if (label.includes('___')) return label.split('___')[0].replace(/_/g, ' ').trim();
          return null;
        })
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  return crops;
}

async function runModelInference(imagePath, expectedCrop) {
  const pythonBin = resolvePythonBin();
  const scriptPath = path.join(__dirname, '..', 'ml', 'infer.py');
  const modelPath = path.resolve(__dirname, '..', 'ml', 'disease_detection.tflite');
  const metadataPath = path.resolve(__dirname, '..', 'ml', 'model_metadata.json');

  const requiredPaths = [scriptPath, modelPath, labelsPath, metadataPath];
  requiredPaths.forEach((requiredPath) => {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Missing required ML file: ${requiredPath}`);
    }
  });

  const args = [
    scriptPath,
    '--image',
    imagePath,
    '--model',
    modelPath,
    '--labels',
    labelsPath,
  ];
  if (expectedCrop) {
    args.push('--expected_crop', expectedCrop);
  }

  let stdout = '';
  let stderr = '';
  try {
    const result = await execFileAsync(pythonBin, args, {
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
    if (stderr && stderr.trim()) {
      console.warn('[ML] Python stderr:', stderr.trim());
    }
  } catch (error) {
    const commandError = error;
    stdout = commandError.stdout || '';
    stderr = commandError.stderr || '';
    if (stdout.trim()) {
      try {
        const parsedStdout = JSON.parse(stdout.trim());
        if (parsedStdout.error) {
          throw new Error(parsedStdout.error);
        }
      } catch {
        // fall through to stderr handling
      }
    }
    if (stderr.trim()) {
      throw new Error(stderr.trim());
    }
    throw error;
  }

  const output = stdout.trim();
  if (!output) {
    throw new Error('ML inference produced empty output');
  }

  const parsed = JSON.parse(output);
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

async function uploadImageToPinata(imagePath, originalName, imageHash) {
  const fallbackHash = `local-ipfs-${imageHash}`;
  if (!process.env.PINATA_JWT || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
    return {
      ipfsHash: fallbackHash,
      ipfsProvider: 'local',
      ipfsPinned: false,
    };
  }

  try {
    const fileBytes = await fs.promises.readFile(imagePath);
    const formData = new FormData();
    formData.append('file', new Blob([fileBytes]), originalName || `${imageHash}.jpg`);
    formData.append(
      'pinataMetadata',
      JSON.stringify({
        name: `FarmTrust ML evidence ${imageHash.slice(0, 12)}`,
      }),
    );

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      timeout: 30000,
    });

    return {
      ipfsHash: response.data?.IpfsHash || fallbackHash,
      ipfsProvider: 'pinata',
      ipfsPinned: Boolean(response.data?.IpfsHash),
    };
  } catch (error) {
    console.warn('[ML] Pinata upload failed; using local IPFS placeholder hash:', error.message);
    return {
      ipfsHash: fallbackHash,
      ipfsProvider: 'local',
      ipfsPinned: false,
      ipfsError: error.message,
    };
  }
}

router.get('/crops', authenticateToken, async (_req, res) => {
  try {
    const crops = await loadSupportedCrops();
    res.json({ crops });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load supported crops';
    console.error('Load crops error:', error);
    res.status(500).json({ error: message });
  }
});

router.post('/predict', authenticateToken, upload.single('image'), async (req, res) => {
  const uploadedPath = req.file?.path;
  if (!uploadedPath) {
    return res.status(400).json({ error: 'Image file is required in `image` form field' });
  }

  const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const startedAt = Date.now();

  try {
    const expectedCropRaw = typeof req.body?.expectedCrop === 'string' ? req.body.expectedCrop : '';
    const expectedCrop = expectedCropRaw.trim().slice(0, 100);
    const farmIdRaw = typeof req.body?.farmId === 'string' ? req.body.farmId : null;
    let resolvedFarmId = null;
    if (farmIdRaw) {
      const farmId = Number(farmIdRaw);
      if (Number.isFinite(farmId)) {
        const farm = await prisma.farm.findFirst({
          where: {
            id: farmId,
            ownerId: req.user.userId,
          },
          select: { id: true },
        });
        resolvedFarmId = farm?.id || null;
      }
    }
    const fileBuffer = await fs.promises.readFile(uploadedPath);
    const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(
      `[ML] [${requestId}] predict:start image=${req.file?.originalname || 'unknown'} size=${req.file?.size || 0} mime=${req.file?.mimetype || 'unknown'} hash=${imageHash} expectedCrop=${expectedCrop || 'none'}`,
    );

    const prediction = await runModelInference(uploadedPath, expectedCrop || null);
    const ipfs = await uploadImageToPinata(uploadedPath, req.file?.originalname, imageHash);
    const durationMs = Date.now() - startedAt;
    const modelDiagnostics = prediction?.modelDiagnostics || {};
    const modelFile = modelDiagnostics.model || {};

    const trace = {
      requestId,
      durationMs,
      expectedCrop: expectedCrop || null,
      uploadedFile: {
        originalName: req.file?.originalname || null,
        mimeType: req.file?.mimetype || null,
        sizeBytes: req.file?.size || null,
      },
      imageHash,
      model: {
        name: prediction?.modelName || null,
        version: prediction?.modelVersion || null,
        path: modelFile.path || null,
        sha256: modelFile.sha256 || null,
        sizeBytes: modelFile.sizeBytes || null,
      },
      output: {
        predictedClass: prediction?.predictedClass || null,
        modelConfidence: prediction?.modelConfidence ?? null,
        predictionMode: prediction?.predictionMode || null,
      },
      ipfs,
    };

    // Extract image quality diagnostics from prediction if available
    const imageQuality = prediction?.inputQuality || {};
    const isPlantDetected = prediction?.isPlantDetected !== false;
    
    console.log(
      `[ML] [${requestId}] predict:done class=${trace.output.predictedClass || 'unknown'} confidence=${trace.output.modelConfidence ?? 'n/a'} mode=${trace.output.predictionMode || 'unknown'} modelSha=${trace.model.sha256 || 'unknown'} durationMs=${durationMs}`,
    );

    const debugDiagnostics = prediction?.debugDiagnostics || {};
    const tensorDebug = debugDiagnostics.preprocess?.inputTensor;
    const rawDebug = debugDiagnostics.rawOutput?.summary;
    const topDebug = debugDiagnostics.probabilities?.topPredictions || [];
    console.log(
      `[ML] [${requestId}] debug tensor=${JSON.stringify(tensorDebug || {})} rawOutput=${JSON.stringify(rawDebug || {})} top=${JSON.stringify(topDebug.slice(0, 5))}`,
    );

    const severityValue = Number(prediction?.diseaseSeverity);
    const confidenceValue = Number(prediction?.modelConfidence);

    await prisma.scanHistory.create({
      data: {
        userId: req.user.userId,
        farmId: resolvedFarmId,
        imageHash,
        predictedClass: prediction?.predictedClass || null,
        diseaseType: prediction?.diseaseType || null,
        diseaseSeverity: Number.isFinite(severityValue) ? severityValue : null,
        modelConfidence: Number.isFinite(confidenceValue) ? confidenceValue : null,
        expectedCrop: expectedCrop || null,
      },
    });
    
    if (!isPlantDetected) {
      console.warn(
        `[ML] [${requestId}] ⚠️  NON-PLANT IMAGE DETECTED - Rejection reason: ${prediction?.rejectionReason || 'multiple quality checks failed'}`,
      );
      console.warn(
        `[ML] [${requestId}] Quality metrics: vegetationRatio=${imageQuality.vegetationRatio ?? 'n/a'} uniqueColorRatio=${imageQuality.uniqueColorRatio ?? 'n/a'} meanSaturation=${imageQuality.meanSaturation ?? 'n/a'}`,
      );
    } else if (trace.output.modelConfidence < 0.5) {
      console.info(
        `[ML] [${requestId}] 📊 Low confidence but plant detected: Quality metrics: vegetationRatio=${imageQuality.vegetationRatio ?? 'n/a'} uniqueColorRatio=${imageQuality.uniqueColorRatio ?? 'n/a'} meanSaturation=${imageQuality.meanSaturation ?? 'n/a'}`,
      );
    }

    res.json({
      message: 'Prediction generated successfully',
      imageHash,
      ipfsHash: ipfs.ipfsHash,
      ipfs,
      expectedCrop: expectedCrop || null,
      prediction,
      trace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    console.error(`[ML] [${requestId}] predict:error`, error);
    res.status(500).json({ error: message });
  } finally {
    await fs.promises.unlink(uploadedPath).catch(() => null);
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const scans = await prisma.scanHistory.findMany({
      where: { userId },
      include: {
        farm: {
          select: {
            id: true,
            farmName: true,
            cropType: true,
            orchardType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      scans: scans.map((scan) => ({
        id: scan.id,
        imageHash: scan.imageHash,
        predictedClass: scan.predictedClass,
        diseaseType: scan.diseaseType,
        diseaseSeverity: scan.diseaseSeverity,
        modelConfidence: scan.modelConfidence,
        expectedCrop: scan.expectedCrop,
        createdAt: scan.createdAt,
        farm: scan.farm
          ? {
              id: scan.farm.id,
              farmName: scan.farm.farmName,
              cropType: scan.farm.cropType,
              orchardType: scan.farm.orchardType,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error('Scan history error:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

module.exports = router;
