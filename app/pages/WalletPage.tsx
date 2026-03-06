import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Wallet, Copy, ArrowDownLeft, ArrowUpRight, Zap } from 'lucide-react-native';

const transactions = [
  { type: 'in', label: 'Payout — Rice Blast Claim', amount: '+₹8,500', date: 'Feb 28' },
  { type: 'out', label: 'Policy Purchase — Wheat', amount: '-₹1,200', date: 'Feb 25' },
  { type: 'in', label: 'Payout — Leaf Blight Claim', amount: '+₹3,500', date: 'Feb 20' },
  { type: 'out', label: 'Policy Purchase — Cotton', amount: '-₹950', date: 'Feb 15' },
  { type: 'in', label: 'Government Subsidy', amount: '+₹2,000', date: 'Feb 10' },
];

export default function WalletPage() {
  const [balance, setBalance] = useState(12450);
  const [animating, setAnimating] = useState(false);

  const simulatePayout = () => {
    setAnimating(true);
    setTimeout(() => {
      setBalance((b) => b + 5000);
      setAnimating(false);
      Alert.alert('Payout Received! 🎉', '₹5,000 MockINR has been credited to your wallet.');
    }, 2000);
  };

  const copyAddress = () => {
    Alert.alert('Copied!', 'Wallet address copied to clipboard.');
  };

  return (
    <PageWrapper>
      <Text style={styles.title}>Blockchain Wallet</Text>

      {/* Balance Card */}
      <Card style={styles.balanceCard}>
        <CardContent style={styles.balanceContent}>
          <View style={styles.balanceHeader}>
            <Wallet color="white" size={20} />
            <Text style={styles.balanceLabel}>MockINR Balance</Text>
          </View>
          <Text style={[styles.balanceAmount, animating && styles.balanceAnimating]}>
            ₹{balance.toLocaleString()}
          </Text>
          <View style={styles.addressContainer}>
            <Text style={styles.address}>0x1a2b...1234</Text>
            <TouchableOpacity onPress={copyAddress} activeOpacity={0.7}>
              <Copy color="rgba(255, 255, 255, 0.7)" size={16} />
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      <Button
        onPress={simulatePayout}
        disabled={animating}
        style={styles.payoutButton}
      >
        <View style={styles.buttonContent}>
          {animating ? (
            <View style={styles.spinner} />
          ) : (
            <Zap color="white" size={16} />
          )}
          <Text style={styles.buttonText}>
            {animating ? 'Processing...' : 'Simulate Payout'}
          </Text>
        </View>
      </Button>

      {/* Transaction History */}
      <Card style={styles.historyCard}>
        <CardHeader>
          <CardTitle>
            <Text style={styles.historyTitle}>Transaction History</Text>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.map((tx, i) => (
            <View key={i} style={styles.txItem}>
              <View style={styles.txLeft}>
                {tx.type === 'in' ? (
                  <ArrowDownLeft color="#22c55e" size={16} />
                ) : (
                  <ArrowUpRight color="#f59e0b" size={16} />
                )}
                <View>
                  <Text style={styles.txLabel}>{tx.label}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
              </View>
              <Text style={[
                styles.txAmount,
                tx.type === 'in' ? styles.txIn : styles.txOut
              ]}>
                {tx.amount}
              </Text>
            </View>
          ))}
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
  balanceAnimating: {
    transform: [{ scale: 1.1 }],
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
  payoutButton: {
    marginBottom: 24,
    backgroundColor: '#8b5cf6',
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
  spinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: 'white',
    borderTopColor: 'transparent',
    borderRadius: 8,
  },
  historyCard: {
    // Card styles
  },
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
  txOut: {
    color: '#f59e0b',
  },
});
