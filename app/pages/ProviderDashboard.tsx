import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { StatusChip } from '../components/StatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Shield, FileText, Wallet, Activity } from 'lucide-react-native';

const providerStats = [
  { label: 'Total Policies', value: '1,247', icon: Shield },
  { label: 'Pending Claims', value: '38', icon: FileText },
  { label: 'Payouts Disbursed', value: '₹4.2L', icon: Wallet },
  { label: 'AI Accuracy', value: '96.3%', icon: Activity },
];

const policies = [
  { farmerId: 'FRM-0042', crop: 'Rice', coverage: '₹15,000', status: 'Active' },
  { farmerId: 'FRM-0089', crop: 'Wheat', coverage: '₹12,000', status: 'Active' },
  { farmerId: 'FRM-0123', crop: 'Cotton', coverage: '₹18,000', status: 'Expired' },
  { farmerId: 'FRM-0201', crop: 'Sugarcane', coverage: '₹22,000', status: 'Active' },
];

const claimsQueue = [
  { farmer: 'FRM-0042', disease: 'Rice Blast', aiScore: '94.6%', oracle: '3/5 Verified', status: 'Smart Contract Triggered' },
  { farmer: 'FRM-0089', disease: 'Leaf Rust', aiScore: '87.2%', oracle: '2/5 Pending', status: 'Oracle Verifying' },
  { farmer: 'FRM-0201', disease: 'Red Rot', aiScore: '91.1%', oracle: '0/5 Pending', status: 'Pending' },
];

// Simple heatmap grid
const heatmapData = [
  [0, 1, 0, 2, 3, 1, 0],
  [1, 2, 3, 3, 2, 0, 0],
  [0, 1, 2, 3, 3, 2, 1],
  [0, 0, 1, 2, 2, 1, 0],
  [0, 0, 0, 1, 1, 0, 0],
];

const heatColors = ['#1a73e810', '#22c55e40', '#f59e0b50', '#ef444460'];

export default function ProviderDashboard() {
  return (
    <PageWrapper>
      <Text style={styles.title}>Insurance Provider Dashboard</Text>

      {/* Stats */}
      <View style={styles.statsGrid}>
        {providerStats.map((s, index) => (
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

      {/* Policies and Heatmap */}
      <View style={styles.contentGrid}>
        {/* Policies */}
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
                  <TableHead>Crop</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.farmerId}>
                    <TableCell className="font-mono">{p.farmerId}</TableCell>
                    <TableCell>{p.crop}</TableCell>
                    <TableCell>{p.coverage}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card style={styles.heatmapCard}>
          <CardHeader>
            <CardTitle>
              <Text style={styles.cardTitle}>Disease Outbreak Map</Text>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.heatmapGrid}>
              {heatmapData.map((row, ri) => (
                <View key={ri} style={styles.heatmapRow}>
                  {row.map((val, ci) => (
                    <View
                      key={ci}
                      style={[
                        styles.heatmapCell,
                        { backgroundColor: heatColors[val] }
                      ]}
                    />
                  ))}
                </View>
              ))}
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

      {/* Claims Queue */}
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
                <TableHead>Farmer</TableHead>
                <TableHead>Disease</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Oracle</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimsQueue.map((c) => (
                <TableRow key={c.farmer}>
                  <TableCell className="font-mono">{c.farmer}</TableCell>
                  <TableCell>{c.disease}</TableCell>
                  <TableCell>
                    <Text style={styles.aiScore}>{c.aiScore}</Text>
                  </TableCell>
                  <TableCell>{c.oracle}</TableCell>
                  <TableCell><StatusChip status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
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
  policiesCard: {
    // Card styles
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tableContainer: {
    padding: 0,
  },
  heatmapCard: {
    // Card styles
  },
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
});
