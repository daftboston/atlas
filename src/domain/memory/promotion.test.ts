import { itemStatusAfterGrade, shouldMaster } from './promotion';

const review = { status: 'review' as const, stabilityDays: 60, lapses: 3, rating: 3 as const };

describe('promotion', () => {
  it('masters a review card at the stability, rating, and lapse boundaries', () => {
    expect(shouldMaster(review)).toBe(true);
    expect(shouldMaster({ ...review, stabilityDays: 59.9 })).toBe(false);
    expect(shouldMaster({ ...review, lapses: 4 })).toBe(false);
    expect(shouldMaster({ ...review, rating: 2 })).toBe(false);
    expect(shouldMaster({ ...review, status: 'learning' })).toBe(false);
  });

  it('follows the first grades of a new item and a lapse from mastered', () => {
    expect(
      itemStatusAfterGrade({ status: 'new', fsrsState: 'Learning', rating: 3, stabilityDays: 2, lapses: 0 }),
    ).toBe('learning');
    expect(
      itemStatusAfterGrade({ status: 'learning', fsrsState: 'Review', rating: 4, stabilityDays: 2, lapses: 0 }),
    ).toBe('review');
    expect(
      itemStatusAfterGrade({ status: 'review', fsrsState: 'Review', rating: 3, stabilityDays: 80, lapses: 1 }),
    ).toBe('mastered');
    expect(
      itemStatusAfterGrade({ status: 'mastered', fsrsState: 'Relearning', rating: 1, stabilityDays: 1, lapses: 2 }),
    ).toBe('relearning');
    expect(
      itemStatusAfterGrade({ status: 'mastered', fsrsState: 'Review', rating: 3, stabilityDays: 90, lapses: 1 }),
    ).toBe('mastered');
  });
});
