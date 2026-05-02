import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { StatusChip } from '../components/StatusChip';
import { SeverityBadge } from '../components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { FileText, Link as LinkIcon, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';

interface Claim {
  id: number;
  farmId: number;
  diseaseType?: string | null;
  diseaseSeverity?: number | null;
  createdAt: string;
  updatedAt?: string;
  status: string;
  txHash?: string | null;
  farm?: {
    farmName?: string | null;
    cropType?: string | null;
    orchardType?: string | null;
  };
  policy?: {
    coverageAmount?: number | string | null;
  };
}

interface ClaimsResponse {
  claims: Claim[];
}

interface AuditTrailEntry {
  step: string;
  time: string;
  detail?: string | null;
}

interface AuditTrailResponse {
  claimId: number;
  status: string;
  auditTrail: AuditTrailEntry[];
}

interface ScanHistoryEntry {
  id: number;
  predictedClass?: string | null;
  diseaseType?: string | null;
  diseaseSeverity?: number | null;
  modelConfidence?: number | null;
  expectedCrop?: string | null;
  createdAt: string;
  farm?: {
    id: number;
    farmName?: string | null;
  } | null;
}

interface ScanHistoryResponse {
  scans: ScanHistoryEntry[];
}

function severityFromScore(score?: number | null): 'Low' | 'Medium' | 'High' {
  if (!score || score <= 0) return 'Low';
  if (score >= 0.7) return 'High';
  if (score >= 0.35) return 'Medium';
  return 'Low';
}

function statusLabel(status: string) {
  switch (status) {
    case 'PAID':
      return 'Payout Complete';
    case 'APPROVED':
      return 'Approved (Awaiting Payout)';
    case 'UNDER_REVIEW':
      return 'Oracle Verifying';
    case 'REJECTED':
      return 'Rejected';
    case 'SURVEYED_PENDING':
      return 'Survey Pending';
    default:
      return 'Pending';
  }
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '₹0';
  return `₹${amount.toLocaleString()}`;
}

