import type { BusinessSettings } from '../types';
import {
  getReceiptDisplayPrefs,
  type ReceiptDisplayPrefs,
} from '../repositories/metaRepository';

export type ReceiptBuildOptions = {
  settings: BusinessSettings;
  display: ReceiptDisplayPrefs;
};

export async function loadReceiptBuildOptions(
  settings: BusinessSettings,
): Promise<ReceiptBuildOptions> {
  const display = await getReceiptDisplayPrefs();
  return { settings, display };
}
