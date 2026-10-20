import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { Wash } from '@/components/ui/Wash';
import Colors from '@/constants/Colors';
import { useAppBootstrap } from '@/state/bootstrap';
import { useSettings } from '@/state/settingsStore';

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
    <View lightColor={Colors.light.wash} darkColor={Colors.dark.wash} style={styles.error}>
      <Text style={styles.errorTitle} accessibilityRole="header">
        Atlas couldn&apos;t open your saved data
      </Text>
      <Text style={styles.errorMessage}>{message}</Text>
    </View>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const settings = useSettings();
  const segments = useSegments();
  const top = segments[0];
  const inOnboarding = top === '(onboarding)';
  const inPractice = top === 'practice';
  let redirect: ReactElement | null = null;
  if (settings.ready && !settings.onboardingCompleted && !inOnboarding && !inPractice) {
    redirect = <Redirect href="/(onboarding)/welcome" />;
  } else if (settings.ready && settings.onboardingCompleted && inOnboarding) {
    redirect = <Redirect href="/(tabs)/learn" />;
  }

  const palette = Colors[colorScheme];
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.tint,
      background: 'transparent',
      card: 'transparent',
      text: palette.text,
      border: palette.separator,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <View style={styles.root}>
        <Wash />
        {redirect}
        <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { color: palette.text },
          headerTintColor: palette.tint,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen
          name="practice/[sessionId]"
          options={{ presentation: 'fullScreenModal', title: 'Practice' }}
        />
        <Stack.Screen name="practice/summary/[sessionId]" options={{ title: 'Summary' }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
