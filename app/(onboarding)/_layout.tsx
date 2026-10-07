import { Stack } from 'expo-router';

// Architecture §3: a stack with no tabs. The onboarding gate in the root layout
// is not wired up yet, so nothing redirects here today.
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerBackVisible: false, gestureEnabled: false }} />;
}
