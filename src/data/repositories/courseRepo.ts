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
  };
}
