import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import type { WordScore } from '@/domain/scoring/types';

export function WordDiff({ words }: { words: WordScore[] }) {
  if (words.length === 0) return null;
  return (
    <View style={styles.row}>
      {words.map((word, index) => {
        const shown = word.expected ?? word.heard ?? '';
        return (
          <Text key={`${shown}-${index}`} style={styles.word} accessibilityLabel={`${word.status}, ${shown}`}>
            {shown} · {word.status}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 4,
  },
  word: {
    fontSize: 16,
    lineHeight: 22,
  },
});
