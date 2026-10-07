import type { LearnerProfile, LessonWord, SavedWord } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { createCourseRepo } from './courseRepo';
import { createKnowledgeRepo } from './knowledgeRepo';
import { createSavedWordRepo } from './savedWordRepo';
import { createSettingsRepo } from './settingsRepo';

/**
 * What the learner store needs from persistence. The state layer depends on this
 * interface only, so UI tests can swap in an in-memory implementation.
 */
export interface LearnerRepository {
  /** The active course as a profile, or null before the learner has picked one. */
  getProfile(): Promise<LearnerProfile | null>;
  startCourse(courseId: string): Promise<LearnerProfile>;
  clearProfile(): Promise<void>;
  listSavedWords(): Promise<SavedWord[]>;
  /**
   * Saves the seeded KnowledgeItem behind a lesson word (it never creates items).
   * Idempotent: saving the same word again returns the first save unchanged.
   */
  saveWord(word: LessonWord, savedAtMs: number): Promise<SavedWord>;
}

export function createLearnerRepository(db: AtlasDatabase): LearnerRepository {
  const settings = createSettingsRepo(db);
  const courses = createCourseRepo(db);
  const savedWords = createSavedWordRepo(db);

  function profileFor(courseId: string | null): LearnerProfile | null {
    const course = courseId ? courses.get(courseId) : null;
    return course ? { nativeLanguage: course.sourceLang, targetLanguage: course.targetLang } : null;
  }

  return {
    async getProfile() {
      return profileFor(settings.get('activeCourseId'));
    },
    async startCourse(courseId) {
      const profile = profileFor(courseId);
      if (!profile) throw new Error(`Unknown course ${courseId}`);
      settings.set('activeCourseId', courseId);
      return profile;
    },
    async clearProfile() {
      settings.remove('activeCourseId');
    },
    async listSavedWords() {
      return savedWords.list();
    },
    async saveWord(word, savedAtMs) {
      const itemId = db.transaction((tx) => {
        const txSettings = createSettingsRepo(tx);
        const courseId = txSettings.get('activeCourseId');
        if (!courseId) throw new Error('Start a course before saving words');
        // Lesson words come from the seed deck, which loadSeed has already written.
        const item = createKnowledgeRepo(tx).getBySeedId(word.seedId);
        if (!item || item.courseId !== courseId) {
          throw new Error(`Seed item ${word.seedId} is not in course ${courseId}`);
        }
        createSavedWordRepo(tx).save({
          itemId: item.id,
          example: word.example,
          lessonId: word.lessonId,
          savedAt: savedAtMs,
        });
        return item.id;
      });
      const saved = savedWords.get(itemId);
      if (!saved) throw new Error(`Saved word ${itemId} was not found`);
      return saved;
    },
  };
}
