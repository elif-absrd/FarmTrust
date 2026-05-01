import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertTriangle, BarChart3, CheckCircle2, Database, History, RefreshCw } from 'lucide-react-native';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { apiRequest } from '@/utils/api';

type Decision = 'APPROVED' | 'FLAGGED FOR REVIEW' | string;

interface RiskAssessment {
  timestamp?: string;
  inputs: {
    soil: RiskForm['soilData'];
    weather: RiskForm['weatherData'];
    crop: RiskForm['cropData'];
  };
  scores: {
    soil: number;
    weather: number;
    crop: number;
    composite: number;
  };
  riskLevel: number;
  riskLevelName: string;
  decision: Decision;
  recommendation: string;
  details?: {
    approved: boolean;
    reviewRequired: boolean;
  };
}

interface StoredRiskAssessment {
  id: number;
  farmId: string;
  soilScore: number;
  weatherScore: number;
  cropScore: number;
  compositeScore: number;
  riskLevel: number;
  riskLevelName: string;
  decision: Decision;
  recommendation: string;
  status: string;
  createdAt: string;
}

interface AssessResponse {
  success: boolean;
  recordId?: number;
  assessment?: RiskAssessment;
  storedAt?: string;
  error?: string;
}

interface FarmRiskResponse {
  success: boolean;
  latestAssessment: StoredRiskAssessment | null;
  statistics: {
    totalAssessments: number;
    averages: {
      soilScore: number;
      weatherScore: number;
      cropScore: number;
      compositeScore: number;
    };
    flaggedCount: number;
  } | null;
}

interface FlaggedResponse {
  success: boolean;
  count: number;
  flagged: StoredRiskAssessment[];
}

interface RiskForm {
  farmId: string;
  soilData: {
    pH: string;
    moisture: string;
    nutrient: string;
  };
  weatherData: {
    temperature: string;
    humidity: string;
    rainfall: string;
  };
  cropData: {
    previousDiseaseRiskScore: string;
    pastDiseaseOccurrences: string;
  };
}

const initialForm: RiskForm = {
  farmId: 'farm-demo-001',
  soilData: {
    pH: '6.5',
    moisture: '30',
    nutrient: '3',
  },
  weatherData: {
    temperature: '25',
    humidity: '65',
    rainfall: '150',
  },
  cropData: {
    previousDiseaseRiskScore: '30',
    pastDiseaseOccurrences: '2',
  },
};

const riskLevelColors: Record<number, string> = {
  1: '#16a34a',
  2: '#65a30d',
  3: '#d97706',
  4: '#ea580c',
  5: '#dc2626',
};

function toNumber(value: string) {
  return Number(value.trim());
}

function riskColor(level?: number) {
  return riskLevelColors[level || 5] || riskLevelColors[5];
}

function formatDate(value?: string) {
  if (!value) return 'Not stored yet';
  return new Date(value).toLocaleString();
}

