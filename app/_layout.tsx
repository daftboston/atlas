import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that deep links into nested routes keep the tabs as the initial route.
  initialRouteName: '(tabs)',
};

// Keep the splash screen up until the root layout has mounted.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // Route map: architecture §3. The onboarding gate is not wired up yet.
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen
          name="practice/[sessionId]"
          options={{ presentation: 'fullScreenModal', title: 'Practice' }}
        />
        <Stack.Screen name="practice/summary/[sessionId]" options={{ title: 'Summary' }} />
      </Stack>
    </ThemeProvider>
  );
}
