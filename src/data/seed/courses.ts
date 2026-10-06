// Default course seed config (architecture §8 allows the language literals here).
// Adding a course means a new content/ deck plus an entry in this list.
import seedV0 from '../../../content/seed/seed-phrases-v0.json';

export type CourseConfig = {
  /** English display name (learning-loop §3.0 `title`). Not part of the seed file schema. */
  title: string;
  /** Raw seed file; validated against learning-loop §11 when it is loaded. */
  seed: unknown;
};

export const DEFAULT_COURSE: CourseConfig = { title: 'Spanish', seed: seedV0 };

export const COURSE_CONFIGS: readonly CourseConfig[] = [DEFAULT_COURSE];
