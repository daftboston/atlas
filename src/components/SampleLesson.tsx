import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { FeedbackPanel } from '@/components/practice/FeedbackPanel';
import { Text, useThemeColor, View } from '@/components/Themed';
import { Field, PrimaryButton, SecondaryButton, SectionHeader } from '@/components/ui/ios';
import { sampleWord, V0_SPEECH_LOCALE } from '@/content/sample-lesson';
import { feedbackFor, hintLine, type FeedbackState } from '@/domain/scoring/feedback';
import { createSpeechService } from '@/services/speech/registry';
import type { MockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';
import { saveWord, useLearner } from '@/state/learnerStore';
import { getDevScript, scriptedStep } from '@/state/devSpeechScript';

export function SampleLesson() {
  const { profile, words } = useLearner();
  const secondary = useThemeColor({}, 'secondaryText');
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
    <View style={styles.block}>
      <SectionHeader>Sample lesson</SectionHeader>
      <Text style={styles.word}>{sample.text}</Text>
      <Text style={styles.meaning}>{sample.meaning}</Text>
      <Text style={styles.example}>{sample.example}</Text>
      <Text style={[styles.note, { color: secondary }]}>The microphone is simulated until on-device recognition is verified.</Text>

      <SecondaryButton label="Hear it" disabled={busy} onPress={() => void hear()} />
      {played ? <Text style={[styles.note, { color: secondary }]}>Played.</Text> : null}

      <PrimaryButton label="Repeat" disabled={busy} onPress={() => void repeat()} />
      <Field label="Type the phrase" value={typed} onChangeText={onType} returnKeyType="done" onSubmitEditing={() => void checkTyped()} />
      <SecondaryButton label="Check typing" disabled={typed.trim().length === 0} onPress={() => void checkTyped()} />

      {feedback ? <FeedbackPanel state={feedback} hint={hint} /> : null}
      {feedback ? <SecondaryButton label="Try again" disabled={busy} onPress={() => void repeat()} /> : null}

      <Text style={[styles.note, { color: secondary }]}>
        {saved
          ? 'Saved. This word is ready to review, not mastered.'
          : 'Saving marks this word ready to review. It does not mean you have mastered it.'}
      </Text>
      <PrimaryButton label={saved ? 'Word saved' : 'Save word'} title={saved ? 'Saved' : 'Save word'} disabled={saved} onPress={() => saveWord(sample)} />
    </View>
  );
}

function isMockSpeech(service: SpeechService): service is MockSpeechService {
  return 'enqueue' in service;
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  word: { fontSize: 40, fontWeight: '700' },
  meaning: { fontSize: 22, fontWeight: '600' },
  example: { fontSize: 17, lineHeight: 22 },
  note: { fontSize: 15, lineHeight: 20 },
});
