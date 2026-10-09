import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { PracticeView } from '@/data/repositories/sessionRepo';
import { RATING_HARD_BELOW } from '@/domain/config';
import { openPractice, refreshSessionHome } from '@/state/sessionStore';

export function SessionSummary({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [view] = useState<PracticeView | null>(() => openPractice(sessionId));

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
      </View>
    );
  }

  const matched = view.feedback.filter((row) => row.overall >= RATING_HARD_BELOW).length;
  const abandoned = view.session.status === 'abandoned';

  return (
    <View style={styles.screen}>
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
      <Text style={styles.note}>{unlockCopy(view)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={view.session.mode === 'onboarding' ? 'Continue' : 'Done'}
        onPress={() => router.replace(view.session.mode === 'onboarding' ? '/(onboarding)/habit' : '/(tabs)/learn')}
        style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          {view.session.mode === 'onboarding' ? 'Continue' : 'Done'}
        </Text>
      </Pressable>
    </View>
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
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  primary: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
