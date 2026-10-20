import { gradeAttempt, type GradeInput } from './grading';

function grade(overrides: Partial<GradeInput> = {}) {
  return gradeAttempt({
    status: 'scored',
    promptType: 'recall-speak',
    inputMode: 'speech',
    tryNumber: 1,
    overall: 100,
    ...overrides,
  });
}

describe('gradeAttempt', () => {
  it.each([
    [49, 1],
    [50, 2],
    [74, 2],
    [75, 3],
    [89, 3],
    [90, 4],
    [100, 4],
  ] as const)('maps overall %s to rating %s for spoken recall', (overall, rating) => {
    expect(grade({ overall })).toBe(rating);
  });

  it('caps listen-repeat and typed answers at Good', () => {
    expect(grade({ promptType: 'listen-repeat', overall: 100 })).toBe(3);
    expect(grade({ inputMode: 'typed', overall: 100 })).toBe(3);
    expect(grade({ promptType: 'listen-repeat', inputMode: 'typed', overall: 74 })).toBe(2);
  });

  it('grades a skip or silence as Again and ignores retries and failures', () => {
    expect(grade({ status: 'skipped', overall: null })).toBe(1);
    expect(grade({ status: 'captured', overall: null })).toBe(1);
    expect(grade({ status: 'failed', overall: null })).toBeNull();
    expect(grade({ tryNumber: 2, overall: 100 })).toBeNull();
    expect(grade({ tryNumber: 0, status: 'failed', overall: null })).toBeNull();
  });
});
