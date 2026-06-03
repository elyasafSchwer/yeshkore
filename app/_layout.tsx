import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from '@/context/auth';
import { theme } from '@/lib/theme';
import InstructionsModal from '@/components/InstructionsModal';

SplashScreen.preventAutoHideAsync();
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <RootNavigator />
          <InstructionsModal />
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, profile, isLoading, isProfileLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isProfileLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, isProfileLoading]);

  if (isLoading || isProfileLoading) return null;

  const isAuthenticated = !!session;
  const hasCompletedOnboarding = !!profile?.role;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && !hasCompletedOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && hasCompletedOnboarding}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
