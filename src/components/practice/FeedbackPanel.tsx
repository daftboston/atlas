import { StyleSheet } from 'react-native';

import { Text, useThemeColor } from '@/components/Themed';
import { WordDiff } from '@/components/practice/WordDiff';
import { GlassSurface } from '@/components/ui/Glass';
import type { FeedbackState } from '@/domain/scoring/feedback';

const MESSAGES: Record<Exclude<FeedbackState['kind'], 'pass' | 'try-again'>, string> = {
  silence: "I didn't hear anything.",
  denied: 'Microphone permission is off. You can type the phrase.',
  interrupted: 'That was interrupted.',
  unavailable: "Speech isn't available here. Type the phrase.",
};

export function FeedbackPanel({ state, hint }: { state: FeedbackState; hint: string | null }) {
  const card = useThemeColor({}, 'card');
  const glass = useThemeColor({}, 'glass');
  const success = useThemeColor({}, 'success');
  const warning = useThemeColor({}, 'warning');
  return (
    <GlassSurface tintColor={glass} fallbackColor={card} style={styles.panel}>
      {state.kind === 'pass' || state.kind === 'try-again' ? (
        <>
          <Text style={[styles.title, { color: state.kind === 'pass' ? success : warning }]}>
            {state.kind === 'pass' ? 'That matches.' : 'Not quite. Try again.'}
          </Text>
          <WordDiff words={state.score.words} />
          {hint ? <Text style={styles.hint}>Hint: {hint}</Text> : null}
        </>
      ) : (
        <Text style={[styles.title, { color: warning }]}>{MESSAGES[state.kind]}</Text>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 6,
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
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