export default function ClaimsPage() {
  const { token } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      try {
        const response = await apiRequest<ClaimsResponse>('/api/claims', { method: 'GET' }, token);
        setClaims(response.claims || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load claims';
        Alert.alert('Claims unavailable', message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const txFeed = useMemo(() => {
    return claims
      .filter((claim) => !!claim.txHash)
      .slice(0, 5)
      .map((claim) => ({
        hash: claim.txHash || '--',
        time: formatDate(claim.updatedAt || claim.createdAt),
        status: claim.status === 'PAID' ? 'Confirmed' : 'Pending',
      }));
  }, [claims]);

  const openPolygonscan = async (txHash: string) => {
    try {
      const resp = await apiRequest<{ polygonscanUrl: string }>(
        `/api/blockchain/tx-status/${txHash}`,
        { method: 'GET' },
        token
      );
      if (resp?.polygonscanUrl) {
        await Linking.openURL(resp.polygonscanUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open transaction';
      Alert.alert('Transaction unavailable', message);
    }
  };

  const openClaim = async (claim: Claim) => {
    if (!token) return;
    setSelectedClaim(claim);
    setAuditTrail([]);
    setScanHistory([]);
    setDetailsLoading(true);
    try {
      const [auditResponse, scanResponse] = await Promise.all([
        apiRequest<AuditTrailResponse>(`/api/claims/${claim.id}/audit-trail`, { method: 'GET' }, token),
        apiRequest<ScanHistoryResponse>('/api/ml/history?limit=15', { method: 'GET' }, token),
      ]);
      setAuditTrail(auditResponse.auditTrail || []);
      setScanHistory(scanResponse.scans || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load claim details';
      Alert.alert('Claim details unavailable', message);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <PageWrapper>
      <Text style={styles.title}>Insurance Claims</Text>

      <View style={styles.mainContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a73e8" />
            <Text style={styles.loadingText}>Loading claims...</Text>
          </View>
        ) : (
          <View style={styles.claimsList}>
            {claims.map((claim) => {
              const cropLabel =
                claim.farm?.cropType || claim.farm?.orchardType || claim.farm?.farmName || 'Unknown crop';
              const severity = severityFromScore(Number(claim.diseaseSeverity));
              return (
                <TouchableOpacity key={claim.id} onPress={() => openClaim(claim)} activeOpacity={0.7}>
                  <Card style={styles.claimCard}>
                    <CardContent style={styles.claimContent}>
                      <View style={styles.claimLeft}>
                        <FileText color="#666" size={20} />
                        <View style={styles.claimInfo}>
                          <Text style={styles.claimTitle}>{cropLabel} — {claim.diseaseType || 'Unknown'}</Text>
                          <Text style={styles.claimMeta}>CLM-{String(claim.id).padStart(6, '0')} · {formatDate(claim.createdAt)}</Text>
                        </View>
                      </View>
                      <View style={styles.claimRight}>
                        <SeverityBadge level={severity} />
                        <StatusChip status={statusLabel(claim.status)} />
                        <Text style={styles.claimAmount}>{formatCurrency(claim.policy?.coverageAmount)}</Text>
                      </View>
                    </CardContent>
                  </Card>
                </TouchableOpacity>
              );
            })}
            {!claims.length && (
              <Text style={styles.emptyText}>No claims found yet.</Text>
            )}
          </View>
        )}

        <Card style={styles.txFeedCard}>
          <CardHeader>
            <CardTitle>
              <View style={styles.txHeader}>
                <LinkIcon color="#8b5cf6" size={16} />
                <Text style={styles.txTitle}>Live Blockchain Feed</Text>
              </View>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txFeed.length ? (
              txFeed.map((tx, i) => (
                <View key={`${tx.hash}-${i}`} style={styles.txItem}>
                  <Text style={styles.txHash}>{tx.hash}</Text>
                  <View style={styles.txMeta}>
                    <Text style={styles.txTime}>{tx.time}</Text>
                    <Text style={[
                      styles.txStatus,
                      tx.status === 'Confirmed' ? styles.txConfirmed : styles.txPending,
                    ]}>
                      {tx.status}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No transactions yet.</Text>
            )}
          </CardContent>
        </Card>
      </View>

      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent>
          <DialogHeader>
            <View style={styles.dialogHeaderRow}>
              <DialogTitle>
                Claim {selectedClaim ? `CLM-${String(selectedClaim.id).padStart(6, '0')}` : ''} — Audit Trail
              </DialogTitle>
              <TouchableOpacity onPress={() => setSelectedClaim(null)} style={styles.closeButton}>
                <X size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </DialogHeader>

          {detailsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1a73e8" />
              <Text style={styles.loadingText}>Loading audit trail...</Text>
            </View>
          ) : (
            <>
              {!!selectedClaim?.txHash && (
                <TouchableOpacity
                  onPress={() => openPolygonscan(selectedClaim.txHash as string)}
                  style={styles.txLink}
                >
                  <Text style={styles.txLinkText}>View payout on Polygonscan</Text>
                </TouchableOpacity>
              )}

              <View style={styles.auditTrail}>
                {auditTrail.length ? (
                  auditTrail.map((a, i) => (
                    <View key={`${a.step}-${i}`} style={styles.auditItem}>
                      <View style={styles.auditTimeline}>
                        <View style={styles.auditDot} />
                        {i < auditTrail.length - 1 && <View style={styles.auditLine} />}
                      </View>
                      <View style={styles.auditContent}>
                        <Text style={styles.auditStep}>{a.step}</Text>
                        <Text style={styles.auditTime}>{formatDate(a.time)}</Text>
                        {!!a.detail && <Text style={styles.auditDetail}>{a.detail}</Text>}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No audit events available.</Text>
                )}
              </View>

              <View style={styles.scanHistory}>
                <Text style={styles.sectionTitle}>Recent Scan History</Text>
                {scanHistory.length ? (
                  scanHistory.map((scan) => (
                    <View key={scan.id} style={styles.scanItem}>
                      <View>
                        <Text style={styles.scanTitle}>{scan.predictedClass || scan.diseaseType || 'Unknown scan'}</Text>
                        <Text style={styles.scanMeta}>
                          {formatDate(scan.createdAt)} · {scan.farm?.farmName || 'Unassigned farm'}
                        </Text>
                      </View>
                      <View style={styles.scanRight}>
                        <SeverityBadge level={severityFromScore(scan.diseaseSeverity)} />
                        <Text style={styles.scanConfidence}>
                          {scan.modelConfidence ? `${(Number(scan.modelConfidence) * 100).toFixed(1)}%` : '--'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No scans logged yet.</Text>
                )}
              </View>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  mainContent: {
    gap: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
  },
  claimsList: {
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    paddingVertical: 12,
  },
  claimCard: {},
  claimContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  claimLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  claimInfo: {
    flex: 1,
  },
  claimTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  claimMeta: {
    fontSize: 12,
    color: '#666',
  },
  claimRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  claimAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  txFeedCard: {
    borderWidth: 1,
    borderColor: '#8b5cf620',
  },
  txHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 8,
  },
  txHash: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#8b5cf6',
    flex: 1,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txTime: {
    fontSize: 12,
    color: '#666',
  },
  txStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  txConfirmed: {
    color: '#22c55e',
  },
  txPending: {
    color: '#f59e0b',
  },
  txLink: {
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
  },
  txLinkText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 12,
  },
  dialogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 4,
  },
  auditTrail: {
    marginTop: 8,
  },
  auditItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  auditTimeline: {
    alignItems: 'center',
    width: 12,
  },
  auditDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a73e8',
  },
  auditLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e0e0e0',
    minHeight: 40,
  },
  auditContent: {
    flex: 1,
    paddingBottom: 16,
  },
  auditStep: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  auditTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  auditDetail: {
    fontSize: 12,
    color: '#666',
  },
  scanHistory: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  scanItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scanTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  scanMeta: {
    fontSize: 11,
    color: '#666',
  },
  scanRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scanConfidence: {
    fontSize: 12,
    color: '#666',
  },
});
