import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Wallet, Copy, ArrowDownLeft } from 'lucide-react-native';
import { apiRequest } from '@/utils/api';
import { useAuth } from '@/context/AuthContext';

interface WalletTransaction {
  id: number;
  label: string;
  amount: number;
  date: string;
  txHash?: string | null;
}

interface WalletSummaryResponse {
  account: {
    name?: string | null;
    walletAddress?: string | null;
    accountNumber?: string | null;
    accountName?: string | null;
    bankName?: string | null;
  };
  balance: number;
  transactions: WalletTransaction[];
}

function formatCurrency(amount?: number | null) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '₹0';
  return `₹${value.toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function WalletPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<WalletSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      try {
        const response = await apiRequest<WalletSummaryResponse>('/api/wallet', { method: 'GET' }, token);
        setSummary(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load wallet';
        Alert.alert('Wallet unavailable', message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const copyAddress = () => {
    Alert.alert('Copied!', 'Wallet address copied to clipboard.');
  };

  return (
    <PageWrapper>
      <Text style={styles.title}>Blockchain Wallet</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      ) : (
        <>
          <Card style={styles.balanceCard}>
            <CardContent style={styles.balanceContent}>
              <View style={styles.balanceHeader}>
                <Wallet color="white" size={20} />
                <Text style={styles.balanceLabel}>MockINR Balance</Text>
              </View>
              <Text style={styles.balanceAmount}>{formatCurrency(summary?.balance || 0)}</Text>
              <View style={styles.addressContainer}>
                <Text style={styles.address}>{summary?.account.walletAddress || 'Wallet not set'}</Text>
                <TouchableOpacity onPress={copyAddress} activeOpacity={0.7}>
                  <Copy color="rgba(255, 255, 255, 0.7)" size={16} />
                </TouchableOpacity>
              </View>
            </CardContent>
          </Card>

          <Card style={styles.accountCard}>
            <CardHeader>
              <CardTitle>
                <Text style={styles.accountTitle}>Account Details</Text>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Account Name</Text>
                <Text style={styles.accountValue}>{summary?.account.accountName || summary?.account.name || '--'}</Text>
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Account Number</Text>
                <Text style={styles.accountValue}>{summary?.account.accountNumber || '--'}</Text>
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Bank</Text>
                <Text style={styles.accountValue}>{summary?.account.bankName || '--'}</Text>
              </View>
            </CardContent>
          </Card>

          <Card style={styles.historyCard}>
            <CardHeader>
              <CardTitle>
                <Text style={styles.historyTitle}>Transaction History</Text>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.transactions?.length ? (
                summary.transactions.map((tx) => (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={styles.txLeft}>
                      <ArrowDownLeft color="#22c55e" size={16} />
                      <View>
                        <Text style={styles.txLabel}>{tx.label}</Text>
                        <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.txAmount, styles.txIn]}>
                      +{formatCurrency(tx.amount)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No payouts yet.</Text>
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
  balanceCard: {
    marginBottom: 24,
    overflow: 'hidden',
  },
  balanceContent: {
    padding: 24,
    backgroundColor: '#1a73e8',
    borderRadius: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    opacity: 0.9,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'white',
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  address: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  accountCard: {
    marginBottom: 24,
  },
  accountTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  historyCard: {},
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  txLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  txDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  txIn: {
    color: '#22c55e',
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    paddingVertical: 12,
  },
});
