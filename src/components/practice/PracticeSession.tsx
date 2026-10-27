import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet } from 'react-native';

import { Text, useThemeColor, View } from '@/components/Themed';
import { GlassCluster } from '@/components/ui/Glass';
import { Field, PrimaryButton, SecondaryButton, TextButton } from '@/components/ui/ios';
import { MAX_TRIES_PER_STEP } from '@/domain/config';
import { feedbackFor, hintLine, type FeedbackState, type ListenOutcome } from '@/domain/scoring/feedback';
import type { TextMatchResult } from '@/domain/scoring/types';
import { interruptible, SpeechInterruptedError } from '@/services/speech/interruptible';
import { createSpeechService } from '@/services/speech/registry';
import type { MockSpeechService } from '@/services/speech/mock';
import type { ListenResult, SpeechService } from '@/services/speech/types';
import { getDevScript, scriptedStep } from '@/state/devSpeechScript';
import { abandonSession, advanceSession, openPractice, readPractice, refreshSessionHome, saveAttempt } from '@/state/sessionStore';
import { SessionNotActiveError, type PracticeView, type StepView } from '@/data/repositories/sessionRepo';

import { FeedbackPanel } from './FeedbackPanel';
import { useSpeechCapabilities } from './useSpeechCapabilities';

export function PracticeSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const [speech] = useState<SpeechService>(() => createSpeechService());
  const [view, setView] = useState<PracticeView | null>(() => openPractice(sessionId));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [played, setPlayed] = useState(false);
  const capabilities = useSpeechCapabilities(speech);
  const [busy, setBusy] = useState(false);
  // One attempt-writing action at a time. The ref blocks a second tap in the same tick, before `busy` renders.
  const inFlight = useRef(false);
  // Stops the speak or listen call that is running, if any (timeout, unmount, app in background).
  const interruptSpeech = useRef<(() => void) | null>(null);
  const advancedFrom = useRef<number | null>(null);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const allowLeave = useRef(false);
  const secondary = useThemeColor({}, 'secondaryText');
  const accent = useThemeColor({}, 'accent');

  const active = view?.session.status === 'active';

  useEffect(() => {
    refreshSessionHome();
  }, [sessionId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') interruptSpeech.current?.();
    });
    return () => {
      subscription.remove();
      interruptSpeech.current?.();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeave.current || !active) return;
      event.preventDefault();
      setConfirmLeave(true);
    });
    return unsubscribe;
  }, [navigation, active]);

  if (!view) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Practice
        </Text>
        <Text style={styles.copy}>This session isn&apos;t on this device.</Text>
      </View>
    );
  }

  if (view.session.status !== 'active') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          Practice
        </Text>
        <Text style={styles.copy}>
          {view.session.status === 'abandoned' ? 'This session was abandoned.' : 'This session is finished.'}
        </Text>
        <SecondaryButton label="Back to Learn" onPress={() => router.back()} />
      </View>
    );
  }

  const step = view.steps[view.session.cursor];
  if (!step) {
    return (
      <View style={styles.screen}>
        <Text style={styles.copy}>This session has no steps.</Text>
      </View>
    );
  }

  const attempts = view.attempts.filter((attempt) => attempt.itemId === step.itemId && attempt.promptType === step.promptType);
  const used = attempts.filter((attempt) => attempt.status !== 'failed').length;
  const skipped = attempts.some((attempt) => attempt.status === 'skipped');
  const canAnswer = used < MAX_TRIES_PER_STEP && !skipped;
  // learning-loop §5.4: a step advances on a graded attempt or a skip. Failed attempts (denied, interrupted) never count.
  const canAdvance = attempts.some((attempt) => attempt.graded || attempt.status === 'skipped');
  const canSpeak = capabilities?.stt === true;
  const canHear = capabilities?.tts === true;
  const simulated = canSpeak && capabilities?.onDevice !== true;
  const showTarget = step.promptType === 'listen-repeat' || feedback?.kind === 'pass' || feedback?.kind === 'try-again';
  const hint = feedback && (feedback.kind === 'pass' || feedback.kind === 'try-again') ? hintLine(feedback.score, step.notes) : null;
  const locale = view.speechLocale;

  function reload() {
    setView(readPractice(sessionId));
  }

  function persist(stepNow: StepView, outcome: ListenOutcome, score: TextMatchResult | null, inputMode: 'speech' | 'typed') {
    const state = feedbackFor(outcome, score);
    const status = state.kind === 'pass' || state.kind === 'try-again' ? 'scored' : state.kind === 'silence' ? 'captured' : 'failed';
    const endedAt = Date.now();
    saveAttempt({
      sessionId,
      itemId: stepNow.itemId,
      promptType: stepNow.promptType,
      inputMode,
      status,
      transcript: outcome.transcript.trim() ? outcome.transcript : null,
      error: outcome.error ?? null,
      startedAt: endedAt,
      endedAt,
      score: status === 'scored' ? score : null,
      hint: score ? hintLine(score, stepNow.notes) : null,
    });
    setFeedback(state);
    reload();
  }

  /** The session ended under the learner (abandoned, finished, or past 2 hours). Show its saved state. */
  function sessionEnded() {
    setFeedback(null);
    setConfirmLeave(false);
    allowLeave.current = true;
    reload();
    refreshSessionHome();
  }

  async function guarded(run: () => Promise<void> | void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await run();
    } catch (error) {
      if (error instanceof SessionNotActiveError) sessionEnded();
      else if (!(error instanceof SpeechInterruptedError)) throw error;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function hear() {
    return guarded(async () => {
      setPlayed(false);
      const run = interruptible(speech.speak(step.targetText, { locale }), () => {
        void Promise.resolve()
          .then(() => speech.stopSpeaking())
          .catch(() => {});
      });
      interruptSpeech.current = run.interrupt;
      try {
        await run.promise;
        setPlayed(true);
      } finally {
        interruptSpeech.current = null;
      }
    });
  }

  function repeat() {
    if (!canSpeak) return Promise.resolve();
    return guarded(async () => {
      let outcome: ListenResult;
      let score: TextMatchResult | null;
      try {
        if (isMockSpeech(speech)) speech.enqueue(scriptedStep(getDevScript(), step.targetText));
        const listening = speech.listen({ locale });
        const run = interruptible(listening.result, () => listening.cancel());
        interruptSpeech.current = run.interrupt;
        try {
          outcome = await run.promise;
        } finally {
          interruptSpeech.current = null;
        }
        score = outcome.transcript
          ? await speech.score({
              target: step.targetText,
              variants: step.variants,
              transcript: outcome.transcript,
              inputMode: 'speech',
              locale,
              reading: step.reading,
              romanization: step.romanization,
              audioUri: null,
            })
          : null;
      } catch (error) {
        // Timeout and interrupts go to `guarded`. Anything else is a newer listen cancelling this one.
        if (error instanceof SpeechInterruptedError) throw error;
        return;
      }
      persist(step, outcome, score, 'speech');
    });
  }

  function checkTyped() {
    return guarded(async () => {
      const transcript = typedRef.current.trim();
      if (!transcript) return;
      const score = await speech.score({
        target: step.targetText,
        variants: step.variants,
        transcript,
        inputMode: 'typed',
        locale,
        reading: step.reading,
        romanization: step.romanization,
        audioUri: null,
      });
      persist(step, { transcript, endedBy: 'user' }, score, 'typed');
    });
  }

  function skip() {
    return guarded(() => skipNow());
  }

  function skipNow() {
    const endedAt = Date.now();
    saveAttempt({
      sessionId,
      itemId: step.itemId,
      promptType: step.promptType,
      inputMode: 'typed',
      status: 'skipped',
      transcript: null,
      error: null,
      startedAt: endedAt,
      endedAt,
      score: null,
      hint: null,
    });
    setFeedback(null);
    reload();
  }

  function next() {
    if (!canAdvance || inFlight.current) return;
    // A second tap on the same step must not advance again.
    const cursor = view?.session.cursor ?? -1;
    if (advancedFrom.current === cursor) return;
    advancedFrom.current = cursor;
    let status: ReturnType<typeof advanceSession>;
    try {
      status = advanceSession(sessionId);
    } catch (error) {
      if (!(error instanceof SessionNotActiveError)) throw error;
      sessionEnded();
      return;
    }
    if (status === 'completed') {
      allowLeave.current = true;
      router.replace({ pathname: '/practice/summary/[sessionId]', params: { sessionId } });
      return;
    }
    setFeedback(null);
    setPlayed(false);
    typedRef.current = '';
    setTyped('');
    reload();
  }

  function leave() {
    abandonSession(sessionId);
    allowLeave.current = true;
    setConfirmLeave(false);
    setView(readPractice(sessionId));
    if (router.canGoBack()) router.back();
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={[styles.kicker, { color: accent }]}>
          Step {view.session.cursor + 1} of {view.steps.length}
        </Text>
        <Text style={styles.meaning}>{step.meaning}</Text>
        {showTarget ? <Text style={[styles.word, { color: accent }]}>{step.targetText}</Text> : null}
        <Text style={[styles.note, { color: secondary }]}>{capabilities ? promptNote(step.promptType, canSpeak, simulated) : ''}</Text>

        <GlassCluster style={styles.controls} spacing={16}>
          {step.promptType === 'listen-repeat' && canHear ? (
            <SecondaryButton label="Hear it" disabled={busy} onPress={() => void hear()} />
          ) : null}
          {played ? <Text style={[styles.note, { color: secondary }]}>Played.</Text> : null}

          {canAnswer ? (
            <>
              {canSpeak ? <PrimaryButton label="Repeat" disabled={busy} onPress={() => void repeat()} /> : null}
              <Field
                label="Type the phrase"
                value={typed}
                onChangeText={(value) => {
                  typedRef.current = value;
                  setTyped(value);
                }}
                returnKeyType="done"
                onSubmitEditing={() => void checkTyped()}
              />
              <SecondaryButton label="Check typing" disabled={busy || typed.trim().length === 0} onPress={() => void checkTyped()} />
              <SecondaryButton label="I don't know" disabled={busy} onPress={() => void skip()} />
            </>
          ) : null}

          {feedback ? <FeedbackPanel state={feedback} hint={hint} /> : null}
          {skipped ? <Text style={styles.copy}>Skipped.</Text> : null}
          {canAdvance ? <PrimaryButton label="Next" disabled={busy} onPress={next} /> : null}
        </GlassCluster>

        {confirmLeave ? (
          <View style={styles.confirm}>
            <Text style={styles.copy}>Leave this session? It will be marked abandoned. Answers you already gave stay saved.</Text>
            <SecondaryButton label="Stay" onPress={() => setConfirmLeave(false)} />
            <TextButton label="Leave" destructive onPress={leave} />
          </View>
        ) : (
          <TextButton label="Leave session" onPress={() => setConfirmLeave(true)} />
        )}
      </ScrollView>
    </View>
  );
}

function promptNote(promptType: StepView['promptType'], canSpeak: boolean, simulated: boolean): string {
  if (!canSpeak) {
    return promptType === 'listen-repeat'
      ? "Type the phrase. Speaking isn't available in this build."
      : "Type the phrase from the meaning. Speaking isn't available in this build.";
  }
  const suffix = simulated ? ' The microphone is simulated.' : '';
  return promptType === 'listen-repeat' ? `Listen, then say it.${suffix}` : `Say the phrase from the meaning.${suffix}`;
}

function isMockSpeech(service: SpeechService): service is MockSpeechService {
  return 'enqueue' in service;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 24,
    gap: 12,
  },
  controls: { gap: 12 },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  word: {
    fontSize: 40,
    fontWeight: '700',
  },
  meaning: {
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
  },
  note: {
    fontSize: 15,
    lineHeight: 20,
  },
  confirm: {
    gap: 8,
  },
});
