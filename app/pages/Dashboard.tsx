import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { PageWrapper } from '../components/PageWrapper';
import { SeverityBadge } from '../components/SeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Shield, FileText, ScanLine, Wallet, Camera, AlertTriangle, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

const stats = [
  { label: 'Active Policies', value: '3', icon: Shield, color: '#1a73e8' },
  { label: 'Claims Filed', value: '2', icon: FileText, color: '#f59e0b' },
  { label: 'Last Scan', value: '2h ago', icon: ScanLine, color: '#10b981' },
  { label: 'Wallet Balance', value: '₹12,450', icon: Wallet, color: '#8b5cf6' },
];

const alerts = [
  { crop: 'Rice (Paddy)', disease: 'Rice Blast', severity: 'High' as const, time: '2 hours ago' },
  { crop: 'Wheat', disease: 'Leaf Rust', severity: 'Medium' as const, time: '1 day ago' },
  { crop: 'Cotton', disease: 'Boll Rot', severity: 'Low' as const, time: '3 days ago' },
];

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <PageWrapper>
      {/* Top bar with logout */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <LogOut color="#6b7280" size={20} />
        </TouchableOpacity>
      </View>

      {/* Hero banner */}
      <View style={styles.heroBanner}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800' }} 
          style={styles.heroImage}
        />
        <View style={styles.heroOverlay}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Namaste, {user?.farmer_name ?? 'Farmer'} 🌾</Text>
            <Text style={styles.heroSubtitle}>
              Your crops are being monitored. 3 active policies protecting your harvest.
            </Text>
            <Badge 
              style={styles.successBadge}
              textStyle={styles.successBadgeText}
            >
              <View style={styles.badgeContent}>
                <Shield color="white" size={12} />
                <Text style={styles.successBadgeText}> Fully Insured</Text>
              </View>
            </Badge>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        {stats.map((s, index) => (
          <View key={s.label} style={styles.statCard}>
            <Card>
              <CardContent style={styles.statContent}>
                <View style={[styles.iconContainer, { backgroundColor: `${s.color}15` }]}>
                  <s.icon color={s.color} size={20} />
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

      {/* Recent Alerts */}
      <Card style={styles.alertsCard}>
        <CardHeader>
          <CardTitle>
            <View style={styles.alertsHeader}>
              <AlertTriangle color="#f59e0b" size={20} />
              <Text style={styles.alertsTitle}>Recent Disease Alerts</Text>
            </View>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.map((a, i) => (
            <View key={i} style={styles.alertItem}>
              <View>
                <Text style={styles.alertCrop}>{a.crop}</Text>
                <Text style={styles.alertDetails}>{a.disease} · {a.time}</Text>
              </View>
              <SeverityBadge level={a.severity} />
            </View>
          ))}
        </CardContent>
      </Card>

      {/* FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/(tabs)/scan' as any)}
        activeOpacity={0.8}
      >
        <Camera color="white" size={24} />
      </TouchableOpacity>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  logoutBtn: {
    padding: 6,
  },
  heroBanner: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  heroContent: {
    // Content styles
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  successBadge: {
    backgroundColor: '#22c55e',
    alignSelf: 'flex-start',
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successBadgeText: {
    color: 'white',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
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
  alertsCard: {
    marginBottom: 80,
  },
  alertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  alertCrop: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertDetails: {
    fontSize: 12,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
