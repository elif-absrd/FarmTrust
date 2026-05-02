import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Call this once after login so we can sync the token to the backend.
export async function registerForPushNotifications(): Promise<string | null> {
  // Web push requires a VAPID key + service worker setup.
  // Skip on web to avoid CodedError during development.
  if (Platform.OS === 'web') {
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const projectId =
    (Constants.expoConfig as any)?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId ||
    null;

  try {
    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    console.warn('Failed to fetch Expo push token', error);
    return null;
  }
}

// Call this after receiving txHash from your approve API response
export async function notifyFarmer(txHash: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Payout Confirmed!',
      body: 'Your crop insurance payout has been processed.',
      data: {
        polygonscanUrl: `https://mumbai.polygonscan.com/tx/${txHash}`,
      },
    },
    trigger: null, // immediate
  });
}