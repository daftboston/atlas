import { Stack } from 'expo-router';

// Architecture §3: a stack with no tabs. The root layout sends an unfinished
// learner here, and sends a finished learner back to Learn. The frame draws
// the large title, so this stack does not add a second bar.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
