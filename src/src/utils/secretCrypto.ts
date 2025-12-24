const SECRET_PREFIX = 'sm1';

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(addressKey: string): Promise<CryptoKey> {
  const normalized = addressKey.toLowerCase();
  const source = new TextEncoder().encode(`secretmint:${normalized}`);
  const hash = await crypto.subtle.digest('SHA-256', source);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(secret: string, addressKey: string): Promise<string> {
  const key = await deriveKey(addressKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(secret);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return `${SECRET_PREFIX}:${encodeBase64(iv)}:${encodeBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string, addressKey: string): Promise<string> {
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== SECRET_PREFIX) {
    throw new Error('Unsupported secret payload');
  }

  const key = await deriveKey(addressKey);
  const iv = decodeBase64(parts[1]);
  const ciphertext = decodeBase64(parts[2]);
  const clearBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(clearBytes);
}
