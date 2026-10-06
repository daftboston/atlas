import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppBootstrap } from '@/state/bootstrap';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that deep links into nested routes keep the tabs as the initial route.
  initialRouteName: '(tabs)',
};

// Keep the splash screen up until the local database is ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, error } = useAppBootstrap();

  useEffect(() => {
    if (ready || error) {
      SplashScreen.hideAsync();
    }
  }, [ready, error]);

  if (error) {
    return <StartupError message={error.message} />;
  }

  if (!ready) {
    return null;
  }

  return <RootLayoutNav />;
}

function StartupError({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle} accessibilityRole="header">
        Atlas couldn&apos;t open your saved data
      </Text>
      <Text style={styles.errorMessage}>{message}</Text>
    </View>
  );
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

const styles = StyleSheet.create({
  error: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 15,
    opacity: 0.75,
  },
});
