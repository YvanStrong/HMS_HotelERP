import { useRouter, usePathname } from 'expo-router';

export function useGoBack() {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (pathname !== '/' && pathname !== '/index') {
      router.replace('/');
    }
  };

  const canShowBack =
    pathname !== '/' &&
    pathname !== '/index' &&
    !(pathname.includes('setup') && !router.canGoBack());

  return { goBack, canShowBack };
}
