import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { feedbackFor, hintLine, type FeedbackState, type ListenOutcome } from '@/domain/scoring/feedback';
import type { TextMatchResult } from '@/domain/scoring/types';
import { createSpeechService } from '@/services/speech/registry';
import type { MockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';
import { getDevScript, scriptedStep } from '@/state/devSpeechScript';
import { abandonSession, advanceSession, openPractice, readPractice, refreshSessionHome, saveAttempt } from '@/state/sessionStore';
import type { PracticeView, StepView } from '@/data/repositories/sessionRepo';

import { FeedbackPanel } from './FeedbackPanel';

const MAX_TRIES = 3;

export function PracticeSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const [speech] = useState<SpeechService>(() => createSpeechService());
  const [view, setView] = useState<PracticeView | null>(() => openPractice(sessionId));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [played, setPlayed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const allowLeave = useRef(false);

  const active = view?.session.status === 'active';

  useEffect(() => {
    refreshSessionHome();
  }, [sessionId]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Learn"
          onPress={() => router.back()}
          style={styles.secondary}>
          <Text style={styles.secondaryText}>Back to Learn</Text>
        </Pressable>
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
  const canAnswer = used < MAX_TRIES && !skipped;
  const canAdvance = attempts.length > 0;
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

  async function hear() {
    setBusy(true);
    setPlayed(false);
    try {
      await speech.speak(step.targetText, { locale });
      setPlayed(true);
    } finally {
      setBusy(false);
    }
  }

  async function repeat() {
    setBusy(true);
    try {
      if (isMockSpeech(speech)) speech.enqueue(scriptedStep(getDevScript(), step.targetText));
      const outcome = await speech.listen({ locale }).result;
      const score = outcome.transcript
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
      persist(step, outcome, score, 'speech');
    } catch {
      // A newer listen cancelled this one.
    } finally {
      setBusy(false);
    }
  }

  async function checkTyped() {
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
  }

  function skip() {
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
    const status = advanceSession(sessionId);
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
        <Text style={styles.kicker}>
          Step {view.session.cursor + 1} of {view.steps.length}
        </Text>
        <Text style={styles.meaning}>{step.meaning}</Text>
        {showTarget ? <Text style={styles.word}>{step.targetText}</Text> : null}
        <Text style={styles.note}>
          {step.promptType === 'listen-repeat'
            ? 'Listen, then say it. The microphone is simulated.'
            : 'Say the phrase from the meaning. The microphone is simulated.'}
        </Text>

        {step.promptType === 'listen-repeat' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Hear it" disabled={busy} onPress={() => void hear()} style={styles.secondary}>
            <Text style={styles.secondaryText}>Hear it</Text>
          </Pressable>
        ) : null}
        {played ? <Text style={styles.note}>Played.</Text> : null}

        {canAnswer ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Repeat" disabled={busy} onPress={() => void repeat()} style={styles.primary}>
              <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
                Repeat
              </Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Type the phrase"
              value={typed}
              onChangeText={(value) => {
                typedRef.current = value;
                setTyped(value);
              }}
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
            <Pressable accessibilityRole="button" accessibilityLabel="I don't know" disabled={busy} onPress={skip} style={styles.secondary}>
              <Text style={styles.secondaryText}>I don&apos;t know</Text>
            </Pressable>
          </>
        ) : null}

        {feedback ? <FeedbackPanel state={feedback} hint={hint} /> : null}
        {skipped ? <Text style={styles.copy}>Skipped.</Text> : null}
        {canAdvance ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={next} style={styles.primary}>
            <Text style={styles.primaryText} lightColor="#fff" darkColor="#000">
              Next
            </Text>
          </Pressable>
        ) : null}

        {confirmLeave ? (
          <View style={styles.confirm}>
            <Text style={styles.copy}>Leave this session? It will be marked abandoned. Answers you already gave stay saved.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Stay" onPress={() => setConfirmLeave(false)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Stay</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={leave} style={styles.secondary}>
              <Text style={styles.secondaryText}>Leave</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Leave session" onPress={() => setConfirmLeave(true)} style={styles.secondary}>
            <Text style={styles.secondaryText}>Leave session</Text>
          </Pressable>
        )}
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
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    fontSize: 28,
    fontWeight: '700',
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
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
  confirm: {
    gap: 8,
  },
});
