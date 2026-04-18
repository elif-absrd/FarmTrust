import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, UserPlus } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();

  const [farmerName, setFarmerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!farmerName.trim() || !email.trim() || !password.trim()) {
      setError('Farmer name, email, and password are required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const ok = await signup({
        farmerName: farmerName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        walletAddress: walletAddress.trim() || undefined,
        region: region.trim() || undefined,
      });

      if (!ok) {
        setError('Signup failed. Please check the details and try again.');
        return;
      }

      router.replace('/(tabs)/orchard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Shield color="#fff" size={32} />
          </View>
          <Text style={styles.title}>Create Farmer Account</Text>
          <Text style={styles.subtitle}>Free subscription activates automatically after signup</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Farmer name *"
            value={farmerName}
            onChangeText={setFarmerName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Wallet address"
            value={walletAddress}
            onChangeText={setWalletAddress}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Region"
            value={region}
            onChangeText={setRegion}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.buttonRow}>
                <UserPlus color="#fff" size={16} />
                <Text style={styles.buttonText}>Sign Up</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkWrap}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { flexGrow: 1, padding: 24, paddingTop: 50, paddingBottom: 30 },
  header: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#6b7280', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: '#f9fafb',
  },
  error: { color: '#b91c1c', marginTop: 2 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginTop: 8,
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkWrap: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#1a73e8', fontWeight: '600' },
});
