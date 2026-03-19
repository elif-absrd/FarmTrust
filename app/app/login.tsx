import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, User, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { TEST_USERS } from '@/utils/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const success = await login(username.trim(), password);
      if (success) {
        router.replace('/(tabs)');
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillTestUser = (u: (typeof TEST_USERS)[number]) => {
    setUsername(u.username);
    setPassword(u.password);
    setError('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Shield color="#fff" size={36} />
          </View>
          <Text style={styles.appName}>FarmTrust</Text>
          <Text style={styles.tagline}>Protecting your harvest, securing your future</Text>
        </View>

        {/* Login card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to your account</Text>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrapper}>
              <User color="#6b7280" size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock color="#6b7280" size={18} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                {showPassword ? (
                  <EyeOff color="#6b7280" size={18} />
                ) : (
                  <Eye color="#6b7280" size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Test accounts */}
        <View style={styles.testSection}>
          <Text style={styles.testSectionTitle}>Test Accounts</Text>
          <Text style={styles.testSectionHint}>Tap to auto-fill credentials</Text>
          {TEST_USERS.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.testUserRow}
              onPress={() => fillTestUser(u)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.roleBadge,
                  u.role === 'farmer' && styles.roleFarmer,
                  u.role === 'provider' && styles.roleProvider,
                  u.role === 'admin' && styles.roleAdmin,
                ]}
              >
                <Text style={styles.roleBadgeText}>{u.role}</Text>
              </View>
              <View style={styles.testUserInfo}>
                <Text style={styles.testUserName}>{u.name}</Text>
                <Text style={styles.testUserCreds}>
                  {u.username} / {u.password}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f4f6' },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1a73e8',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },

  // Fields
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    height: 46,
    fontSize: 15,
    color: '#111827',
  },
  inputPassword: { paddingRight: 8 },
  eyeBtn: { padding: 4 },

  // Error
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 12,
    marginTop: -4,
  },

  // Button
  loginButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#1a73e8',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  loginButtonDisabled: { opacity: 0.65 },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Test section
  testSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  testSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  testSectionHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 14,
  },
  testUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 12,
  },
  roleFarmer: { backgroundColor: '#d1fae5' },
  roleProvider: { backgroundColor: '#dbeafe' },
  roleAdmin: { backgroundColor: '#fef3c7' },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#374151',
  },
  testUserInfo: { flex: 1 },
  testUserName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  testUserCreds: { fontSize: 12, color: '#6b7280', marginTop: 1 },
});
