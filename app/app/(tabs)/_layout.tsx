import React from 'react';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Tabs
      initialRouteName={isAdmin ? 'admin-claims' : 'index'}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      {isAdmin ? (
        <>
          {/* Disable these routes for admins (no tab, no direct href) */}
          <Tabs.Screen name="index" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen name="scan" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen name="risk" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen name="claims" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen name="provider" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen name="orchard" options={{ href: null, tabBarButton: () => null }} />
          <Tabs.Screen
            name="admin-claims"
            options={{
              title: 'Claims',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'doc.text.fill',
                    android: 'description',
                    web: 'description',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="wallet"
            options={{
              title: 'Wallet',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'wallet.pass.fill',
                    android: 'wallet',
                    web: 'wallet',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="admin-transactions"
            options={{
              title: 'Transactions',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'arrow.left.arrow.right.circle.fill',
                    android: 'sync_alt',
                    web: 'repeat',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
        </>
      ) : (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'house.fill',
                    android: 'home',
                    web: 'home',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="scan"
            options={{
              title: 'Scan',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'camera.fill',
                    android: 'camera',
                    web: 'camera',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="risk"
            options={{
              title: 'Risk',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'chart.bar.fill',
                    android: 'analytics',
                    web: 'analytics',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="claims"
            options={{
              title: 'Claims',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'doc.text.fill',
                    android: 'description',
                    web: 'description',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="wallet"
            options={{
              title: 'Wallet',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'wallet.pass.fill',
                    android: 'wallet',
                    web: 'wallet',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="provider"
            options={{
              title: 'Provider',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'building.2.fill',
                    android: 'business',
                    web: 'business',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="orchard"
            options={{
              title: 'Orchard',
              tabBarIcon: ({ color }) => (
                <SymbolView
                  name={{
                    ios: 'leaf.fill',
                    android: 'eco',
                    web: 'eco',
                  }}
                  tintColor={color}
                  size={28}
                />
              ),
            }}
          />
        </>
      )}
    </Tabs>
  );
}
