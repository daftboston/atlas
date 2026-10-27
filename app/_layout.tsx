import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactElement } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { Text, useThemeColor, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { PrimaryButton } from '@/components/ui/ios';
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
  const { ready, error, retry } = useAppBootstrap();

  useEffect(() => {
    if (ready || error) {
      SplashScreen.hideAsync();
    }
  }, [ready, error]);

  if (error) {
    return <StartupError message={error.message} onRetry={retry} />;
  }

  if (!ready) {
    // The splash screen covers the first load. This shows while Retry runs.
    return <StartupLoading />;
  }

  return <RootLayoutNav />;
}

function StartupLoading() {
  return (
    <View lightColor={Colors.light.wash} darkColor={Colors.dark.wash} style={styles.loading}>
      <ActivityIndicator accessibilityLabel="Opening Atlas" />
      <Text style={styles.loadingText}>Opening Atlas…</Text>
    </View>
  );
}

function StartupError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const secondary = useThemeColor({}, 'secondaryText');
  // Nothing else is on screen, so VoiceOver must be told what happened and what to do.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("Atlas couldn't open your saved data. Tap Retry.");
  }, [message]);
  return (
    <View lightColor={Colors.light.wash} darkColor={Colors.dark.wash} style={styles.errorScreen}>
      {/* Scrolls so a long message or a large text size never pushes Retry off the screen. */}
      <ScrollView contentContainerStyle={styles.error} contentInsetAdjustmentBehavior="automatic">
        <Text style={styles.errorTitle} accessibilityRole="header">
          Atlas couldn&apos;t open your saved data
        </Text>
        <Text style={styles.errorBody}>Tap Retry. If it keeps failing, close Atlas and open it again.</Text>
        <Text style={[styles.errorMessage, { color: secondary }]}>{message}</Text>
        <PrimaryButton label="Retry" onPress={onRetry} />
      </ScrollView>
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 17 },
  errorScreen: { flex: 1 },
  error: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
  },
  errorBody: {
    fontSize: 17,
    lineHeight: 22,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 20,
  },
});
