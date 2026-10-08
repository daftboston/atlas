import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { ReviewEntry } from '@/data/repositories/reviewRepo';
import { useLearner } from '@/state/learnerStore';
import { refreshReview, useReviewHome } from '@/state/reviewStore';
import { startReviewSession, useSessionHome } from '@/state/sessionStore';

const DAY_MS = 24 * 60 * 60 * 1000;

function upcomingLabel(due: number, now: number): string {
  if (due - now < DAY_MS) return 'Within a day';
  const days = Math.round((due - now) / DAY_MS);
  return days === 1 ? 'In 1 day' : `In ${days} days`;
}

function Entry({ entry, detail }: { entry: ReviewEntry; detail: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.word}>{entry.targetText}</Text>
      <Text style={styles.meta}>
        {entry.meaning} · {detail}
      </Text>
    </View>
  );
}

export default function ReviewScreen() {
  const { profile, words } = useLearner();
  const review = useReviewHome();
  const session = useSessionHome();
  const router = useRouter();
  const now = review.now;

  useEffect(() => {
    refreshReview();
  }, []);

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Review</Text>
        <Text style={styles.copy}>Start your course on the Learn tab first.</Text>
      </View>
    );
  }

  if (!review.ready) {
    const saved = words.filter((word) => word.language === profile.targetLanguage);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Review</Text>
        {saved.length === 0 ? (
          <Text style={styles.copy}>No words yet. Finish the sample lesson to save one.</Text>
        ) : (
          saved.map((word) => (
            <View key={word.id} style={styles.row}>
              <Text style={styles.word}>{word.text}</Text>
              <Text style={styles.meta}>
                {word.meaning} · {word.status === 'ready-to-review' ? 'Ready to review' : word.status}
              </Text>
            </View>
          ))
        )}
      </View>
    );
  }

  const { due, upcoming, saved, masteredCount } = review.home;
  const empty = due.length === 0 && upcoming.length === 0 && saved.length === 0;

  function reviewOnly() {
    const result = startReviewSession();
    if (result.kind === 'caught-up') return;
    router.push({ pathname: '/practice/[sessionId]', params: { sessionId: result.id } });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review</Text>
      <Text style={styles.copy}>Mastered {masteredCount}</Text>
      {due.length > 0 ? (
        <>
          <Text style={styles.section}>Due now</Text>
          {due.map((entry) => (
            <Entry key={entry.itemId} entry={entry} detail="Due" />
          ))}
          {session.ready && session.home.activeSessionId === null ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Review only" onPress={reviewOnly} style={styles.primary}>
              <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
                Review only
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {upcoming.length > 0 ? (
        <>
          <Text style={styles.section}>Next 7 days</Text>
          {upcoming.map((entry) => (
            <Entry key={entry.itemId} entry={entry} detail={entry.due === null ? 'Scheduled' : upcomingLabel(entry.due, now)} />
          ))}
        </>
      ) : null}
      {saved.length > 0 ? (
        <>
          <Text style={styles.section}>Saved</Text>
          {saved.map((entry) => (
            <Entry key={entry.itemId} entry={entry} detail="Ready to review" />
          ))}
        </>
      ) : null}
      {empty ? <Text style={styles.copy}>No words yet. Finish the sample lesson to save one.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
  },
  word: {
    fontSize: 22,
    fontWeight: '600',
  },
  meta: {
    fontSize: 15,
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
