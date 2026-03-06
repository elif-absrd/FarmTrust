import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { StatusChip } from '../components/StatusChip';
import { SeverityBadge } from '../components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { FileText, Link as LinkIcon } from 'lucide-react-native';

const claims = [
  { id: 'CLM-001', crop: 'Rice', disease: 'Rice Blast', date: '2026-02-28', severity: 'High' as const, amount: '₹8,500', status: 'Payout Complete' },
  { id: 'CLM-002', crop: 'Wheat', disease: 'Leaf Rust', date: '2026-03-01', severity: 'Medium' as const, amount: '₹4,200', status: 'Smart Contract Triggered' },
  { id: 'CLM-003', crop: 'Cotton', disease: 'Boll Rot', date: '2026-03-03', severity: 'High' as const, amount: '₹6,800', status: 'Oracle Verifying' },
  { id: 'CLM-004', crop: 'Rice', disease: 'Sheath Blight', date: '2026-03-04', severity: 'Medium' as const, amount: '₹3,100', status: 'Pending' },
];

const txFeed = [
  { hash: '0xa3f2...8c1d', time: '2 min ago', status: 'Confirmed' },
  { hash: '0xb7e1...4f2a', time: '5 min ago', status: 'Confirmed' },
  { hash: '0xc9d4...1e3b', time: '12 min ago', status: 'Pending' },
];

const auditTrail = [
  { step: 'Claim Filed', time: '2026-02-28 10:30', detail: 'Farmer submitted via mobile app' },
  { step: 'AI Analysis', time: '2026-02-28 10:31', detail: 'Rice Blast detected, 94.6% confidence' },
  { step: 'Oracle Verification', time: '2026-02-28 11:15', detail: '3/5 oracle nodes confirmed' },
  { step: 'Smart Contract Triggered', time: '2026-02-28 11:16', detail: 'PolicyID: 0x8f2a...3c1d' },
  { step: 'Payout Complete', time: '2026-02-28 11:20', detail: '₹8,500 MockINR transferred' },
];

export default function ClaimsPage() {
  const [selectedClaim, setSelectedClaim] = useState<typeof claims[0] | null>(null);

  return (
    <PageWrapper>
      <Text style={styles.title}>Insurance Claims</Text>

      <View style={styles.mainContent}>
        {/* Claims List */}
        <View style={styles.claimsList}>
          {claims.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedClaim(c)}
              activeOpacity={0.7}
            >
              <Card style={styles.claimCard}>
                <CardContent style={styles.claimContent}>
                  <View style={styles.claimLeft}>
                    <FileText color="#666" size={20} />
                    <View style={styles.claimInfo}>
                      <Text style={styles.claimTitle}>{c.crop} — {c.disease}</Text>
                      <Text style={styles.claimMeta}>{c.id} · {c.date}</Text>
                    </View>
                  </View>
                  <View style={styles.claimRight}>
                    <SeverityBadge level={c.severity} />
                    <StatusChip status={c.status} />
                    <Text style={styles.claimAmount}>{c.amount}</Text>
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Blockchain TX Feed */}
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
            {txFeed.map((tx, i) => (
              <View key={i} style={styles.txItem}>
                <Text style={styles.txHash}>{tx.hash}</Text>
                <View style={styles.txMeta}>
                  <Text style={styles.txTime}>{tx.time}</Text>
                  <Text style={[
                    styles.txStatus,
                    tx.status === 'Confirmed' ? styles.txConfirmed : styles.txPending
                  ]}>
                    {tx.status}
                  </Text>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      </View>

      {/* Detail Modal */}
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim {selectedClaim?.id} — Audit Trail</DialogTitle>
          </DialogHeader>
          <View style={styles.auditTrail}>
            {auditTrail.map((a, i) => (
              <View key={i} style={styles.auditItem}>
                <View style={styles.auditTimeline}>
                  <View style={styles.auditDot} />
                  {i < auditTrail.length - 1 && <View style={styles.auditLine} />}
                </View>
                <View style={styles.auditContent}>
                  <Text style={styles.auditStep}>{a.step}</Text>
                  <Text style={styles.auditTime}>{a.time}</Text>
                  <Text style={styles.auditDetail}>{a.detail}</Text>
                </View>
              </View>
            ))}
          </View>
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
  claimsList: {
    gap: 12,
  },
  claimCard: {
    // Card styles
  },
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
});
