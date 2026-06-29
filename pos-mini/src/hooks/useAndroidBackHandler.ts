import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

/** Android hardware back: pop stack on inner screens; home is handled by OS. */
export function useAndroidBackHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/' || pathname === '/index') {
        return false;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [pathname, router]);
}
