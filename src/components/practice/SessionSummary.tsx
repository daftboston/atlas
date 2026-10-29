import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import { PrimaryButton, SecondaryButton } from '@/components/ui/ios';
import type { PracticeView } from '@/data/repositories/sessionRepo';
import { RATING_HARD_BELOW } from '@/domain/config';
import { useSingleTap } from '@/lib/useSingleTap';
import { blockedAppForSession, useBlocking } from '@/state/blockingStore';
import { openPractice, refreshSessionHome } from '@/state/sessionStore';

export function SessionSummary({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const secondary = useThemeColor({}, 'secondaryText');
  const [view] = useState<PracticeView | null>(() => openPractice(sessionId));
  const { apps } = useBlocking();
  // A session started from a blocked app ends back at the Unlock tab, where the app shows its new state.
  const blocked = apps.find((app) => app.sessionId === sessionId) ?? blockedAppForSession(sessionId);
  const finish = useSingleTap(() =>
    router.replace(view?.session.mode === 'onboarding' ? '/(onboarding)/habit' : blocked ? '/(tabs)/unlock' : '/(tabs)/learn'),
  );

  useEffect(() => {
    refreshSessionHome();
  }, [sessionId]);

  if (!view) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Summary
        </Text>
        <Text style={styles.copy}>This session isn&apos;t on this device.</Text>
        <SecondaryButton label="Back to Learn" onPress={() => router.replace('/(tabs)/learn')} />
      </View>
    );
  }

  const matched = view.feedback.filter((row) => row.overall >= RATING_HARD_BELOW).length;
  const abandoned = view.session.status === 'abandoned';
  const doneLabel = view.session.mode === 'onboarding' ? 'Continue' : 'Done';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Summary
      </Text>
      <Text style={styles.copy}>
        {matched} of {view.steps.length} steps matched.
      </Text>
      <Text style={styles.copy}>
        {view.masteredCount === 0
          ? 'These phrases are not mastered.'
          : `${view.masteredCount} ${view.masteredCount === 1 ? 'phrase is' : 'phrases are'} mastered.`}
      </Text>
      {abandoned ? <Text style={styles.copy}>This session was abandoned. The answers you gave stay saved.</Text> : null}
      <Text style={[styles.note, { color: secondary }]}>{unlockCopy(view)}</Text>
      {blocked ? (
        <Text style={styles.copy}>
          {blocked.state === 'unlocked' ? `${blocked.name} is unlocked.` : `${blocked.name} is still locked.`}
        </Text>
      ) : null}
      <PrimaryButton label={blocked && view.session.mode !== 'onboarding' ? 'Back to blocked apps' : doneLabel} onPress={finish} />
    </ScrollView>
  );
}

function unlockCopy(view: PracticeView): string {
  if (view.session.status === 'abandoned' || view.unlock.kind === 'not-earned' || view.unlock.kind === 'not-enough') {
    return 'No unlock was earned.';
  }
  if (view.unlock.kind === 'daily-limit') return 'Daily unlock limit reached.';
  return `You earned ${view.unlock.minutes} minutes.`;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  screen: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 18,
    lineHeight: 26,
  },
  note: {
    fontSize: 17,
    lineHeight: 22,
  },
});
