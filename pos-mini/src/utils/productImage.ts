import * as FileSystem from 'expo-file-system/legacy';

const PRODUCTS_DIR = `${FileSystem.documentDirectory}products/`;

export function isRemoteImageUri(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export async function persistProductImage(uri: string, productId: string): Promise<string> {
  if (!uri || isRemoteImageUri(uri)) return uri;

  await FileSystem.makeDirectoryAsync(PRODUCTS_DIR, { intermediates: true });
  const ext = uri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${PRODUCTS_DIR}${productId}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}
