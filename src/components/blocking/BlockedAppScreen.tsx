import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/blocking/AppIcon';
import { useBlockingClock } from '@/components/blocking/useBlockingClock';
import { Notice } from '@/components/practice/FeedbackPanel';
import { Text, useThemeColor, View } from '@/components/Themed';
import { PrimaryButton, SecondaryButton, TextButton } from '@/components/ui/ios';
import { formatCountdown } from '@/domain/blocking/lockMachine';
import { DEMO_LABEL } from '@/services/screenTime/demo';
import { startPracticeFor } from '@/state/blockingStore';

/**
 * What "Try opening" shows (blocking demo). Locked: the Atlas block screen. Unlocked: the app, with the time left.
 * It follows the lock state live, so an unlock that runs out turns this into the block screen again.
 */
export function BlockedAppScreen({ appId }: { appId: string }) {
  const router = useRouter();
  const { ready, apps, now } = useBlockingClock();
  const secondary = useThemeColor({}, 'secondaryText');
  const success = useThemeColor({}, 'success');
  const [caughtUp, setCaughtUp] = useState(false);
  const app = apps.find((candidate) => candidate.id === appId) ?? null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/unlock'));

  if (!ready) return null;

  if (!app) {
    return (
      <Frame>
        <Text style={styles.title} accessibilityRole="header">
          This app isn&apos;t blocked
        </Text>
        <Text style={[styles.copy, { color: secondary }]}>Choose it in Blocked apps first.</Text>
        <SecondaryButton label="Close" onPress={close} />
      </Frame>
    );
  }

  function startPractice() {
    const result = startPracticeFor(appId);
    if (result.kind === 'started' || result.kind === 'resumed') {
      router.replace({ pathname: '/practice/[sessionId]', params: { sessionId: result.sessionId } });
    } else if (result.kind === 'caught-up') {
      setCaughtUp(true);
    }
  }

  if (app.state === 'unlocked' && app.unlockedUntil !== null) {
    return (
      <Frame>
        <AppIcon app={app} size={88} />
        <Text style={styles.title} accessibilityRole="header">
          {app.name}
        </Text>
        <Text style={[styles.countdown, { color: success }]} accessibilityRole="timer">
          Unlocked, {formatCountdown(app.unlockedUntil - now)} left
        </Text>
        <Text style={[styles.copy, { color: secondary }]}>This is a simulated {app.name}. It locks again when the time is up.</Text>
        <PrimaryButton label="Close" onPress={close} />
        <Demo />
      </Frame>
    );
  }

  if (app.state === 'practicing') {
    return (
      <Frame>
        <AppIcon app={app} size={88} />
        <Text style={styles.title} accessibilityRole="header">
          {app.name} is locked.
        </Text>
        <Text style={[styles.copy, { color: secondary }]}>Finish your practice session to unlock it.</Text>
        <PrimaryButton label="Resume practice" onPress={startPractice} />
        <TextButton label="Not now" onPress={close} />
        <Demo />
      </Frame>
    );
  }

  return (
    <Frame>
      <AppIcon app={app} size={88} />
      <Text style={styles.title} accessibilityRole="header">
        {app.name} is locked. Practice to unlock.
      </Text>
      {app.state === 'relocked' ? <Text style={[styles.copy, { color: secondary }]}>Your unlock ran out.</Text> : null}
      {caughtUp ? <Notice text="You're all caught up, so no practice is waiting right now. Try again after your next review is due." /> : null}
      <PrimaryButton label="Start practice" onPress={startPractice} />
      <TextButton label="Not now" onPress={close} />
      <Demo />
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.frame} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

function Demo() {
  const secondary = useThemeColor({}, 'secondaryText');
  return <Text style={[styles.demo, { color: secondary }]}>{DEMO_LABEL}</Text>;
}

const styles = StyleSheet.create({
  frame: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  column: { gap: 14, alignItems: 'stretch' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  copy: { fontSize: 17, lineHeight: 22, textAlign: 'center' },
  countdown: { fontSize: 22, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  demo: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8 },
});
