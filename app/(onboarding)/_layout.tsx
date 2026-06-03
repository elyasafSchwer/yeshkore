import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: 'השלמת פרופיל',
        headerBackVisible: false,
      }}
    />
  );
}
