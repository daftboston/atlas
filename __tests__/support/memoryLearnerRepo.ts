import type { LearnerRepository } from '@/data/repositories/learnerRepo';
import type { LearnerProfile, SavedWord } from '@/domain/types';

const COURSES: Record<string, LearnerProfile> = {
  'en-es-v0': { nativeLanguage: 'en', targetLanguage: 'es' },
};

/**
 * In-memory LearnerRepository for UI tests (Jest can't run native SQLite). The real
 * repository is tested against SQLite in src/data/repositories/learnerRepo.test.ts.
 */
export function createMemoryLearnerRepository(): LearnerRepository & {
  activeCourseId: () => string | null;
  savedSeedIds: () => string[];
} {
  let activeCourseId: string | null = null;
  let words: SavedWord[] = [];
  const bySeedId = new Map<string, string>();
  let nextId = 1;

  return {
    activeCourseId: () => activeCourseId,
    savedSeedIds: () => [...bySeedId.keys()],
    async getProfile() {
      return activeCourseId ? COURSES[activeCourseId] : null;
    },
    async startCourse(courseId) {
      const profile = COURSES[courseId];
      if (!profile) throw new Error(`Unknown course ${courseId}`);
      activeCourseId = courseId;
      return profile;
    },
    async clearProfile() {
      activeCourseId = null;
    },
    async listSavedWords() {
      return [...words];
    },
    async saveWord(word, savedAtMs) {
      if (!activeCourseId) throw new Error('Start a course before saving words');
      const existingId = bySeedId.get(word.seedId);
      const existing = words.find((saved) => saved.id === existingId);
      if (existing) return existing;
      const saved: SavedWord = {
        id: `item-${nextId++}`,
        text: word.text,
        meaning: word.meaning,
        example: word.example,
        lessonId: word.lessonId,
        language: COURSES[activeCourseId].targetLanguage,
        difficulty: 'intro',
        status: 'ready-to-review',
        score: null,
        savedAt: new Date(savedAtMs).toISOString(),
      };
      bySeedId.set(word.seedId, saved.id);
      words = [saved, ...words];
      return saved;
    },
  };
}
