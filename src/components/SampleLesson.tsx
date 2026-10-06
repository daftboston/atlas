import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { sampleWord } from '@/content/sample-lesson';
import { saveWord, useLearner } from '@/state/learnerStore';

export function SampleLesson() {
  const { profile, words } = useLearner();
  if (!profile) return null;

  const sample = sampleWord(profile.targetLanguage, profile.nativeLanguage);
  const saved = words.some((word) => word.language === profile.targetLanguage && word.text === sample.text);

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Sample lesson</Text>
      <Text style={styles.word}>{sample.text}</Text>
      <Text style={styles.meaning}>{sample.meaning}</Text>
      <Text style={styles.example}>{sample.example}</Text>
      <Text style={styles.note}>
        {saved
          ? 'Saved. This word is ready to review, not mastered. Listening and speaking come next.'
          : 'Saving marks this word ready to review. It does not mean you have mastered it.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Word saved' : 'Save word'}
        disabled={saved}
        style={[styles.save, saved && styles.saveDisabled]}
        onPress={() => saveWord(sample)}>
        <Text style={styles.saveText} lightColor="#fff" darkColor="#000">
          {saved ? 'Saved' : 'Save word'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  word: {
    fontSize: 40,
    fontWeight: '700',
  },
  meaning: {
    fontSize: 22,
  },
  example: {
    fontSize: 18,
    lineHeight: 26,
  },
  note: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.75,
  },
  save: {
    marginTop: 8,
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  saveDisabled: {
    opacity: 0.55,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
