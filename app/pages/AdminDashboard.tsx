import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PageWrapper } from '../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';

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
      diseaseConfidence?: number;
      ndviValidation?: number;
      weatherMatch?: number;
      neighborMatch?: number;
    };
  };
  status: string;
  createdAt: string;
}

interface AdminStats {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
  surveyPendingClaims: number;
  averageTrustScore: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [claims, setClaims] = useState<ClaimForReview[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimForReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingClaimId, setProcessingClaimId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      Alert.alert('Access Denied', 'Admin access required');
      router.back();
      return;
    }

    loadDashboard();
  }, [user, token, statusFilter]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsResponse = await apiRequest(
        '/api/admin/dashboard-stats',
        { method: 'GET' },
        token
      );
      setStats(statsResponse.stats);

      // Fetch claims
      const claimsResponse = await apiRequest(
        `/api/admin/claims-pending-review?status=${statusFilter}`,
        { method: 'GET' },
        token
      );
      setClaims(claimsResponse.claims);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClaim = async (claimId: number) => {
    try {
      setProcessingClaimId(claimId);

      const result = await apiRequest(
        `/api/admin/claims/${claimId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ remarks: 'Approved by admin' }),
        },
        token
      );

      const title = result?.status === 'ESCALATED' ? 'Escalated' : 'Success';
      const message = result?.message || 'Claim approved successfully';
      Alert.alert(title, message);
      setSelectedClaim(null);
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve claim';
      Alert.alert('Error', message);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleRejectClaim = async (claimId: number) => {
    Alert.prompt(
      'Reject Claim',
      'Enter rejection reason:',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason) => {
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
                  body: JSON.stringify({
                    rejectionReason: reason,
                    remarks: reason,
                  }),
                },
                token
              );

              Alert.alert('Success', 'Claim rejected successfully');
              setSelectedClaim(null);
              loadDashboard();
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
      setProcessingClaimId(claimId);

      await apiRequest(
        `/api/admin/claims/${claimId}/survey`,
        {
          method: 'POST',
          body: JSON.stringify({
            remarks: 'Marked for field survey by admin',
          }),
        },
        token
      );

      Alert.alert('Success', 'Claim marked for survey');
      setSelectedClaim(null);
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark for survey';
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
    return (
      <PageWrapper>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            onPress={() => setSelectedClaim(null)}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back to Claims</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Claim Review: {selectedClaim.claimId}</Text>

          {/* Farmer Details */}
          <Card>
            <CardHeader>
              <CardTitle>Farmer Details</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Name:</Text>
                <Text style={styles.value}>{selectedClaim.farmerDetails.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Email:</Text>
                <Text style={styles.value}>{selectedClaim.farmerDetails.email}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.value}>{selectedClaim.farmerDetails.phone}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Wallet:</Text>
                <Text style={styles.valueSmall}>{selectedClaim.farmerDetails.walletAddress}</Text>
              </View>
            </CardContent>
          </Card>

          {/* Orchard Details */}
          <Card>
            <CardHeader>
              <CardTitle>Orchard Details</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Name:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Area:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.areaAcres} acres</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Account Number:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.accountNumber}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Account Name:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.accountName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Bank:</Text>
                <Text style={styles.value}>{selectedClaim.orchardDetails.bankName}</Text>
              </View>
            </CardContent>
          </Card>

          {/* Claim Details */}
          <Card>
            <CardHeader>
              <CardTitle>Disease Information</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Disease Type:</Text>
                <Text style={styles.value}>{selectedClaim.claimDetails.diseaseType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Severity:</Text>
                <Text style={styles.value}>
                  {(selectedClaim.claimDetails.diseaseSeverity * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>NDVI Baseline:</Text>
                <Text style={styles.value}>{selectedClaim.claimDetails.ndviBaseline?.toFixed(3)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>NDVI Current:</Text>
                <Text style={styles.value}>{selectedClaim.claimDetails.ndviCurrent?.toFixed(3)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>NDVI Drop %:</Text>
                <Text style={styles.value}>
                  {selectedClaim.claimDetails.ndviDropPercentage?.toFixed(2)}%
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* Trust Engine Results */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Engine Analysis</CardTitle>
            </CardHeader>
            <CardContent style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Trust Score:</Text>
                <Text style={[styles.value, { color: '#065f46', fontWeight: 'bold' }]}>
                  {(selectedClaim.trustEngine.trustScore * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.scoresGrid}>
                {selectedClaim.trustEngine.componentScores &&
                  Object.entries(selectedClaim.trustEngine.componentScores).map(([key, value]) => (
                    <View key={key} style={styles.scoreItem}>
                      <Text style={styles.scoreLabel}>{key}</Text>
                      <Text style={styles.scoreValue}>
                        {((value as number) * 100).toFixed(0)}%
                      </Text>
                    </View>
                  ))}
              </View>
            </CardContent>
          </Card>

          {/* Action Buttons */}
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
                <Text style={styles.btnText}>
                  {processingClaimId === selectedClaim.id ? 'Processing...' : 'Reject'}
                </Text>
              </Button>
              <Button
                onPress={() => handleSurveyPending(selectedClaim.id)}
                disabled={processingClaimId !== null}
                style={styles.surveyButton}
              >
                <Text style={styles.btnText}>
                  {processingClaimId === selectedClaim.id ? 'Processing...' : 'Survey'}
                </Text>
              </Button>
            </View>
          )}
        </ScrollView>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Admin Dashboard</Text>

        {/* Stats */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>{stats.pendingClaims}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Approved</Text>
              <Text style={styles.statValue}>{stats.approvedClaims}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Rejected</Text>
              <Text style={styles.statValue}>{stats.rejectedClaims}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Avg Trust Score</Text>
              <Text style={styles.statValue}>{(stats.averageTrustScore * 100).toFixed(0)}%</Text>
            </View>
          </View>
        )}

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setStatusFilter(status)}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === status && styles.filterTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Claims List */}
        {claims.length > 0 ? (
          claims.map((claim) => (
            <TouchableOpacity
              key={claim.id}
              onPress={() => setSelectedClaim(claim)}
              activeOpacity={0.7}
            >
              <Card style={styles.claimCard}>
                <CardContent style={styles.claimCardContent}>
                  <View style={styles.claimHeader}>
                    <Text style={styles.claimId}>{claim.claimId}</Text>
                    <Badge status={claim.status} />
                  </View>
                  <Text style={styles.farmerName}>{claim.farmerDetails.name}</Text>
                  <Text style={styles.orchardName}>{claim.orchardDetails.name}</Text>
                  <View style={styles.claimFooter}>
                    <Text style={styles.trustScore}>
                      Trust: {(claim.trustEngine.trustScore * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.disease}>{claim.claimDetails.diseaseType}</Text>
                  </View>
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
        )}
      </ScrollView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  statLabel: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#14532d',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  filterButtonActive: {
    backgroundColor: '#14532d',
    borderColor: '#14532d',
  },
  filterText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 12,
  },
  filterTextActive: {
    color: '#fff',
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
  claimFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  trustScore: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 12,
  },
  disease: {
    color: '#7c3aed',
    fontWeight: '600',
    fontSize: 12,
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
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  scoreItem: {
    flex: 0.48,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
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
});
