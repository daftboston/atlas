import { fireEvent, render, screen } from '@testing-library/react-native';

import LearnScreen from '@/app/(tabs)/index';
import ProgressScreen from '@/app/(tabs)/progress';
import { resetLearnerForTests, getLearnerSnapshot } from '@/lib/learner-store';

describe('Sample lesson', () => {
  beforeEach(() => {
    resetLearnerForTests();
  });

  it('saves a word as ready to review after a language is chosen', async () => {
    await render(<LearnScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Native language, Spanish' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Target language, English' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('hello')).toBeOnTheScreen();
    expect(screen.getByText('hola')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save word' }));

    const saved = getLearnerSnapshot().words[0];
    expect(saved).toMatchObject({
      text: 'hello',
      meaning: 'hola',
      language: 'en',
      lessonId: 'sample-en',
      status: 'ready-to-review',
      score: null,
      difficulty: 'intro',
    });
    expect(screen.getByRole('button', { name: 'Word saved' })).toBeDisabled();

    await render(<ProgressScreen />);
    expect(screen.getByText(/Ready to review/)).toBeOnTheScreen();
  });
});
