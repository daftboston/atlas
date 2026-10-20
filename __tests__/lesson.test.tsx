import { fireEvent, render, screen } from '@testing-library/react-native';

import LearnScreen from '../app/(tabs)/learn';
import ReviewScreen from '../app/(tabs)/review';
import { sampleWord } from '@/content/sample-lesson';
import { getLearnerSnapshot, hydrateLearner } from '@/state/learnerStore';
import { resetDevScript, setDevScript } from '@/state/devSpeechScript';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

describe('Sample lesson', () => {
  let repo: ReturnType<typeof createMemoryLearnerRepository>;

  beforeEach(async () => {
    resetDevScript();
    repo = createMemoryLearnerRepository();
    await hydrateLearner(repo);
  });

  it('offers only the English to Spanish course', async () => {
    await render(<LearnScreen />);

    expect(screen.getByText("You speak English, you're learning Spanish")).toBeOnTheScreen();
    expect(screen.queryByText(/Portuguese/)).toBeNull();
    expect(screen.queryByText(/I want to learn/)).toBeNull();
    expect(screen.queryByText(/I speak/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Portuguese/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Target language/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Native language/ })).toBeNull();
  });

  it('saves seed item es-v0-001 ("Hola") as ready to review after continuing with English to Spanish', async () => {
    await render(<LearnScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getLearnerSnapshot().profile).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(repo.activeCourseId()).toBe('en-es-v0');
    expect(screen.getByText('Hola')).toBeOnTheScreen();
    expect(screen.getByText('Hello')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save word' }));

    const saved = getLearnerSnapshot().words[0];
    expect(saved).toMatchObject({
      text: 'Hola',
      meaning: 'Hello',
      example: 'Hola, ¿cómo estás?',
      language: 'es',
      lessonId: 'sample-es',
      status: 'ready-to-review',
      score: null,
      difficulty: 'intro',
    });
    expect(typeof saved.id).toBe('string');
    expect(new Date(saved.savedAt).toISOString()).toBe(saved.savedAt);
    expect(await repo.listSavedWords()).toEqual([saved]);
    expect(repo.savedSeedIds()).toEqual(['es-v0-001']);
    expect(screen.getByRole('button', { name: 'Word saved' })).toBeDisabled();

    await render(<ReviewScreen />);
    expect(screen.getByText('Hola')).toBeOnTheScreen();
    expect(screen.getByText('Hello · Ready to review')).toBeOnTheScreen();
  });

  it('hears, repeats a simulated match, and checks a typed answer', async () => {
    await render(<LearnScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Hear it' }));
    expect(await screen.findByText('Played.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Repeat' }));
    expect(await screen.findByText('That matches.')).toBeOnTheScreen();
    expect(screen.getByLabelText('correct, hola')).toBeOnTheScreen();
    expect(screen.queryByText(/Hint:/)).toBeNull();

    setDevScript('silence');
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText("I didn't hear anything.")).toBeOnTheScreen();
    expect(screen.queryByText('That matches.')).toBeNull();
    expect(screen.queryByText(/Not quite/)).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Type the phrase'), 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
    expect(await screen.findByText('That matches.')).toBeOnTheScreen();
  });

  it('shows a close hint for the simulated close answer', async () => {
    setDevScript('close');
    await render(<LearnScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat' }));
    expect(await screen.findByText('Not quite. Try again.')).toBeOnTheScreen();
    expect(screen.getByText(/Close: hola/)).toBeOnTheScreen();
  });

  it('shows words saved in an earlier run once the store loads them', async () => {
    await repo.startCourse('en-es-v0');
    await repo.saveWord(sampleWord('es', 'en'), Date.UTC(2026, 9, 6));
    await hydrateLearner(repo);

    await render(<ReviewScreen />);
    expect(screen.getByText('Hola')).toBeOnTheScreen();
    expect(screen.getByText('Hello · Ready to review')).toBeOnTheScreen();
  });
});
