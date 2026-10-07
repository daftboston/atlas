import { eq } from 'drizzle-orm';

import type { AppSettings } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { appSettings } from '../schema';

export type SettingKey = keyof AppSettings;

/** learning-loop §3.8: key/value settings, values stored as JSON. */
export function createSettingsRepo(db: AtlasDatabase) {
  return {
    get<K extends SettingKey>(key: K): AppSettings[K] | null {
      const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
      return row ? (JSON.parse(row.value) as AppSettings[K]) : null;
    },
    set<K extends SettingKey>(key: K, value: AppSettings[K]): void {
      const encoded = JSON.stringify(value);
      db.insert(appSettings)
        .values({ key, value: encoded })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: encoded } })
        .run();
    },
    remove(key: SettingKey): void {
      db.delete(appSettings).where(eq(appSettings.key, key)).run();
    },
  };
}
