import { initCard, retrievability, schedule } from './fsrs';

const NOW = Date.parse('2026-10-07T15:00:00.000Z');

describe('fsrs wrapper', () => {
  it('starts a new card due at the injected time', () => {
    expect(initCard(NOW)).toMatchObject({ state: 'New', due: NOW, stability: 0, reps: 0, learningSteps: 0 });
  });

  it('moves a new card to Review after two Good grades in the same session', () => {
    const first = schedule(initCard(NOW), 3, NOW);
    expect(first.card.state).toBe('Learning');
    expect(first.card.learningSteps).toBe(1);
    expect(first.log).toMatchObject({ stateBefore: 'New', rating: 3, reviewedAt: NOW });

    const second = schedule(first.card, 3, NOW + 1000);
    expect(second.card.state).toBe('Review');
    expect(second.card.scheduledDays).toBeGreaterThan(0);
    expect(second.log.stateBefore).toBe('Learning');
  });

  it('schedules the same due time for the same card, rating, and now', () => {
    const card = initCard(NOW);
    expect(schedule(card, 3, NOW).card.due).toBe(schedule(card, 3, NOW).card.due);
  });

  it('reports retrievability as a fraction from 0 to 1', () => {
    const card = schedule(initCard(NOW), 3, NOW).card;
    const value = retrievability(card, NOW + 1000);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});
