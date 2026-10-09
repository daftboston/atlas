import { eq } from 'drizzle-orm';

import type { Course } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { courses } from '../schema';

/** learning-loop §3.0 */
export function createCourseRepo(db: AtlasDatabase) {
  return {
    get(id: string): Course | null {
      return db.select().from(courses).where(eq(courses.id, id)).get() ?? null;
    },
    list(): Course[] {
      return db.select().from(courses).all();
    },
    setSpeechLocale(id: string, locale: string) {
      const course = db.select().from(courses).where(eq(courses.id, id)).get();
      if (!course) throw new Error(`Unknown course ${id}`);
      if (!course.speechLocales.includes(locale)) throw new Error(`Locale ${locale} is not in this course`);
      db.update(courses).set({ speechLocale: locale }).where(eq(courses.id, id)).run();
    },
  };
}
