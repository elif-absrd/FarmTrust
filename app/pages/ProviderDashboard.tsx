import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { StatusChip } from '../components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Shield, FileText, Wallet, Activity } from 'lucide-react-native';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';

interface ProviderDashboardResponse {
  providerAccount: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
    walletAddress?: string | null;
  };
  stats: {
    totalPolicies: number;
    pendingClaims: number;
    payoutsDisbursed: number;
    aiAccuracy: number;
  };
  policies: Array<{
    farmerId: number | null;
    farmerName: string;
    plant: string;
    coverageAmount: number;
    status: string;
  }>;
  heatmap: {
    grid: number[][];
    levels: string[];
  };
  claimsQueue: Array<{
    farmerId: number | null;
    farmerName: string;
    disease: string;
    modelScore: number | null;
    trustScore: number | null;
    oracle: string;
    status: string;
  }>;
}

function formatCurrency(value?: number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString()}`;
}

function formatPercent(value?: number | null) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '--';
  return `${percent.toFixed(1)}%`;
}

export default function ProviderDashboard() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<ProviderDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      try {
        const response = await apiRequest<ProviderDashboardResponse>('/api/provider/dashboard', { method: 'GET' }, token);
        setDashboard(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load provider dashboard';
        Alert.alert('Dashboard unavailable', message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const providerStats = useMemo(() => {
    return [
      { label: 'Total Policies', value: dashboard?.stats.totalPolicies ?? 0, icon: Shield },
      { label: 'Pending Claims', value: dashboard?.stats.pendingClaims ?? 0, icon: FileText },
      { label: 'Payouts Disbursed', value: formatCurrency(dashboard?.stats.payoutsDisbursed), icon: Wallet },
      { label: 'AI Accuracy', value: formatPercent(dashboard?.stats.aiAccuracy), icon: Activity },
    ];
  }, [dashboard]);

  const heatColors = ['#1a73e810', '#22c55e40', '#f59e0b50', '#ef444460'];
  const heatmapGrid = dashboard?.heatmap.grid || [];

  return (
    <PageWrapper>
      <Text style={styles.title}>Insurance Provider Dashboard</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      ) : (
        <>
          <Card style={styles.accountCard}>
            <CardHeader>
              <CardTitle>
                <Text style={styles.cardTitle}>Provider Account</Text>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Account Name</Text>
                <Text style={styles.accountValue}>{dashboard?.providerAccount.name || '--'}</Text>
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Email</Text>
                <Text style={styles.accountValue}>{dashboard?.providerAccount.email || '--'}</Text>
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Wallet</Text>
                <Text style={styles.accountValue}>{dashboard?.providerAccount.walletAddress || '--'}</Text>
              </View>
            </CardContent>
          </Card>

          <View style={styles.statsGrid}>
            {providerStats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Card>
                  <CardContent style={styles.statContent}>
                    <View style={styles.iconContainer}>
                      <s.icon color="#1a73e8" size={20} />
                    </View>
                    <View style={styles.statText}>
                      <Text style={styles.statLabel}>{s.label}</Text>
                      <Text style={styles.statValue}>{s.value}</Text>
                    </View>
                  </CardContent>
                </Card>
              </View>
            ))}
          </View>

          <View style={styles.contentGrid}>
            <Card style={styles.policiesCard}>
              <CardHeader>
                <CardTitle>
                  <Text style={styles.cardTitle}>Policy Management</Text>
                </CardTitle>
              </CardHeader>
              <CardContent style={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Farmer ID</TableHead>
                      <TableHead>Farmer Name</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dashboard?.policies || []).map((p, index) => (
                      <TableRow key={`${p.farmerId}-${index}`}>
                        <TableCell className="font-mono">{p.farmerId ?? '--'}</TableCell>
                        <TableCell>{p.farmerName}</TableCell>
                        <TableCell>{p.plant}</TableCell>
                        <TableCell>{formatCurrency(p.coverageAmount)}</TableCell>
                        <TableCell><StatusChip status={p.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!dashboard?.policies?.length && (
                  <Text style={styles.emptyText}>No policy records available.</Text>
                )}
              </CardContent>
            </Card>

            <Card style={styles.heatmapCard}>
              <CardHeader>
                <CardTitle>
                  <Text style={styles.cardTitle}>Disease Outbreak Map</Text>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <View style={styles.heatmapGrid}>
                  {heatmapGrid.map((row, ri) => (
                    <View key={`row-${ri}`} style={styles.heatmapRow}>
                      {row.map((val, ci) => (
                        <View
                          key={`cell-${ri}-${ci}`}
                          style={[
                            styles.heatmapCell,
                            { backgroundColor: heatColors[val] || heatColors[0] },
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                  {!heatmapGrid.length && (
                    <Text style={styles.emptyText}>No outbreak activity logged.</Text>
                  )}
                </View>
                <View style={styles.heatmapLegend}>
                  <Text style={styles.legendLabel}>Low</Text>
                  {heatColors.map((color, i) => (
                    <View key={i} style={[styles.legendBox, { backgroundColor: color }]} />
                  ))}
                  <Text style={styles.legendLabel}>High</Text>
                </View>
              </CardContent>
            </Card>
          </View>

          <Card style={styles.claimsCard}>
            <CardHeader>
              <CardTitle>
                <Text style={styles.cardTitle}>Claims Queue</Text>
              </CardTitle>
            </CardHeader>
            <CardContent style={styles.tableContainer}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer ID</TableHead>
                    <TableHead>Farmer Name</TableHead>
                    <TableHead>Disease</TableHead>
                    <TableHead>Model Score</TableHead>
                    <TableHead>Trust Score</TableHead>
                    <TableHead>Oracle</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.claimsQueue || []).map((c, index) => (
                    <TableRow key={`${c.farmerId}-${index}`}>
                      <TableCell className="font-mono">{c.farmerId ?? '--'}</TableCell>
                      <TableCell>{c.farmerName}</TableCell>
                      <TableCell>{c.disease}</TableCell>
                      <TableCell>
                        <Text style={styles.aiScore}>{c.modelScore !== null ? `${(c.modelScore * 100).toFixed(1)}%` : '--'}</Text>
                      </TableCell>
                      <TableCell>
                        <Text style={styles.aiScore}>{c.trustScore !== null ? `${(c.trustScore * 100).toFixed(1)}%` : '--'}</Text>
                      </TableCell>
                      <TableCell>{c.oracle}</TableCell>
                      <TableCell><StatusChip status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!dashboard?.claimsQueue?.length && (
                <Text style={styles.emptyText}>No claims in queue.</Text>
              )}
            </CardContent>
          </Card>
        </>
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
  },
  accountCard: {
    marginBottom: 24,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  accountLabel: {
    fontSize: 12,
    color: '#666',
  },
  accountValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  statCard: {
    width: '50%',
    padding: 6,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  statText: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentGrid: {
    gap: 24,
    marginBottom: 24,
  },
  policiesCard: {},
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tableContainer: {
    padding: 0,
  },
  heatmapCard: {},
  heatmapGrid: {
    gap: 4,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 12,
    color: '#666',
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  claimsCard: {
    marginBottom: 24,
  },
  aiScore: {
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    paddingVertical: 12,
  },
});
