import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useLearner } from '@/lib/learner-store';

export default function ProgressScreen() {
  const { profile, words } = useLearner();
  const saved = profile ? words.filter((word) => word.language === profile.targetLanguage) : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>
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
});
