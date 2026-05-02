import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/utils/api';

import { registerForPushNotifications } from '../services/notification.service';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Create a client
const queryClient = new QueryClient();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

/** Redirects unauthenticated users to /login and authenticated users away from it. */
function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const firstSegment = segments[0] as string | undefined;
    const secondSegment = segments[1] as string | undefined;
    const inAuthGroup = firstSegment === 'login' || firstSegment === 'signup';
    const onboardingComplete = user?.role === 'ADMIN' || user?.onboarding_completed === true;
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && !onboardingComplete && (! (firstSegment === '(tabs)' && secondSegment === 'orchard'))) {
      router.replace('/(tabs)/orchard');
    } else if (user && inAuthGroup) {
      router.replace(onboardingComplete ? '/(tabs)' : '/(tabs)/orchard');
    }
  }, [user, isLoading, segments]);

  return null;
}

function PushTokenSync() {
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token || !user) return;

    let cancelled = false;

    (async () => {
      const expoPushToken = await registerForPushNotifications();
      if (cancelled || !expoPushToken) return;

      try {
        await apiRequest(
          '/api/auth/push-token',
          {
            method: 'POST',
            body: JSON.stringify({ expoPushToken }),
          },
          token,
        );
      } catch (error) {
        // Non-fatal: user can still use the app.
        console.warn('Failed to sync push token', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <PushTokenSync />
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
