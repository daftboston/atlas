import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { WordDiff } from '@/components/practice/WordDiff';
import type { FeedbackState } from '@/domain/scoring/feedback';

const MESSAGES: Record<Exclude<FeedbackState['kind'], 'pass' | 'try-again'>, string> = {
  silence: "I didn't hear anything.",
  denied: 'Microphone permission is off. You can type the phrase.',
  interrupted: 'That was interrupted.',
  unavailable: "Speech isn't available here. Type the phrase.",
};

export function FeedbackPanel({ state, hint }: { state: FeedbackState; hint: string | null }) {
  if (state.kind === 'pass' || state.kind === 'try-again') {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>{state.kind === 'pass' ? 'That matches.' : 'Not quite. Try again.'}</Text>
        <WordDiff words={state.score.words} />
        {hint ? <Text style={styles.hint}>Hint: {hint}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{MESSAGES[state.kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
  },
});
