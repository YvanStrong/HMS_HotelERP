import * as Crypto from 'expo-crypto';

const MAGIC = 'POSMINI1';

async function deriveKey(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${MAGIC}:${password}`);
}

function xorWithKey(data: string, key: string): string {
  let out = '';
  for (let i = 0; i < data.length; i += 1) {
    out += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

export async function encryptBackupPayload(json: string, password: string): Promise<string> {
  const key = await deriveKey(password);
  const xored = xorWithKey(json, key);
  const b64 = btoa(unescape(encodeURIComponent(xored)));
  return JSON.stringify({ encrypted: true, v: 1, payload: b64 });
}

export async function decryptBackupPayload(content: string, password: string): Promise<string> {
  let parsed: { encrypted?: boolean; payload?: string };
  try {
    parsed = JSON.parse(content) as { encrypted?: boolean; payload?: string };
  } catch {
    throw new Error('Invalid backup file');
  }
  if (!parsed.encrypted || !parsed.payload) {
    throw new Error('Backup is not encrypted');
  }
  const key = await deriveKey(password);
  const xored = decodeURIComponent(escape(atob(parsed.payload)));
  const json = xorWithKey(xored, key);
  JSON.parse(json);
  return json;
}
