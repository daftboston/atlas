import { desc, eq } from 'drizzle-orm';

import type { SavedWord } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { courses, knowledgeItems, savedWords } from '../schema';

export type NewSavedWord = {
  itemId: string;
  example: string;
  lessonId: string;
  savedAt: number;
};

function selectSavedWords(db: AtlasDatabase) {
  return db
    .select({
      id: knowledgeItems.id,
      text: knowledgeItems.targetText,
      meaning: knowledgeItems.meaning,
      example: savedWords.example,
      lessonId: savedWords.lessonId,
      language: courses.targetLang,
      difficulty: savedWords.difficulty,
      status: savedWords.status,
      savedAt: savedWords.savedAt,
    })
    .from(savedWords)
    .innerJoin(knowledgeItems, eq(knowledgeItems.id, savedWords.itemId))
    .innerJoin(courses, eq(courses.id, knowledgeItems.courseId));
}

type Row = ReturnType<ReturnType<typeof selectSavedWords>['all']>[number];

function toSavedWord(row: Row): SavedWord {
  return {
    ...row,
    // Nothing is scored yet; the `score` column stays NULL until speech scoring lands.
    score: null,
    savedAt: new Date(row.savedAt).toISOString(),
  };
}

/** The learner's saved words (`saved_words` joined with their KnowledgeItem and Course). */
export function createSavedWordRepo(db: AtlasDatabase) {
  return {
    /** Saves once per item. Saving again keeps the original row, including `saved_at`. */
    save(word: NewSavedWord): void {
      db.insert(savedWords)
        .values({
          itemId: word.itemId,
          example: word.example,
          lessonId: word.lessonId,
          difficulty: 'intro',
          status: 'ready-to-review',
          score: null,
          savedAt: word.savedAt,
        })
        .onConflictDoNothing({ target: savedWords.itemId })
        .run();
    },
    get(itemId: string): SavedWord | null {
      const row = selectSavedWords(db).where(eq(savedWords.itemId, itemId)).get();
      return row ? toSavedWord(row) : null;
    },
    /** Newest first, like the in-memory store it replaces. */
    list(): SavedWord[] {
      return selectSavedWords(db).orderBy(desc(savedWords.savedAt)).all().map(toSavedWord);
    },
  };
}
