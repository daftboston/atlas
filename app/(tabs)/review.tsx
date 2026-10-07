import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useLearner } from '@/state/learnerStore';

// Saved words live on Review (architecture §3 has no Progress tab). The due
// queue, upcoming load and mastered count arrive with FSRS scheduling.
export default function ReviewScreen() {
  const { profile, words } = useLearner();
  const saved = profile ? words.filter((word) => word.language === profile.targetLanguage) : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review</Text>
      {!profile ? (
        <Text style={styles.copy}>Start your course on the Learn tab first.</Text>
      ) : saved.length === 0 ? (
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
      <Text style={styles.note}>
        The review queue is not built yet: no due reviews, upcoming load, or mastered count.
      </Text>
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
  note: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
  },
});
