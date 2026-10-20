import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import { Group, PrimaryButton, ScreenTitle, SectionHeader, TextButton } from '@/components/ui/ios';
import type { ReviewEntry } from '@/data/repositories/reviewRepo';
import { useLearner } from '@/state/learnerStore';
import { refreshReview, suspendPhrase, unsuspendPhrase, useReviewHome } from '@/state/reviewStore';
import { startReviewSession, useSessionHome } from '@/state/sessionStore';

const DAY_MS = 24 * 60 * 60 * 1000;

function upcomingLabel(due: number, now: number): string {
  if (due - now < DAY_MS) return 'Within a day';
  const days = Math.round((due - now) / DAY_MS);
  return days === 1 ? 'In 1 day' : `In ${days} days`;
}

function Entry({ entry, detail, action }: { entry: ReviewEntry; detail: string; action: 'suspend' | 'unsuspend' }) {
  const secondary = useThemeColor({}, 'secondaryText');
  return (
    <View style={styles.entryRow}>
      <View style={styles.entryText}>
        <Text style={styles.word}>{entry.targetText}</Text>
        <Text style={[styles.meta, { color: secondary }]}>
          {entry.meaning} · {detail}
        </Text>
      </View>
      <TextButton
        label={action === 'suspend' ? `Suspend ${entry.targetText}` : `Resume ${entry.targetText}`}
        title={action === 'suspend' ? 'Pause' : 'Resume'}
        onPress={() => (action === 'suspend' ? suspendPhrase(entry.itemId) : unsuspendPhrase(entry.itemId))}
      />
    </View>
  );
}

export default function ReviewScreen() {
  const { profile, words } = useLearner();
  const review = useReviewHome();
  const session = useSessionHome();
  const router = useRouter();
  const now = review.now;
  const secondary = useThemeColor({}, 'secondaryText');

  useEffect(() => {
    refreshReview();
  }, []);

  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ScreenTitle>Review</ScreenTitle>
        <Text style={[styles.copy, { color: secondary }]}>Start your course on the Learn tab first.</Text>
      </ScrollView>
    );
  }

  if (!review.ready) {
    const saved = words.filter((word) => word.language === profile.targetLanguage);
    return (
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ScreenTitle>Review</ScreenTitle>
        {saved.length === 0 ? (
          <Text style={[styles.copy, { color: secondary }]}>No words yet. Finish the sample lesson to save one.</Text>
        ) : (
          <Group>
            {saved.map((word) => (
              <View key={word.id} style={styles.entry}>
                <Text style={styles.word}>{word.text}</Text>
                <Text style={[styles.meta, { color: secondary }]}>
                  {word.meaning} · {word.status === 'ready-to-review' ? 'Ready to review' : word.status}
                </Text>
              </View>
            ))}
          </Group>
        )}
      </ScrollView>
    );
  }

  const { due, upcoming, saved, masteredCount } = review.home;
  const suspended = review.home.suspended ?? [];
  const empty = due.length === 0 && upcoming.length === 0 && saved.length === 0 && suspended.length === 0;

  function reviewOnly() {
    const result = startReviewSession();
    if (result.kind === 'caught-up') return;
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId: result.id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <ScreenTitle>Review</ScreenTitle>
      <Text style={styles.mastered}>Mastered {masteredCount}</Text>
      {due.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader>Due now</SectionHeader>
          <Group>
            {due.map((entry) => (
              <Entry key={entry.itemId} entry={entry} detail="Due" action="suspend" />
            ))}
          </Group>
          {session.ready && session.home.activeSessionId === null ? (
            <View style={styles.action}>
              <PrimaryButton label="Review only" onPress={reviewOnly} />
            </View>
          ) : null}
        </View>
      ) : null}
      {upcoming.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader>Next 7 days</SectionHeader>
          <Group>
            {upcoming.map((entry) => (
              <Entry key={entry.itemId} entry={entry} detail={entry.due === null ? 'Scheduled' : upcomingLabel(entry.due, now)} action="suspend" />
            ))}
          </Group>
        </View>
      ) : null}
      {saved.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader>Saved</SectionHeader>
          <Group>
            {saved.map((entry) => (
              <Entry key={entry.itemId} entry={entry} detail="Ready to review" action="suspend" />
            ))}
          </Group>
        </View>
      ) : null}
      {suspended.length > 0 ? (
        <View style={styles.block}>
          <SectionHeader>Paused</SectionHeader>
          <Group>
            {suspended.map((entry) => (
              <Entry key={entry.itemId} entry={entry} detail="Paused" action="unsuspend" />
            ))}
          </Group>
        </View>
      ) : null}
      {empty ? <Text style={[styles.copy, { color: secondary }]}>No words yet. Finish the sample lesson to save one.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 22, paddingBottom: 40 },
  block: { gap: 0 },
  action: { marginTop: 12 },
  mastered: { fontSize: 22, fontWeight: '700' },
  copy: { fontSize: 17, lineHeight: 22 },
  entry: { paddingHorizontal: 16, paddingVertical: 12 },
  entryRow: { minHeight: 58, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryText: { flex: 1, paddingVertical: 10 },
  word: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 15, lineHeight: 20, marginTop: 2 },
});