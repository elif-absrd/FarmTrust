import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { PageWrapper } from '../components/PageWrapper';
import { SeverityBadge } from '../components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Camera, Leaf, AlertTriangle, Pill } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';

type ScanState = 'idle' | 'scanning' | 'result';

interface Farm {
  id: number;
  farmName: string;
  cropType?: string | null;
  orchardType?: string | null;
  treeTypes?: string[] | null;
}

interface Prediction {
  predictedClass: string;
  diseaseType: string;
  diseaseSeverity: number;
  modelConfidence: number;
  predictionMode?: 'standard' | 'crop_constrained' | 'fallback_unconstrained';
  expectedCrop?: string | null;
  unconstrainedPredictedClass?: string;
  unconstrainedConfidence?: number;
  isPlantDetected?: boolean;
  rejectionReason?: string | null;
  inputQuality?: {
    vegetationRatio: number;
    uniqueColorRatio: number;
    meanSaturation: number;
  };
  crop?: string | null;
  classId?: number;
  topPredictions?: Array<{
    classId: number;
    label: string;
    confidence: number;
    diseaseType: string;
  }>;
}

interface PredictResponse {
  imageHash: string;
  expectedCrop?: string | null;
  prediction: Prediction;
  trace?: {
    requestId: string;
    durationMs: number;
    expectedCrop?: string | null;
    imageHash?: string;
    model?: {
      name?: string | null;
      version?: string | null;
      path?: string | null;
      sha256?: string | null;
      sizeBytes?: number | null;
    };
    output?: {
      predictedClass?: string | null;
      modelConfidence?: number | null;
      predictionMode?: string | null;
    };
  };
}

interface FarmsResponse {
  farms: Farm[];
}

interface MLCropsResponse {
  crops: string[];
}

interface ClaimSubmitResponse {
  message: string;
  claim: {
    id: number;
  };
}

interface PickedImage {
  uri: string;
  name: string;
  mimeType: string;
  webFile?: Blob | null;
}

function severityFromScore(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 0.7) return 'High';
  if (score >= 0.35) return 'Medium';
  return 'Low';
}

function normalizeCropName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cropAliases(value: string) {
  const normalized = normalizeCropName(value);
  const aliases = new Set<string>([normalized]);
  if (normalized.includes('paddy')) aliases.add('rice');
  if (normalized.includes('rice')) aliases.add('paddy');
  if (normalized.includes('maize')) aliases.add('corn');
  if (normalized.includes('corn')) aliases.add('maize');
  if (normalized.includes('capsicum')) {
    aliases.add('pepper');
    aliases.add('pepper bell');
    aliases.add('bell pepper');
  }
  if (normalized.includes('pepper')) aliases.add('capsicum');
  return Array.from(aliases);
}

function resolveModelCrop(candidate: string, availableCrops: string[]) {
  const candidateAliases = cropAliases(candidate);
  for (const availableCrop of availableCrops) {
    const availableAliases = cropAliases(availableCrop);
    const matched = candidateAliases.some((candidateAlias) =>
      availableAliases.some(
        (availableAlias) =>
          candidateAlias === availableAlias ||
          candidateAlias.includes(availableAlias) ||
          availableAlias.includes(candidateAlias),
      ),
    );
    if (matched) {
      return availableCrop;
    }
  }
  return null;
}

function deriveExpectedCrop(farm: Farm | null, availableCrops: string[]) {
  if (!farm || !availableCrops.length) return null;

  if (Array.isArray(farm.treeTypes)) {
    for (const treeType of farm.treeTypes) {
      if (typeof treeType !== 'string') continue;
      const matched = resolveModelCrop(treeType, availableCrops);
      if (matched) return matched;
    }
  }

  if (farm.cropType?.trim()) {
    const matched = resolveModelCrop(farm.cropType, availableCrops);
    if (matched) return matched;
  }

  if (farm.orchardType?.trim()) {
    const matched = resolveModelCrop(farm.orchardType, availableCrops);
    if (matched) return matched;
  }

  return null;
}

