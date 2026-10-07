import { newId } from './id';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '0b7f2a52-3c5e-4f0e-9a51-7a4f1c9d2e10') }));

it('newId() returns a UUID from expo-crypto randomUUID (architecture §5)', () => {
  expect(newId()).toBe('0b7f2a52-3c5e-4f0e-9a51-7a4f1c9d2e10');
});
