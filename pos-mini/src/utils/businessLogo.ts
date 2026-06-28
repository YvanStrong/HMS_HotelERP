import * as FileSystem from 'expo-file-system/legacy';

const LOGO_DIR = `${FileSystem.documentDirectory}business/`;
const LOGO_FILE = `${LOGO_DIR}logo.jpg`;

export async function persistBusinessLogo(uri: string): Promise<string> {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;

  await FileSystem.makeDirectoryAsync(LOGO_DIR, { intermediates: true });
  await FileSystem.copyAsync({ from: uri, to: LOGO_FILE });
  return LOGO_FILE;
}

export function getBusinessLogoPath(): string {
  return LOGO_FILE;
}