function validateForm(form: RiskForm) {
  const values = [
    form.farmId.trim(),
    form.soilData.pH,
    form.soilData.moisture,
    form.soilData.nutrient,
    form.weatherData.temperature,
    form.weatherData.humidity,
    form.weatherData.rainfall,
    form.cropData.previousDiseaseRiskScore,
    form.cropData.pastDiseaseOccurrences,
  ];

  if (!values.every(Boolean)) return 'Fill every input before running assessment.';
  if (Number.isNaN(toNumber(form.soilData.pH)) || toNumber(form.soilData.pH) < 0 || toNumber(form.soilData.pH) > 14) {
    return 'Soil pH must be between 0 and 14.';
  }
  if (Number.isNaN(toNumber(form.soilData.moisture)) || toNumber(form.soilData.moisture) < 0 || toNumber(form.soilData.moisture) > 100) {
    return 'Soil moisture must be between 0 and 100.';
  }
  if (Number.isNaN(toNumber(form.soilData.nutrient)) || toNumber(form.soilData.nutrient) < 0 || toNumber(form.soilData.nutrient) > 5) {
    return 'Nutrient level must be between 0 and 5.';
  }
  if (Number.isNaN(toNumber(form.weatherData.temperature)) || toNumber(form.weatherData.temperature) < -50 || toNumber(form.weatherData.temperature) > 60) {
    return 'Temperature must be between -50 and 60.';
  }
  if (Number.isNaN(toNumber(form.weatherData.humidity)) || toNumber(form.weatherData.humidity) < 0 || toNumber(form.weatherData.humidity) > 100) {
    return 'Humidity must be between 0 and 100.';
  }
  if (Number.isNaN(toNumber(form.weatherData.rainfall)) || toNumber(form.weatherData.rainfall) < 0) {
    return 'Rainfall must be zero or higher.';
  }
  if (
    Number.isNaN(toNumber(form.cropData.previousDiseaseRiskScore)) ||
    toNumber(form.cropData.previousDiseaseRiskScore) < 0 ||
    toNumber(form.cropData.previousDiseaseRiskScore) > 100
  ) {
    return 'Previous disease risk score must be between 0 and 100.';
  }
  if (
    Number.isNaN(toNumber(form.cropData.pastDiseaseOccurrences)) ||
    toNumber(form.cropData.pastDiseaseOccurrences) < 0 ||
    !Number.isInteger(toNumber(form.cropData.pastDiseaseOccurrences))
  ) {
    return 'Past disease occurrences must be a whole number.';
  }
  return null;
}

function parsePayload(form: RiskForm) {
  return {
    farmId: form.farmId.trim(),
    soilData: {
      pH: toNumber(form.soilData.pH),
      moisture: toNumber(form.soilData.moisture),
      nutrient: toNumber(form.soilData.nutrient),
    },
    weatherData: {
      temperature: toNumber(form.weatherData.temperature),
      humidity: toNumber(form.weatherData.humidity),
      rainfall: toNumber(form.weatherData.rainfall),
    },
    cropData: {
      previousDiseaseRiskScore: toNumber(form.cropData.previousDiseaseRiskScore),
      pastDiseaseOccurrences: toNumber(form.cropData.pastDiseaseOccurrences),
    },
  };
}

