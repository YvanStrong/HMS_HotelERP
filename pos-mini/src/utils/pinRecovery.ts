import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const QUESTION_KEY = 'pos_mini_recovery_question';
const ANSWER_HASH_KEY = 'pos_mini_recovery_answer_hash';

export async function hashAnswer(answer: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    answer.trim().toLowerCase(),
  );
}

export async function setPinRecovery(question: string, answer: string): Promise<void> {
  await SecureStore.setItemAsync(QUESTION_KEY, question.trim());
  const hash = await hashAnswer(answer);
  await SecureStore.setItemAsync(ANSWER_HASH_KEY, hash);
}

export async function getRecoveryQuestion(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(QUESTION_KEY);
  } catch {
    return null;
  }
}

export async function hasPinRecovery(): Promise<boolean> {
  const q = await getRecoveryQuestion();
  const a = await SecureStore.getItemAsync(ANSWER_HASH_KEY);
  return Boolean(q && a);
}

export async function verifyRecoveryAnswer(answer: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(ANSWER_HASH_KEY);
  if (!stored) return false;
  const hash = await hashAnswer(answer);
  return stored === hash;
}

export async function clearPinRecovery(): Promise<void> {
  await SecureStore.deleteItemAsync(QUESTION_KEY);
  await SecureStore.deleteItemAsync(ANSWER_HASH_KEY);
}
