import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { FeedbackPanel } from '@/components/practice/FeedbackPanel';
import { Text, View } from '@/components/Themed';
import { sampleWord, V0_SPEECH_LOCALE } from '@/content/sample-lesson';
import { feedbackFor, hintLine, type FeedbackState } from '@/domain/scoring/feedback';
import { createSpeechService } from '@/services/speech/registry';
import type { MockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';
import { saveWord, useLearner } from '@/state/learnerStore';
import { getDevScript, scriptedStep } from '@/state/devSpeechScript';

export function SampleLesson() {
  const { profile, words } = useLearner();
  const [speech] = useState<SpeechService>(() => createSpeechService());
  const typedRef = useRef('');
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [played, setPlayed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const sample = sampleWord(profile.targetLanguage, profile.nativeLanguage);
  const saved = words.some((word) => word.language === profile.targetLanguage && word.text === sample.text);

  async function hear() {
    setBusy(true);
    setPlayed(false);
    try {
      await speech.speak(sample.text, { locale: V0_SPEECH_LOCALE });
      setPlayed(true);
    } finally {
      setBusy(false);
    }
  }

  async function repeat() {
    setBusy(true);
    try {
      if (isMockSpeech(speech)) speech.enqueue(scriptedStep(getDevScript(), sample.text));
      const outcome = await speech.listen({ locale: V0_SPEECH_LOCALE }).result;
      const score = outcome.transcript
        ? await speech.score({
            target: sample.text,
            variants: [],
            transcript: outcome.transcript,
            inputMode: 'speech',
            locale: V0_SPEECH_LOCALE,
            reading: null,
            romanization: null,
            audioUri: null,
          })
        : null;
      setFeedback(feedbackFor(outcome, score));
    } catch {
      // A newer listen cancelled this one.
    } finally {
      setBusy(false);
    }
  }

  function onType(value: string) {
    typedRef.current = value;
    setTyped(value);
  }

  async function checkTyped() {
    const transcript = typedRef.current.trim();
    if (!transcript) return;
    const score = await speech.score({
      target: sample.text,
      variants: [],
      transcript,
      inputMode: 'typed',
      locale: V0_SPEECH_LOCALE,
      reading: null,
      romanization: null,
      audioUri: null,
    });
    setFeedback(feedbackFor({ transcript, endedBy: 'user' }, score));
  }

  const hint = feedback && (feedback.kind === 'pass' || feedback.kind === 'try-again') ? hintLine(feedback.score, null) : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
      <Text style={styles.kicker}>Sample lesson</Text>
      <Text style={styles.word}>{sample.text}</Text>
      <Text style={styles.meaning}>{sample.meaning}</Text>
      <Text style={styles.example}>{sample.example}</Text>
      <Text style={styles.note}>The microphone is simulated until on-device recognition is verified.</Text>

      <Pressable accessibilityRole="button" accessibilityLabel="Hear it" disabled={busy} onPress={() => void hear()} style={styles.secondary}>
        <Text style={styles.secondaryText}>Hear it</Text>
      </Pressable>
      {played ? <Text style={styles.note}>Played.</Text> : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Repeat" disabled={busy} onPress={() => void repeat()} style={styles.primary}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          Repeat
        </Text>
      </Pressable>

      <TextInput
        accessibilityLabel="Type the phrase"
        value={typed}
        onChangeText={onType}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void checkTyped()}
        style={styles.input}
        placeholder="Type the phrase"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check typing"
        disabled={typed.trim().length === 0}
        onPress={() => void checkTyped()}
        style={styles.secondary}>
        <Text style={styles.secondaryText}>Check typing</Text>
      </Pressable>

      {feedback ? <FeedbackPanel state={feedback} hint={hint} /> : null}
      {feedback ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Try again" disabled={busy} onPress={() => void repeat()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Try again</Text>
        </Pressable>
      ) : null}

      <Text style={styles.note}>
        {saved
          ? 'Saved. This word is ready to review, not mastered.'
          : 'Saving marks this word ready to review. It does not mean you have mastered it.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Word saved' : 'Save word'}
        disabled={saved}
        style={[styles.primary, saved && styles.saveDisabled]}
        onPress={() => saveWord(sample)}>
        <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
          {saved ? 'Saved' : 'Save word'}
        </Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

function isMockSpeech(service: SpeechService): service is MockSpeechService {
  return 'enqueue' in service;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
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
  secondary: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
  },
  saveDisabled: {
    opacity: 0.55,
  },
});
