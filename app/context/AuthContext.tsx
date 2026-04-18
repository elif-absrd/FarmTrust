import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '@/utils/api';

const TOKEN_KEY = 'farmtrust_auth_token';
const USER_KEY = 'farmtrust_auth_user';

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

export interface AuthUser {
  id: number;
  email: string;
  farmer_name: string | null;
  wallet_address: string | null;
  region?: string | null;
  role?: string;
  subscription_plan?: string;
  subscription_status?: string;
  onboarding_completed?: boolean;
}

interface SignupPayload {
  email: string;
  password: string;
  farmerName: string;
  phone?: string;
  walletAddress?: string;
  region?: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (payload: SignupPayload) => Promise<boolean>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        const storedUser = await storage.getItem(USER_KEY);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        setToken(storedToken);

        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser) as AuthUser);
          } catch {
            await storage.removeItem(USER_KEY);
          }
        }

        const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', { method: 'GET' }, storedToken);
        setUser(me.user);
        await storage.setItem(USER_KEY, JSON.stringify(me.user));
      } catch {
        await storage.removeItem(TOKEN_KEY);
        await storage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      await storage.setItem(TOKEN_KEY, response.token);
      await storage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
      return true;
    } catch {
      return false;
    }
  };

  const signup = async (payload: SignupPayload): Promise<boolean> => {
    try {
      const response = await apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await storage.setItem(TOKEN_KEY, response.token);
      await storage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
      return true;
    } catch {
      return false;
    }
  };

  const refreshUser = async (): Promise<AuthUser | null> => {
    if (!token) return null;

    try {
      const response = await apiRequest<{ user: AuthUser }>('/api/auth/me', { method: 'GET' }, token);
      await storage.setItem(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
      return response.user;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
