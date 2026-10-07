import * as Crypto from 'expo-crypto';

/** UUID v4 for every entity id (architecture §5). Tests can mock this for deterministic ids. */
export function newId(): string {
  return Crypto.randomUUID();
}
