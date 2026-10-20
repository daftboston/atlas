import { StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import type { WordScore } from '@/domain/scoring/types';

export function WordDiff({ words }: { words: WordScore[] }) {
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  const danger = useThemeColor({}, 'danger');
  const secondary = useThemeColor({}, 'secondaryText');
  if (words.length === 0) return null;
  const colorFor = { correct: success, close: warning, missing: danger, extra: secondary };
  return (
    <View style={styles.row}>
      {words.map((word, index) => {
        const shown = word.expected ?? word.heard ?? '';
        return (
          <Text
            key={`${shown}-${index}`}
            style={[styles.word, { color: colorFor[word.status] }]}
            accessibilityLabel={`${word.status}, ${shown}`}>
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
