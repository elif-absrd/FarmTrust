import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { SeverityBadge } from '../components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Progress } from '../components/ui/Progress';
import { Camera, Leaf, AlertTriangle, Pill } from 'lucide-react-native';

type ScanState = 'idle' | 'scanning' | 'result';

export default function ScanDetect() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);

  const startScan = () => {
    setScanState('scanning');
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setScanState('result');
          return 100;
        }
        return p + 5;
      });
    }, 80);
  };

  const fileClaim = () => {
    Alert.alert(
      'Claim Submitted ✅',
      'Your insurance claim for Rice Blast has been filed successfully.'
    );
  };

  return (
    <PageWrapper>
      <Text style={styles.title}>Scan & Detect</Text>

      {scanState === 'idle' && (
        <View style={styles.idleContainer}>
          {/* Viewfinder */}
          <View style={styles.viewfinder}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <View style={styles.viewfinderContent}>
              <Camera color="#ccc" size={48} />
              <Text style={styles.viewfinderText}>Point at your crop leaf</Text>
            </View>
          </View>
          <Button onPress={startScan} style={styles.scanButton} size="lg">
            <View style={styles.buttonContent}>
              <Camera color="white" size={20} />
              <Text style={styles.buttonText}>Capture & Scan</Text>
            </View>
          </Button>
        </View>
      )}

      {scanState === 'scanning' && (
        <View style={styles.scanningContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.scanningText}>Analyzing crop image with AI...</Text>
          <Progress value={progress} style={styles.progressBar} />
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {scanState === 'result' && (
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
                  <Leaf color="#1a73e840" size={64} />
                </View>
                <View style={styles.resultDetails}>
                  <View style={styles.diseaseHeader}>
                    <AlertTriangle color="#ef4444" size={16} />
                    <Text style={styles.diseaseName}>Rice Blast</Text>
                    <SeverityBadge level="High" />
                  </View>
                  <Text style={styles.confidence}>
                    Confidence: <Text style={styles.confidenceValue}>94.6%</Text>
                  </Text>
                  <Text style={styles.crop}>
                    Crop: <Text style={styles.cropValue}>Rice (Oryza sativa)</Text>
                  </Text>
                  <View style={styles.treatmentSection}>
                    <View style={styles.treatmentHeader}>
                      <Pill color="#10b981" size={16} />
                      <Text style={styles.treatmentTitle}>Treatment Recommendations</Text>
                    </View>
                    <View style={styles.treatmentList}>
                      <Text style={styles.treatmentItem}>• Apply Tricyclazole 75% WP @ 0.6g/L</Text>
                      <Text style={styles.treatmentItem}>• Drain standing water and reduce nitrogen</Text>
                      <Text style={styles.treatmentItem}>• Remove and destroy infected leaves</Text>
                    </View>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>

          <View style={styles.actionButtons}>
            <Button onPress={fileClaim} variant="destructive" style={styles.actionButton}>
              <View style={styles.buttonContent}>
                <AlertTriangle color="white" size={16} />
                <Text style={styles.buttonTextWhite}>File Insurance Claim</Text>
              </View>
            </Button>
            <Button variant="outline" onPress={() => setScanState('idle')} style={styles.actionButton}>
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
    marginBottom: 24,
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
  },
  viewfinderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  scanButton: {
    marginTop: 24,
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
  progressBar: {
    width: 256,
  },
  progressText: {
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
  crop: {
    fontSize: 14,
    color: '#666',
  },
  cropValue: {
    fontWeight: '600',
    color: '#000',
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
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    // Button styles
  },
});
