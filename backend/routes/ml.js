const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const execFileAsync = promisify(execFile);
const labelsPath = path.resolve(__dirname, '..', 'ml', 'labels.json');

const uploadDir = path.join(__dirname, '..', 'uploads', 'scan-images');
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
  const pythonBin = process.env.PYTHON_BIN || 'python';
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
    const fileBuffer = await fs.promises.readFile(uploadedPath);
    const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(
      `[ML] [${requestId}] predict:start image=${req.file?.originalname || 'unknown'} size=${req.file?.size || 0} mime=${req.file?.mimetype || 'unknown'} hash=${imageHash} expectedCrop=${expectedCrop || 'none'}`,
    );

    const prediction = await runModelInference(uploadedPath, expectedCrop || null);
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

module.exports = router;
