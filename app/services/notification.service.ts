import * as Notifications from 'expo-notifications';

// Call this once at app startup in your _layout.tsx
export async function registerForPushNotifications(): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permission not granted');
    return;
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