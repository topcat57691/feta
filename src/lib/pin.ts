export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`feta:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function matchesPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}
