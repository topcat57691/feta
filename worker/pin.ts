const CURRENT_ITERATIONS = 10_000;
const LEGACY_ITERATIONS = 120_000;
const HASH_PREFIX = 'pbkdf2-sha256';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPinSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

async function derivePin(pin: string, salt: string, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    material,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await derivePin(pin, salt, CURRENT_ITERATIONS);
  return `${HASH_PREFIX}$${CURRENT_ITERATIONS}$${digest}`;
}

function parseStoredHash(expectedHash: string): { iterations: number; digest: string } {
  const parts = expectedHash.split('$');
  if (parts.length === 3 && parts[0] === HASH_PREFIX) {
    const iterations = Number(parts[1]);
    if (Number.isInteger(iterations) && iterations > 0 && parts[2]) {
      return { iterations, digest: parts[2] };
    }
  }
  return { iterations: LEGACY_ITERATIONS, digest: expectedHash };
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  const stored = parseStoredHash(expectedHash);
  const actual = await derivePin(pin, salt, stored.iterations);
  if (actual.length !== stored.digest.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ stored.digest.charCodeAt(index);
  }
  return mismatch === 0;
}

export function validPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}
