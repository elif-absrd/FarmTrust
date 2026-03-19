import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authenticate, TokenPayload, verifyToken } from '@/utils/auth';

const TOKEN_KEY = 'farmtrust_auth_token';

// expo-secure-store is native-only; fall back to localStorage on web
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthContextType {
  user: TokenPayload | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem(TOKEN_KEY);
        if (stored) {
          const payload = verifyToken(stored);
          if (payload) {
            setToken(stored);
            setUser(payload);
          } else {
            await storage.removeItem(TOKEN_KEY);
          }
        }
      } catch {
        // Ignore storage errors on first load
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const newToken = authenticate(username, password);
    if (!newToken) return false;
    const payload = verifyToken(newToken);
    if (!payload) return false;
    await storage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(payload);
    return true;
  };

  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