export default function ScanDetect() {
  const { token } = useAuth();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scannedImage, setScannedImage] = useState<PickedImage | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionTrace, setPredictionTrace] = useState<PredictResponse['trace'] | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [availableCrops, setAvailableCrops] = useState<string[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [selectedExpectedCrop, setSelectedExpectedCrop] = useState<string | null>(null);
  const [manualCropSelection, setManualCropSelection] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [farmsResponse, cropsResponse] = await Promise.all([
          apiRequest<FarmsResponse>('/api/farms', { method: 'GET' }, token),
          apiRequest<MLCropsResponse>('/api/ml/crops', { method: 'GET' }, token),
        ]);

        const fetchedFarms = farmsResponse.farms || [];
        const fetchedCrops = cropsResponse.crops || [];
        setFarms(fetchedFarms);
        setAvailableCrops(fetchedCrops);

        if (fetchedFarms.length) {
          setSelectedFarmId(fetchedFarms[0].id);
          const inferredCrop = deriveExpectedCrop(fetchedFarms[0], fetchedCrops);
          if (inferredCrop) {
            setSelectedExpectedCrop(inferredCrop);
          } else if (fetchedCrops.length) {
            setSelectedExpectedCrop(fetchedCrops[0]);
          }
        } else if (fetchedCrops.length) {
          setSelectedExpectedCrop(fetchedCrops[0]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load farms';
        Alert.alert('Unable to load scan metadata', message);
      }
    })();
  }, [token]);

  const recommendations = useMemo(() => {
    if (!prediction || prediction.isPlantDetected === false) {
      return [
        'Capture one leaf clearly and fill most of the frame.',
        'Use daylight and avoid screenshots/posters/non-plant objects.',
        'Keep the camera steady and focus before scanning.',
      ];
    }
    const diseaseType = prediction.diseaseType.toLowerCase();
    if (diseaseType === 'healthy') {
      return [
        'Leaf appears healthy. Continue regular monitoring every 3-5 days.',
        'Maintain balanced irrigation and avoid waterlogging.',
        'Keep periodic NDVI checks enabled for early stress detection.',
      ];
    }
    if (diseaseType === 'fungal') {
      return [
        'Use a recommended fungicide as per local agronomy guidance.',
        'Improve air circulation and reduce excess leaf moisture.',
        'Remove visibly affected leaves to reduce spread.',
      ];
    }
    if (diseaseType === 'bacterial') {
      return [
        'Use bactericide/copper-based treatment as advised locally.',
        'Avoid overhead irrigation to limit splash spread.',
        'Sanitize tools and isolate infected plant parts.',
      ];
    }
    if (diseaseType === 'viral') {
      return [
        'Remove infected plants where feasible to limit transmission.',
        'Control vectors such as whiteflies/aphids quickly.',
        'Use virus-resistant seed varieties for upcoming cycles.',
      ];
    }
    return [
      'Inspect leaves and stem closely for pest activity.',
      'Use integrated pest management (IPM) measures.',
      'Escalate to local agronomist if spread increases within 48 hours.',
    ];
  }, [prediction]);

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId) || null;

  useEffect(() => {
    if (manualCropSelection || !availableCrops.length) return;
    const inferredCrop = deriveExpectedCrop(selectedFarm, availableCrops);
    if (inferredCrop) {
      setSelectedExpectedCrop(inferredCrop);
      return;
    }
    if (!selectedExpectedCrop) {
      setSelectedExpectedCrop(availableCrops[0]);
    }
  }, [selectedFarm, availableCrops, manualCropSelection, selectedExpectedCrop]);

  const cycleFarm = () => {
    if (!farms.length || selectedFarmId === null) return;
    const currentIndex = farms.findIndex((farm) => farm.id === selectedFarmId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % farms.length : 0;
    setSelectedFarmId(farms[nextIndex].id);
    setManualCropSelection(false);
  };

  const cycleExpectedCrop = () => {
    if (!availableCrops.length) return;
    setManualCropSelection(true);
    const currentIndex = selectedExpectedCrop ? availableCrops.indexOf(selectedExpectedCrop) : -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableCrops.length : 0;
    setSelectedExpectedCrop(availableCrops[nextIndex]);
  };

  const runPrediction = async (asset: PickedImage) => {
    if (!token) {
      Alert.alert('Login required', 'Please log in before scanning.');
      return;
    }

    setScannedImage(asset);
    setPrediction(null);
    setPredictionTrace(null);
    setImageHash(null);
    setScanState('scanning');

    try {
      const formData = new FormData();
      if (selectedExpectedCrop) {
        formData.append('expectedCrop', selectedExpectedCrop);
      }
      if (Platform.OS === 'web' && asset.webFile) {
        formData.append('image', asset.webFile, asset.name);
      } else {
        formData.append(
          'image',
          {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType,
          } as never,
        );
      }

      const response = await apiRequest<PredictResponse>(
        '/api/ml/predict',
        {
          method: 'POST',
          body: formData,
        },
        token,
      );

      setPrediction(response.prediction);
      setPredictionTrace(response.trace || null);
      setImageHash(response.imageHash);
      setScanState('result');

      console.info('[ML trace]', {
        requestId: response.trace?.requestId,
        imageHash: response.imageHash,
        expectedCrop: response.expectedCrop,
        predictedClass: response.prediction.predictedClass,
        confidence: response.prediction.modelConfidence,
        mode: response.prediction.predictionMode,
        modelName: response.trace?.model?.name,
        modelVersion: response.trace?.model?.version,
        modelSha256: response.trace?.model?.sha256,
        durationMs: response.trace?.durationMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image';
      setScanState('idle');
      Alert.alert(
        'Scan failed',
        `${message}\n\nIf this continues, restart backend and confirm /api/ml/predict is available.`,
      );
    }
  };

  const selectImageAndScan = async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in before scanning.');
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (picked.canceled) {
        return;
      }

      const asset = picked.assets[0];
      const webAsset = asset as DocumentPicker.DocumentPickerAsset & { file?: Blob };
      await runPrediction({
        uri: asset.uri,
        name: asset.name || `scan-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        webFile: webAsset.file || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image';
      Alert.alert('Image selection failed', message);
    }
  };

  const captureImageAndScan = async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in before scanning.');
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Camera permission required', 'Allow camera access to click and scan images.');
        return;
      }

      const captured = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });

      if (captured.canceled) {
        return;
      }

      const asset = captured.assets[0];
      const webAsset = asset as ImagePicker.ImagePickerAsset & { file?: Blob };
      await runPrediction({
        uri: asset.uri,
        name: asset.fileName || `camera-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        webFile: webAsset.file || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture image';
      Alert.alert('Camera capture failed', message);
    }
  };

  const fileClaim = async () => {
    if (!token || !prediction) {
      Alert.alert('Missing data', 'Run a scan before filing a claim.');
      return;
    }
    if (prediction.isPlantDetected === false || prediction.diseaseType === 'Unknown') {
      Alert.alert('Claim blocked', 'No clear plant disease was detected in this image.');
      return;
    }

    if (!selectedFarmId) {
      Alert.alert('No registered farm', 'Register an orchard first, then submit a claim.');
      return;
    }

    if (!imageHash) {
      Alert.alert('Missing image hash', 'Please scan the image again.');
      return;
    }

    setSubmittingClaim(true);
    try {
      const response = await apiRequest<ClaimSubmitResponse>(
        '/api/claims/submit',
        {
          method: 'POST',
          body: JSON.stringify({
            farmId: selectedFarmId,
            diseaseImageHash: imageHash,
            diseaseType: prediction.diseaseType,
            diseaseSeverity: prediction.diseaseSeverity,
          }),
        },
        token,
      );

      Alert.alert('Claim submitted ✅', `${response.message}. Claim ID: ${response.claim.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Claim submission failed';
      Alert.alert('Claim submission failed', message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <PageWrapper>
      <Text style={styles.title}>Scan & Detect</Text>
      <Card style={styles.farmCard}>
        <CardContent style={styles.farmContent}>
          <View>
            <Text style={styles.farmLabel}>Claim Farm</Text>
            <Text style={styles.farmName}>
              {selectedFarm ? `${selectedFarm.farmName} (ID: ${selectedFarm.id})` : 'No farm found'}
            </Text>
            {!!selectedExpectedCrop && (
              <Text style={styles.farmExpectedCrop}>Expected crop: {selectedExpectedCrop}</Text>
            )}
            {!farms.length && (
              <Text style={styles.farmHint}>Register your orchard before filing claims.</Text>
            )}
          </View>
          <View style={styles.farmActions}>
            <Button variant="outline" onPress={cycleFarm} disabled={farms.length <= 1}>
              Switch Farm
            </Button>
            <Button variant="outline" onPress={cycleExpectedCrop} disabled={availableCrops.length <= 1}>
              Switch Crop
            </Button>
          </View>
        </CardContent>
      </Card>

      {scanState === 'idle' && (
        <View style={styles.idleContainer}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <View style={styles.viewfinderContent}>
              {scannedImage?.uri ? (
                <Image source={{ uri: scannedImage.uri }} style={styles.previewImage} />
              ) : (
                <>
                  <Camera color="#ccc" size={48} />
                  <Text style={styles.viewfinderText}>Select a crop-leaf image</Text>
                </>
              )}
            </View>
          </View>
          <Button onPress={captureImageAndScan} style={styles.scanButton} size="lg">
            <View style={styles.buttonContent}>
              <Camera color="white" size={20} />
              <Text style={styles.buttonText}>Click Image & Scan</Text>
            </View>
          </Button>
          <Button onPress={selectImageAndScan} style={styles.pickButton} size="lg" variant="outline">
            <View style={styles.buttonContent}>
              <Camera color="#1a73e8" size={20} />
              <Text style={styles.pickButtonText}>Select Image & Scan</Text>
            </View>
          </Button>
        </View>
      )}

      {scanState === 'scanning' && (
        <View style={styles.scanningContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.scanningText}>Analyzing crop image with AI...</Text>
        </View>
      )}

      {scanState === 'result' && prediction && (
        <View style={styles.resultContainer}>
          <Card style={styles.resultCard}>
            <CardHeader>
              <CardTitle>
                <View style={styles.resultHeader}>
                  <Leaf color="#1a73e8" size={20} />
                  <Text style={styles.resultTitle}>Detection Results</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.resultContent}>
                <View style={styles.imagePlaceholder}>
                  {scannedImage?.uri ? (
                    <Image source={{ uri: scannedImage.uri }} style={styles.resultImage} />
                  ) : (
                    <Leaf color="#1a73e840" size={64} />
                  )}
                </View>
                <View style={styles.resultDetails}>
                  <View style={styles.diseaseHeader}>
                    <AlertTriangle color="#ef4444" size={16} />
                    <Text style={styles.diseaseName}>{prediction.predictedClass}</Text>
                    {prediction.isPlantDetected !== false && (
                      <SeverityBadge level={severityFromScore(prediction.diseaseSeverity)} />
                    )}
                  </View>
                  <Text style={styles.confidence}>
                    Confidence:{' '}
                    <Text style={styles.confidenceValue}>{(prediction.modelConfidence * 100).toFixed(2)}%</Text>
                  </Text>
                  {prediction.isPlantDetected === false && (
                    <Text style={styles.rejectionNote}>
                      {prediction.rejectionReason || 'No clear plant leaf detected in this image.'}
                    </Text>
                  )}
                  {prediction.modelConfidence < 0.35 && (
                    <Text style={styles.lowConfidenceNote}>
                      Low confidence. Capture a clearer close-up leaf image for better accuracy.
                    </Text>
                  )}
                  {prediction.predictionMode === 'crop_constrained' && (
                    <Text style={styles.modelNote}>
                      Crop-aware prediction used ({prediction.expectedCrop || selectedExpectedCrop || 'farm crop'}).
                    </Text>
                  )}
                  <Text style={styles.crop}>
                    Crop: <Text style={styles.cropValue}>{prediction.crop || 'Unknown'}</Text>
                  </Text>
                  <Text style={styles.crop}>
                    Disease Type: <Text style={styles.cropValue}>{prediction.diseaseType}</Text>
                  </Text>
                  <Text style={styles.crop}>
                    Severity Score: <Text style={styles.cropValue}>{prediction.diseaseSeverity.toFixed(2)}</Text>
                  </Text>
                  {!!predictionTrace?.requestId && (
                    <View style={styles.traceBox}>
                      <Text style={styles.traceTitle}>Inference Trace</Text>
                      <Text style={styles.traceText}>Request ID: {predictionTrace.requestId}</Text>
                      <Text style={styles.traceText}>
                        Model: {predictionTrace.model?.name || 'unknown'} v{predictionTrace.model?.version || 'n/a'}
                      </Text>
                      <Text style={styles.traceText}>Model SHA: {predictionTrace.model?.sha256 || 'unknown'}</Text>
                      <Text style={styles.traceText}>Latency: {predictionTrace.durationMs}ms</Text>
                    </View>
                  )}
                  <View style={styles.treatmentSection}>
                    <View style={styles.treatmentHeader}>
                      <Pill color="#10b981" size={16} />
                      <Text style={styles.treatmentTitle}>Treatment Recommendations</Text>
                    </View>
                    <View style={styles.treatmentList}>
                      {recommendations.map((item) => (
                        <Text key={item} style={styles.treatmentItem}>• {item}</Text>
                      ))}
                    </View>
                  </View>
                  {prediction.isPlantDetected !== false && !!prediction.topPredictions?.length && (
                    <View style={styles.topPredictions}>
                      <Text style={styles.topPredictionsTitle}>Top Predictions</Text>
                      {prediction.topPredictions.map((item) => (
                        <Text key={item.classId} style={styles.topPredictionItem}>
                          {item.label} ({(item.confidence * 100).toFixed(1)}%)
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>

          <View style={styles.actionButtons}>
            <Button
              onPress={fileClaim}
              variant="destructive"
              style={styles.actionButton}
              disabled={submittingClaim || !farms.length || prediction?.isPlantDetected === false}
            >
              <View style={styles.buttonContent}>
                <AlertTriangle color="white" size={16} />
                <Text style={styles.buttonTextWhite}>
                  {submittingClaim ? 'Submitting...' : 'File Insurance Claim'}
                </Text>
              </View>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setScanState('idle');
                setPrediction(null);
                setPredictionTrace(null);
              }}
              style={styles.actionButton}
            >
              <Text style={styles.buttonTextDark}>Scan Again</Text>
            </Button>
          </View>
        </View>
      )}
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  farmCard: {
    marginBottom: 16,
  },
  farmContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  farmActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  farmLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  farmName: {
    fontSize: 14,
    fontWeight: '600',
  },
  farmHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#dc2626',
  },
  farmExpectedCrop: {
    marginTop: 2,
    fontSize: 12,
    color: '#1a73e8',
  },
  idleContainer: {
    alignItems: 'center',
  },
  viewfinder: {
    width: 280,
    height: 280,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1a73e850',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#1a73e8',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  viewfinderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  viewfinderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  scanButton: {
    marginTop: 24,
  },
  pickButton: {
    marginTop: 12,
    borderColor: '#1a73e8',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    resizeMode: 'cover',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickButtonText: {
    color: '#1a73e8',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextWhite: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextDark: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 24,
  },
  scanningText: {
    fontSize: 14,
    color: '#666',
  },
  resultContainer: {
    gap: 16,
  },
  resultCard: {
    // Card styles
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContent: {
    gap: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: 192,
    backgroundColor: '#1a73e810',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  resultDetails: {
    gap: 12,
  },
  diseaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diseaseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  confidence: {
    fontSize: 14,
    color: '#666',
  },
  confidenceValue: {
    fontWeight: 'bold',
    color: '#000',
  },
  modelNote: {
    fontSize: 12,
    color: '#1a73e8',
  },
  rejectionNote: {
    fontSize: 12,
    color: '#dc2626',
  },
  lowConfidenceNote: {
    fontSize: 12,
    color: '#b45309',
  },
  crop: {
    fontSize: 14,
    color: '#666',
  },
  cropValue: {
    fontWeight: '600',
    color: '#000',
  },
  traceBox: {
    marginTop: 4,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    gap: 2,
  },
  traceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  traceText: {
    fontSize: 11,
    color: '#374151',
  },
  treatmentSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  treatmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  treatmentTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  treatmentList: {
    gap: 4,
  },
  treatmentItem: {
    fontSize: 14,
    color: '#666',
  },
  topPredictions: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 4,
  },
  topPredictionsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  topPredictionItem: {
    fontSize: 13,
    color: '#4b5563',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    // Button styles
  },
});
