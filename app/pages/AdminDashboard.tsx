import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PageWrapper } from '../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';

type AdminTab = 'claims' | 'transactions';

type ClaimStatus = 'PENDING' | 'UNDER_REVIEW' | 'SURVEYED_PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

type ApproveClaimResponse = {
  status: 'APPROVED' | 'ESCALATED';
  message?: string;
};

type ConfirmPayoutResponse = {
  status: 'PAID' | 'ESCALATED';
  message?: string;
  txHash?: string;
  polygonscanUrl?: string;
};

interface ClaimForReview {
  id: number;
  claimId: string;
  farmerDetails: {
    name: string;
    email: string;
    phone: string;
    walletAddress: string;
  };
  orchardDetails: {
    name: string;
    type: string;
    address: string;
    areaAcres: number;
    accountNumber: string;
    accountName: string;
    bankName: string;
  };
  claimDetails: {
    diseaseType: string;
    diseaseSeverity: number;
    ndviBaseline: number;
    ndviCurrent: number;
    ndviDropPercentage: number;
  };
  trustEngine: {
    trustScore: number;
    componentScores: {
      n: number; // NDVI
      g: number; // GPS
      t: number; // Temporal
      w: number; // Weather
      p: number; // Peer
    };
  };
  evidence?: {
    weather?: {
      tempMax?: number;
      precipitationSum?: number;
      matched?: boolean;
    };
    peer?: {
      neighborCount?: number;
      radiusMeters?: number;
    };
    gps?: {
      validPoints?: number;
      totalSubmitted?: number;
    };
  };
  status: ClaimStatus;
  createdAt: string;
}

interface TransactionItem {
  claimId: number;
  status: ClaimStatus;
  approvedAt: string | null;
  txHash: string | null;
  farmer: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    walletAddress: string | null;
  };
  orchard: {
    id: number;
    name: string | null;
    type: string | null;
    accountNumber: string | null;
    accountName: string | null;
    bankName: string | null;
  };
  disease: {
    type: string | null;
    severity: number | null;
  };
}

function formatSeverity(value: number | null | undefined) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  if (num > 1) return `${num.toFixed(1)}%`;
  return `${(num * 100).toFixed(1)}%`;
}