export default function RiskScoring() {
  const [form, setForm] = useState<RiskForm>(initialForm);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [storedAt, setStoredAt] = useState<string | null>(null);
  const [farmStatus, setFarmStatus] = useState<FarmRiskResponse | null>(null);
  const [flagged, setFlagged] = useState<StoredRiskAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const decisionApproved = assessment?.decision === 'APPROVED';
  const currentColor = riskColor(assessment?.riskLevel);
  const scoreRows = useMemo(() => {
    if (!assessment) return [];
    return [
      { label: 'Soil score', value: assessment.scores.soil, weight: '40%' },
      { label: 'Weather score', value: assessment.scores.weather, weight: '30%' },
      { label: 'Crop score', value: assessment.scores.crop, weight: '30%' },
    ];
  }, [assessment]);

  const updateField = (section: keyof Omit<RiskForm, 'farmId'>, key: string, value: string) => {
    setForm((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [key]: value,
      },
    }));
  };

  const refreshRiskData = async (farmId = form.farmId.trim()) => {
    if (!farmId) return;
    setRefreshing(true);
    try {
      const [statusResponse, flaggedResponse] = await Promise.all([
        apiRequest<FarmRiskResponse>(`/api/risk/farm/${encodeURIComponent(farmId)}`, { method: 'GET' }),
        apiRequest<FlaggedResponse>('/api/risk/flagged?limit=5', { method: 'GET' }),
      ]);
      setFarmStatus(statusResponse);
      setFlagged(flaggedResponse.flagged || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load risk audit data';
      Alert.alert('Risk data unavailable', message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshRiskData(initialForm.farmId);
  }, []);

  const runAssessment = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      Alert.alert('Invalid input', validationError);
      return;
    }

    const payload = parsePayload(form);
    setLoading(true);
    try {
      const response = await apiRequest<AssessResponse>(
        '/api/risk/assess',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      if (!response.success || !response.assessment) {
        throw new Error(response.error || 'Risk assessment failed');
      }

      setAssessment(response.assessment);
      setRecordId(response.recordId || null);
      setStoredAt(response.storedAt || null);
      await refreshRiskData(payload.farmId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Risk assessment failed';
      Alert.alert('Assessment failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Risk Scoring Engine</Text>
            <Text style={styles.subtitle}>Soil 40%, weather 30%, crop history 30%</Text>
          </View>
          <Button variant="outline" size="icon" onPress={() => refreshRiskData()} disabled={refreshing}>
            {refreshing ? <ActivityIndicator size="small" color="#111827" /> : <RefreshCw color="#111827" size={18} />}
          </Button>
        </View>

        <Card style={styles.formCard}>
          <CardHeader>
            <CardTitle>
              <View style={styles.cardTitleRow}>
                <BarChart3 color="#1a73e8" size={18} />
                <Text style={styles.cardTitle}>Assessment Inputs</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent style={styles.formContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Farm ID</Text>
              <TextInput
                style={styles.input}
                value={form.farmId}
                onChangeText={(value) => setForm((previous) => ({ ...previous, farmId: value }))}
                placeholder="farm-demo-001"
                autoCapitalize="none"
              />
            </View>

            <InputSection title="Soil Data" helper="Ideal: pH 6-7, moisture 25-35%, nutrient 2.5-3.5">
              <NumberInput label="pH level" value={form.soilData.pH} onChangeText={(value) => updateField('soilData', 'pH', value)} />
              <NumberInput label="Moisture %" value={form.soilData.moisture} onChangeText={(value) => updateField('soilData', 'moisture', value)} />
              <NumberInput label="Nutrient level" value={form.soilData.nutrient} onChangeText={(value) => updateField('soilData', 'nutrient', value)} />
            </InputSection>

            <InputSection title="Weather Data" helper="Ideal: 20-30 C, humidity 40-70%, rainfall 100-200 mm">
              <NumberInput label="Temperature" value={form.weatherData.temperature} onChangeText={(value) => updateField('weatherData', 'temperature', value)} />
              <NumberInput label="Humidity %" value={form.weatherData.humidity} onChangeText={(value) => updateField('weatherData', 'humidity', value)} />
              <NumberInput label="Rainfall mm" value={form.weatherData.rainfall} onChangeText={(value) => updateField('weatherData', 'rainfall', value)} />
            </InputSection>

            <InputSection title="Crop History" helper="Previous risk is 0-100; higher means worse history">
              <NumberInput
                label="Previous disease risk"
                value={form.cropData.previousDiseaseRiskScore}
                onChangeText={(value) => updateField('cropData', 'previousDiseaseRiskScore', value)}
              />
              <NumberInput
                label="Past occurrences"
                value={form.cropData.pastDiseaseOccurrences}
                onChangeText={(value) => updateField('cropData', 'pastDiseaseOccurrences', value)}
              />
            </InputSection>

            <Button onPress={runAssessment} disabled={loading} size="lg">
              <View style={styles.buttonContent}>
                {loading ? <ActivityIndicator color="white" /> : <Database color="white" size={18} />}
                <Text style={styles.buttonText}>{loading ? 'Scoring...' : 'Run & Store Assessment'}</Text>
              </View>
            </Button>
          </CardContent>
        </Card>

        {assessment && (
          <Card style={styles.resultCard}>
            <CardHeader>
              <CardTitle>
                <View style={styles.cardTitleRow}>
                  {decisionApproved ? <CheckCircle2 color="#16a34a" size={18} /> : <AlertTriangle color="#dc2626" size={18} />}
                  <Text style={styles.cardTitle}>Risk Decision</Text>
                </View>
              </CardTitle>
            </CardHeader>
            <CardContent style={styles.resultContent}>
              <View style={[styles.decisionBand, { borderColor: currentColor }]}>
                <View>
                  <Text style={[styles.riskLevel, { color: currentColor }]}>
                    Level {assessment.riskLevel} - {assessment.riskLevelName}
                  </Text>
                  <Text style={styles.decisionText}>{assessment.decision}</Text>
                </View>
                <View style={[styles.scoreCircle, { backgroundColor: currentColor }]}>
                  <Text style={styles.scoreCircleValue}>{assessment.scores.composite}</Text>
                  <Text style={styles.scoreCircleLabel}>/100</Text>
                </View>
              </View>

              <View style={styles.scoreList}>
                {scoreRows.map((row) => (
                  <View key={row.label} style={styles.scoreRow}>
                    <View style={styles.scoreHeader}>
                      <Text style={styles.scoreLabel}>{row.label}</Text>
                      <Text style={styles.scoreValue}>{row.value}/100 - weight {row.weight}</Text>
                    </View>
                    <Progress value={row.value} />
                  </View>
                ))}
              </View>

              <View style={styles.auditBox}>
                <Text style={styles.auditTitle}>Stored Audit Record</Text>
                <Text style={styles.auditText}>Record ID: {recordId ?? 'pending'}</Text>
                <Text style={styles.auditText}>Stored at: {formatDate(storedAt || assessment.timestamp)}</Text>
                <Text style={styles.auditText}>Recommendation: {assessment.recommendation}</Text>
              </View>
            </CardContent>
          </Card>
        )}

        <Card style={styles.summaryCard}>
          <CardHeader>
            <CardTitle>
              <View style={styles.cardTitleRow}>
                <History color="#4f46e5" size={18} />
                <Text style={styles.cardTitle}>Farm Audit Summary</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {farmStatus?.statistics ? (
              <View style={styles.summaryGrid}>
                <SummaryTile label="Assessments" value={String(farmStatus.statistics.totalAssessments)} />
                <SummaryTile label="Avg Composite" value={`${farmStatus.statistics.averages.compositeScore}/100`} />
                <SummaryTile label="Flagged" value={String(farmStatus.statistics.flaggedCount)} />
                <SummaryTile
                  label="Latest"
                  value={farmStatus.latestAssessment ? `L${farmStatus.latestAssessment.riskLevel}` : 'None'}
                />
              </View>
            ) : (
              <Text style={styles.emptyText}>No stored assessment found for this farm yet.</Text>
            )}
          </CardContent>
        </Card>

        <Card style={styles.flaggedCard}>
          <CardHeader>
            <CardTitle>
              <Text style={styles.cardTitle}>Flagged Review Queue</Text>
            </CardTitle>
          </CardHeader>
          <CardContent style={styles.flaggedList}>
            {flagged.length ? (
              flagged.map((item) => (
                <View key={item.id} style={styles.flaggedItem}>
                  <View style={styles.flaggedTop}>
                    <Text style={styles.flaggedFarm}>{item.farmId}</Text>
                    <Text style={[styles.flaggedLevel, { color: riskColor(item.riskLevel) }]}>
                      L{item.riskLevel} - {item.compositeScore}/100
                    </Text>
                  </View>
                  <Text style={styles.flaggedMeta}>{item.riskLevelName} - {item.decision}</Text>
                  <Text style={styles.flaggedMeta}>{formatDate(item.createdAt)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No flagged assessments returned by the backend.</Text>
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </PageWrapper>
  );
}

function InputSection({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <View style={styles.inputSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{helper}</Text>
      </View>
      <View style={styles.inputGrid}>{children}</View>
    </View>
  );
}

function NumberInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0"
      />
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  formCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  resultCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  flaggedCard: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  formContent: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  inputSection: {
    gap: 10,
    paddingTop: 4,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionHelper: {
    fontSize: 12,
    color: '#6b7280',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  numberField: {
    minWidth: 140,
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
  },
  resultContent: {
    gap: 16,
  },
  decisionBand: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  riskLevel: {
    fontSize: 16,
    fontWeight: '800',
  },
  decisionText: {
    marginTop: 4,
    color: '#111827',
    fontWeight: '700',
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircleValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
  },
  scoreCircleLabel: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  scoreList: {
    gap: 12,
  },
  scoreRow: {
    gap: 6,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  scoreValue: {
    fontSize: 12,
    color: '#4b5563',
  },
  auditBox: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  auditText: {
    fontSize: 12,
    color: '#4b5563',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  flaggedList: {
    gap: 10,
  },
  flaggedItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fff7ed',
    gap: 4,
  },
  flaggedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  flaggedFarm: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  flaggedLevel: {
    fontSize: 13,
    fontWeight: '800',
  },
  flaggedMeta: {
    fontSize: 12,
    color: '#4b5563',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
