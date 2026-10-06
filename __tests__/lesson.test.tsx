import { fireEvent, render, screen } from '@testing-library/react-native';

import LearnScreen from '@/app/(tabs)/index';
import ProgressScreen from '@/app/(tabs)/progress';
import { resetLearnerForTests, getLearnerSnapshot } from '@/lib/learner-store';

describe('Sample lesson', () => {
  beforeEach(() => {
    resetLearnerForTests();
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

  it('saves "hola" as ready to review after continuing with English to Spanish', async () => {
    await render(<LearnScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(getLearnerSnapshot().profile).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(screen.getByText('hola')).toBeOnTheScreen();
    expect(screen.getByText('hello')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save word' }));

    const saved = getLearnerSnapshot().words[0];
    expect(saved).toMatchObject({
      id: 'es:hola',
      text: 'hola',
      meaning: 'hello',
      language: 'es',
      lessonId: 'sample-es',
      status: 'ready-to-review',
      score: null,
      difficulty: 'intro',
    });
    expect(screen.getByRole('button', { name: 'Word saved' })).toBeDisabled();

    await render(<ProgressScreen />);
    expect(screen.getByText('hola')).toBeOnTheScreen();
    expect(screen.getByText('hello · Ready to review')).toBeOnTheScreen();
  });
});
