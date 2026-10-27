import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { FeedbackPanel, Notice } from '@/components/practice/FeedbackPanel';
import { useSpeechCapabilities } from '@/components/practice/useSpeechCapabilities';
import { Text, useThemeColor, View } from '@/components/Themed';
import { useAnnounce } from '@/components/useAnnounce';
import { GlassCluster } from '@/components/ui/Glass';
import { Field, PrimaryButton, SecondaryButton, SectionHeader } from '@/components/ui/ios';
import { sampleWord, V0_SPEECH_LOCALE } from '@/content/sample-lesson';
import { feedbackFor, hintLine, type FeedbackState } from '@/domain/scoring/feedback';
import { interruptible, SpeechInterruptedError } from '@/services/speech/interruptible';
import { createSpeechService } from '@/services/speech/registry';
import type { MockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';
import { saveWord, useLearner } from '@/state/learnerStore';
import { getDevScript, scriptedStep } from '@/state/devSpeechScript';

export function SampleLesson() {
  const { profile, words } = useLearner();
  const secondary = useThemeColor({}, 'secondaryText');
  const accent = useThemeColor({}, 'accent');
  const [speech] = useState<SpeechService>(() => createSpeechService());
  const capabilities = useSpeechCapabilities(speech);
  const canSpeak = capabilities?.stt === true;
  const canHear = capabilities?.tts === true;
  const typedRef = useRef('');
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [played, setPlayed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<'speaking' | 'listening' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Stops a speak or listen call that is running (timeout, leaving the tab).
  const interrupt = useRef<(() => void) | null>(null);
  const activityText = activity === 'listening' ? 'Listening. Say the phrase now.' : activity === 'speaking' ? 'Playing the phrase.' : null;
  useAnnounce(activityText);

  useEffect(() => () => interrupt.current?.(), []);

  if (!profile) return null;

  const sample = sampleWord(profile.targetLanguage, profile.nativeLanguage);
  const saved = words.some((word) => word.language === profile.targetLanguage && word.text === sample.text);

  async function hear() {
    setBusy(true);
    setPlayed(false);
    setNotice(null);
    setActivity('speaking');
    try {
      const run = interruptible(speech.speak(sample.text, { locale: V0_SPEECH_LOCALE }), () => {
        void Promise.resolve()
          .then(() => speech.stopSpeaking())
          .catch(() => {});
      });
      interrupt.current = run.interrupt;
      await run.promise;
      setPlayed(true);
    } catch (error) {
      if (error instanceof SpeechInterruptedError && error.reason === 'timeout') {
        setNotice("The audio didn't play. Tap Hear it to try again, or type the phrase.");
      }
    } finally {
      interrupt.current = null;
      setActivity(null);
      setBusy(false);
    }
  }

  async function repeat() {
    setBusy(true);
    setNotice(null);
    setActivity('listening');
    try {
      if (isMockSpeech(speech)) speech.enqueue(scriptedStep(getDevScript(), sample.text));
      const listening = speech.listen({ locale: V0_SPEECH_LOCALE });
      const run = interruptible(listening.result, () => listening.cancel());
      interrupt.current = run.interrupt;
      const outcome = await run.promise;
      interrupt.current = null;
      setActivity(null);
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
    } catch (error) {
      // Leaving the tab or a newer listen cancelled this one. Only a timeout needs a message.
      if (error instanceof SpeechInterruptedError && error.reason === 'timeout') {
        setNotice("I couldn't hear a response. Tap Repeat to try again, or type the phrase.");
      }
    } finally {
      interrupt.current = null;
      setActivity(null);
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
      <Text style={[styles.word, { color: accent }]}>{sample.text}</Text>
      <Text style={styles.meaning}>{sample.meaning}</Text>
      <Text style={styles.example}>{sample.example}</Text>
      <Text style={[styles.note, { color: secondary }]}>
        {capabilities && !canSpeak
          ? "Speaking isn't available in this build. Type the phrase instead."
          : capabilities && !capabilities.onDevice && __DEV__
            ? 'The microphone is simulated until on-device recognition is verified.'
            : ''}
      </Text>

      <GlassCluster style={styles.controls} spacing={16}>
        {canHear ? <SecondaryButton label="Hear it" disabled={busy} onPress={() => void hear()} /> : null}
        {played ? <Text style={[styles.note, { color: secondary }]}>Played.</Text> : null}
        {activityText ? (
          <Text style={[styles.note, { color: accent }]} accessibilityLiveRegion="polite">
            {activityText}
          </Text>
        ) : null}

        {canSpeak ? <PrimaryButton label="Repeat" disabled={busy} onPress={() => void repeat()} /> : null}
        <Field label="Type the phrase" value={typed} onChangeText={onType} returnKeyType="done" onSubmitEditing={() => void checkTyped()} />
        <SecondaryButton label="Check typing" disabled={typed.trim().length === 0} onPress={() => void checkTyped()} />

        {notice ? <Notice text={notice} /> : null}
        {feedback ? <FeedbackPanel state={feedback} hint={hint} /> : null}
        {feedback && canSpeak ? <SecondaryButton label="Try again" disabled={busy} onPress={() => void repeat()} /> : null}

        <Text style={[styles.note, { color: secondary }]}>
          {saved
            ? 'Saved. This word is ready to review, not mastered.'
            : 'Saving marks this word ready to review. It does not mean you have mastered it.'}
        </Text>
        <PrimaryButton label={saved ? 'Word saved' : 'Save word'} title={saved ? 'Saved' : 'Save word'} disabled={saved} onPress={() => saveWord(sample)} />
      </GlassCluster>
    </View>
  );
}

function isMockSpeech(service: SpeechService): service is MockSpeechService {
  return 'enqueue' in service;
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  controls: { gap: 8 },
  word: { fontSize: 34, fontWeight: '700' },
  meaning: { fontSize: 20, fontWeight: '600' },
  example: { fontSize: 17, lineHeight: 22 },
  note: { fontSize: 15, lineHeight: 20 },
});