export default function AdminDashboard({
  initialTab = 'claims',
  mode = 'both',
}: {
  initialTab?: AdminTab;
  mode?: AdminTab | 'both';
} = {}) {
  const router = useRouter();
  const { token, user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [loading, setLoading] = useState(true);

  const [claims, setClaims] = useState<ClaimForReview[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimForReview | null>(null);

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>('');

  const [processingClaimId, setProcessingClaimId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
      return;
    }

    if (!token) return;

    (async () => {
      try {
        setLoading(true);
        const tabToLoad = mode === 'both' ? activeTab : mode;
        if (tabToLoad === 'claims') {
          const resp = await apiRequest<{ claims: ClaimForReview[] }>(
            '/api/admin/claims-pending-review',
            { method: 'GET' },
            token
          );
          setClaims(resp.claims || []);
        } else {
          const resp = await apiRequest<{ transactions: TransactionItem[] }>(
            '/api/admin/transactions',
            { method: 'GET' },
            token
          );
          setTransactions(resp.transactions || []);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load admin dashboard';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, token, activeTab, mode, router]);

  const reviewedCount = useMemo(() => {
    return claims.filter((c) => !['PENDING', 'UNDER_REVIEW'].includes(c.status)).length;
  }, [claims]);

  // MUST be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (selectedClaim && token) {
      (async () => {
        try {
          const resp = await apiRequest<any>(`/api/admin/claims/${selectedClaim.id}/details`, { method: 'GET' }, token);
          if (resp) {
            setSelectedClaim(prev => {
              if (!prev) return null;
              return {
                ...prev,
                evidence: {
                  weather: resp.trustReportJson?.weather,
                  peer: resp.trustReportJson?.peer,
                  gps: resp.trustReportJson?.gps,
                }
              };
            });
          }
        } catch (error) {
          console.warn('Failed to fetch full claim details', error);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClaim?.id, token]);

  const handleApproveClaim = async (claimId: number) => {
    try {
      if (!token || !user) return;
      setProcessingClaimId(claimId);

      const result = await apiRequest<ApproveClaimResponse>(
        `/api/claim/approve/${claimId}`,

        {
          method: 'POST',
          body: JSON.stringify({ adminId: user.id, remarks: 'Approved by admin' }),
        },
        token
      );

      const title = result?.status === 'ESCALATED' ? 'Escalated' : 'Approved';
      const message = result?.message || 'Claim processed';
      Alert.alert(title, message);
      setSelectedClaim(null);

      if (result?.status === 'APPROVED') {
        setActiveTab('transactions');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve claim';
      Alert.alert('Error', message);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleRejectClaim = async (claimId: number) => {
    if (!token) return;
    Alert.prompt(
      'Reject Claim',
      'Enter rejection reason:',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason?: string) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Rejection reason is required');
              return;
            }

            try {
              setProcessingClaimId(claimId);
              await apiRequest(
                `/api/admin/claims/${claimId}/reject`,
                {
                  method: 'POST',
                  body: JSON.stringify({ rejectionReason: reason, remarks: reason }),
                },
                token
              );
              Alert.alert('Success', 'Claim rejected');
              setSelectedClaim(null);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to reject claim';
              Alert.alert('Error', message);
            } finally {
              setProcessingClaimId(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleSurveyPending = async (claimId: number) => {
    try {
      if (!token) return;
      setProcessingClaimId(claimId);
      await apiRequest(
        `/api/admin/claims/${claimId}/survey`,
        {
          method: 'POST',
          body: JSON.stringify({ remarks: 'Marked for field survey by admin' }),
        },
        token
      );
      Alert.alert('Success', 'Claim escalated for survey');
      setSelectedClaim(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark for survey';
      Alert.alert('Error', message);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleSurveyDecision = async (claimId: number, decision: 'APPROVE' | 'REJECT') => {
    try {
      if (!token) return;

      if (decision === 'REJECT') {
        Alert.prompt(
          'Reject Survey',
          'Enter rejection reason:',
          [
            { text: 'Cancel', onPress: () => {}, style: 'cancel' },
            {
              text: 'Reject',
              onPress: async (reason?: string) => {
                if (!reason?.trim()) {
                  Alert.alert('Error', 'Rejection reason is required');
                  return;
                }
                try {
                  setProcessingClaimId(claimId);
                  await apiRequest(
                    `/api/admin/claims/${claimId}/survey-decision`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ decision: 'REJECT', rejectionReason: reason, remarks: reason }),
                    },
                    token
                  );
                  Alert.alert('Success', 'Survey rejected');
                  setSelectedClaim(null);
                  setActiveTab('claims');
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Failed to reject survey';
                  Alert.alert('Error', message);
                } finally {
                  setProcessingClaimId(null);
                }
              },
            },
          ],
          'plain-text'
        );
        return;
      }

      setProcessingClaimId(claimId);
      await apiRequest(
        `/api/admin/claims/${claimId}/survey-decision`,
        {
          method: 'POST',
          body: JSON.stringify({ decision: 'APPROVE', remarks: 'Survey approved by admin' }),
        },
        token
      );
      Alert.alert('Success', 'Survey approved');
      setSelectedClaim(null);
      setActiveTab('transactions');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decide survey';
      Alert.alert('Error', message);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const openPolygonscan = async (txHash: string) => {
    try {
      const resp = await apiRequest<{ polygonscanUrl: string }>(
        `/api/blockchain/tx-status/${txHash}`,
        { method: 'GET' },
        token || undefined
      );
      if (resp?.polygonscanUrl) {
        await Linking.openURL(resp.polygonscanUrl);
      }
    } catch {
      // ignore
    }
  };

  const handleConfirmPayout = async () => {
    try {
      if (!token || !selectedTx) return;
      const amount = Number(payoutAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Invalid amount', 'Enter a valid POL amount.');
        return;
      }

      setProcessingClaimId(selectedTx.claimId);
      const result = await apiRequest<ConfirmPayoutResponse>(
        `/api/admin/claims/${selectedTx.claimId}/confirm-payout`,

        {
          method: 'POST',
          body: JSON.stringify({ amount, remarks: 'Payout confirmed by admin' }),
        },
        token
      );

      Alert.alert('Payout Triggered', result?.polygonscanUrl ? 'Transaction submitted on Polygon.' : 'Transaction submitted.');
      if (result?.txHash) {
        await openPolygonscan(result.txHash);
      }

      setSelectedTx(null);
      setPayoutAmount('');
      setActiveTab('transactions');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm payout';
      Alert.alert('Error', message);
    } finally {
      setProcessingClaimId(null);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
        </View>
      </PageWrapper>
    );
  }



  if (selectedClaim) {
    // Null-safe: componentScores may be null if claim was submitted without full trust scoring
    const rawScores = selectedClaim.trustEngine?.componentScores;
    const scores = {
      n: Number(rawScores?.n ?? 0),
      g: Number(rawScores?.g ?? 0),
      t: Number(rawScores?.t ?? 0),
      w: Number(rawScores?.w ?? 0),
      p: Number(rawScores?.p ?? 0),
    };
    const trustScore = Number(selectedClaim.trustEngine?.trustScore ?? 0);
    const evidence = selectedClaim.evidence;

    return (
      <PageWrapper>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSelectedClaim(null)} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Claim Review: {selectedClaim.claimId}</Text>

          <View style={styles.scoreOverview}>
            <View style={styles.trustScoreCircle}>
              <Text style={styles.trustScoreValue}>{(trustScore * 100).toFixed(0)}</Text>
              <Text style={styles.trustScoreLabel}>Trust Score</Text>
            </View>
            <View style={styles.scoreDetails}>
              <Text style={styles.scoreSubtitle}>Automatic Risk Routing</Text>
              <Badge status={selectedClaim.status} />
            </View>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>Trust Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreBar label="NDVI Stress (N)" value={scores.n} color="#10b981" />
              <ScoreBar label="GPS Validation (G)" value={scores.g} color="#3b82f6" />
              <ScoreBar label="Temporal History (T)" value={scores.t} color="#f59e0b" />
              <ScoreBar label="Weather Match (W)" value={scores.w} color="#8b5cf6" />
              <ScoreBar label="Peer Corroboration (P)" value={scores.p} color="#ec4899" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence Matrix</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <Row label="NDVI Drop" value={`${selectedClaim.claimDetails.ndviDropPercentage?.toFixed(1)}%`} />
              <Row label="Weather Match" value={evidence?.weather?.matched !== undefined ? (evidence.weather.matched ? '✅ Matched' : '❌ Mismatch') : 'Checking...'} />
              <Row label="Neighbor Count" value={`${evidence?.peer?.neighborCount ?? '--'} nearby`} />
              <Row label="GPS Accuracy" value={evidence?.gps ? `${evidence.gps.validPoints}/${evidence.gps.totalSubmitted} points` : 'Validating...'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>NDVI Heatmap (Simulated)</CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.heatmapContainer}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.heatmapCell,
                      {
                        backgroundColor: i === 12 ? '#dc2626' : i % 3 === 0 ? '#166534' : i % 2 === 0 ? '#15803d' : '#22c55e',
                        opacity: 0.6 + Math.random() * 0.4
                      }
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.heatmapLegend}>Stress concentrated in center-north sector</Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Farmer</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <Row label="Name" value={selectedClaim.farmerDetails.name} />
              <Row label="Email" value={selectedClaim.farmerDetails.email} />
              <Row label="Phone" value={selectedClaim.farmerDetails.phone} />
              <Row label="Wallet" value={selectedClaim.farmerDetails.walletAddress} small />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orchard & Account</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <Row label="Orchard" value={selectedClaim.orchardDetails.name} />
              <Row label="Type" value={selectedClaim.orchardDetails.type} />
              <Row label="Account #" value={selectedClaim.orchardDetails.accountNumber} />
              <Row label="Account Name" value={selectedClaim.orchardDetails.accountName} />
              <Row label="Bank" value={selectedClaim.orchardDetails.bankName} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disease</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <Row label="Type" value={selectedClaim.claimDetails.diseaseType} />
              <Row label="Severity" value={`${(selectedClaim.claimDetails.diseaseSeverity * 100).toFixed(1)}%`} />
            </CardContent>
          </Card>

          {['PENDING', 'UNDER_REVIEW'].includes(selectedClaim.status) && (
            <View style={styles.actionButtons}>
              <Button
                onPress={() => handleApproveClaim(selectedClaim.id)}
                disabled={processingClaimId !== null}
                style={styles.approveButton}
              >
                <Text style={styles.btnText}>
                  {processingClaimId === selectedClaim.id ? 'Processing...' : 'Approve'}
                </Text>
              </Button>
              <Button
                onPress={() => handleRejectClaim(selectedClaim.id)}
                disabled={processingClaimId !== null}
                style={styles.rejectButton}
              >
                <Text style={styles.btnText}>Reject</Text>
              </Button>
              <Button
                onPress={() => handleSurveyPending(selectedClaim.id)}
                disabled={processingClaimId !== null}
                style={styles.surveyButton}
              >
                <Text style={styles.btnText}>Send for Survey</Text>
              </Button>
            </View>
          )}

          {selectedClaim.status === 'SURVEYED_PENDING' && (
            <View style={styles.actionButtons}>
              <Button
                onPress={() => handleSurveyDecision(selectedClaim.id, 'APPROVE')}
                disabled={processingClaimId !== null}
                style={styles.approveButton}
              >
                <Text style={styles.btnText}>
                  {processingClaimId === selectedClaim.id ? 'Processing...' : 'Approve Survey'}
                </Text>
              </Button>
              <Button
                onPress={() => handleSurveyDecision(selectedClaim.id, 'REJECT')}
                disabled={processingClaimId !== null}
                style={styles.rejectButton}
              >
                <Text style={styles.btnText}>Reject Survey</Text>
              </Button>
            </View>
          )}
        </ScrollView>
      </PageWrapper>
    );
  }

  if (selectedTx) {
    return (
      <PageWrapper>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSelectedTx(null)} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await logout();
                router.replace('/login');
              }}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Transaction: CLM-{String(selectedTx.claimId).padStart(6, '0')}</Text>

          <Card>
            <CardHeader>
              <CardTitle>Autofilled Details</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <Row label="Farmer" value={selectedTx.farmer.name || selectedTx.farmer.email} />
              <Row label="Orchard" value={selectedTx.orchard.name || '--'} />
              <Row label="Account #" value={selectedTx.orchard.accountNumber || '--'} />
              <Row label="Account Name" value={selectedTx.orchard.accountName || '--'} />
              <Row label="Bank" value={selectedTx.orchard.bankName || '--'} />
              <Row label="Disease" value={selectedTx.disease.type || '--'} />
              <Row label="Severity" value={formatSeverity(selectedTx.disease.severity)} />
              <Row label="Status" value={selectedTx.status} />
              {selectedTx.txHash ? (
                <TouchableOpacity onPress={() => openPolygonscan(selectedTx.txHash as string)}>
                  <Text style={styles.linkText}>View on Polygonscan</Text>
                </TouchableOpacity>
              ) : null}
            </CardContent>
          </Card>

          {selectedTx.status !== 'PAID' && (
            <Card>
              <CardHeader>
                <CardTitle>Payout Confirmation</CardTitle>
              </CardHeader>
              <CardContent>
                <Text style={styles.inputLabel}>Enter Payout Amount (POL)</Text>
                <TextInput
                  value={payoutAmount}
                  onChangeText={setPayoutAmount}
                  placeholder="e.g. 0.25"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                {Number(payoutAmount) > 0 && (
                  <View style={styles.conversionInfo}>
                    <Text style={styles.conversionText}>
                      Conversion: {payoutAmount} POL ≈ ₹{(Number(payoutAmount) * 10000).toLocaleString()} INR
                    </Text>
                    <Text style={styles.conversionSubtext}>Rate: 1 POL = ₹10,000 (Fixed Test Rate)</Text>
                  </View>
                )}

                <Button
                  onPress={handleConfirmPayout}
                  disabled={processingClaimId !== null}
                  style={styles.confirmButton}
                >
                  <Text style={styles.btnText}>
                    {processingClaimId === selectedTx.claimId ? 'Executing on Polygon...' : 'Confirm & Trigger Payout'}
                  </Text>
                </Button>
                <Text style={styles.helperText}>
                  This will trigger MockINR conversion and MockInsurance payout on the Polygon ledger.
                </Text>
              </CardContent>
            </Card>
          )}
        </ScrollView>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {mode === 'both' && <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => {
              setSelectedClaim(null);
              setSelectedTx(null);
              setActiveTab('claims');
            }}
            style={[styles.tabButton, activeTab === 'claims' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'claims' && styles.tabTextActive]}>
              Claims for Review ({claims.length})
            </Text>
            {reviewedCount ? <Text style={styles.tabSubText}>Reviewed: {reviewedCount}</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSelectedClaim(null);
              setSelectedTx(null);
              setActiveTab('transactions');
            }}
            style={[styles.tabButton, activeTab === 'transactions' && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
              Transactions ({transactions.length})
            </Text>
          </TouchableOpacity>
        </View>}

        {(mode === 'both' ? activeTab : mode) === 'claims' ? (
          claims.length ? (
            claims.map((claim) => (
              <TouchableOpacity key={claim.id} onPress={() => setSelectedClaim(claim)} activeOpacity={0.7}>
                <Card style={styles.claimCard}>
                  <CardContent style={styles.claimCardContent}>
                    <View style={styles.claimHeader}>
                      <Text style={styles.claimId}>{claim.claimId}</Text>
                      <Badge status={claim.status} />
                    </View>
                    <Text style={styles.farmerName}>{claim.farmerDetails.name}</Text>
                    <Text style={styles.orchardName}>{claim.orchardDetails.name}</Text>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card>
              <CardContent style={styles.emptyState}>
                <Text style={styles.emptyText}>No claims to review</Text>
              </CardContent>
            </Card>
          )
        ) : transactions.length ? (
          transactions.map((tx) => (
            <TouchableOpacity key={tx.claimId} onPress={() => setSelectedTx(tx)} activeOpacity={0.7}>
              <Card style={styles.claimCard}>
                <CardContent style={styles.claimCardContent}>
                  <View style={styles.claimHeader}>
                    <Text style={styles.claimId}>CLM-{String(tx.claimId).padStart(6, '0')}</Text>
                    <Badge status={tx.status} />
                  </View>
                  <Text style={styles.farmerName}>{tx.farmer.name || tx.farmer.email}</Text>
                  <Text style={styles.orchardName}>{tx.orchard.name || '--'}</Text>
                  {tx.txHash ? <Text style={styles.txHash}>{tx.txHash}</Text> : <Text style={styles.txPending}>Awaiting amount</Text>}
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card>
            <CardContent style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </PageWrapper>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={small ? styles.valueSmall : styles.value}>{value || '--'}</Text>
    </View>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarHeader}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <Text style={styles.scoreBarValue}>{(value * 100).toFixed(0)}%</Text>
      </View>
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${value * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  scoreOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  trustScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#0284c7',
  },
  trustScoreValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0369a1',
  },
  trustScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369a1',
    marginTop: -2,
  },
  scoreDetails: {
    flex: 1,
    gap: 4,
  },
  scoreSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreBarRow: {
    marginBottom: 12,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  scoreBarValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  scoreBarBg: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  heatmapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    aspectRatio: 1,
    padding: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  heatmapCell: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 2,
  },
  heatmapLegend: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  logoutText: {
    fontWeight: '800',
    fontSize: 12,
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tabButtonActive: {
    backgroundColor: '#14532d',
    borderColor: '#14532d',
  },
  tabText: {
    fontWeight: '700',
    color: '#111827',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabSubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#111827',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 16,
  },
  claimCard: {
    marginBottom: 12,
  },
  claimCardContent: {
    gap: 8,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimId: {
    fontWeight: '700',
    fontSize: 14,
  },
  farmerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  orchardName: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  label: {
    fontWeight: '600',
    color: '#6b7280',
    flex: 0.4,
  },
  value: {
    fontWeight: '500',
    color: '#111827',
    flex: 0.6,
    textAlign: 'right',
  },
  valueSmall: {
    fontWeight: '500',
    color: '#111827',
    flex: 0.6,
    textAlign: 'right',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#059669',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#dc2626',
  },
  surveyButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
  },
  confirmButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  conversionInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  conversionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  conversionSubtext: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
  },
  helperText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  txHash: {
    fontSize: 11,
    color: '#111827',
  },
  txPending: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  linkText: {
    marginTop: 8,
    color: '#2563eb',
    fontWeight: '700',
  },
});
