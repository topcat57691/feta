import { describe, expect, it } from 'vitest';
import { createPinSalt, hashPin, validPin, verifyPin } from './pin';

describe('PIN hashing', () => {
  it('uses a unique salt and verifies the original PIN', async () => {
    const saltA = createPinSalt();
    const saltB = createPinSalt();
    expect(saltA).not.toBe(saltB);

    const hash = await hashPin('4827', saltA);
    expect(await verifyPin('4827', saltA, hash)).toBe(true);
    expect(await verifyPin('4828', saltA, hash)).toBe(false);
  });

  it('only accepts four numeric digits', () => {
    expect(validPin('1234')).toBe(true);
    expect(validPin('123')).toBe(false);
    expect(validPin('12a4')).toBe(false);
  });
});
