import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useAppStore } from '../store/appStore';
import { getStackScreenOptions } from './headerOptions';

type StackProps = ComponentProps<typeof Stack>;

function ThemedStackInner({ screenOptions, ...rest }: StackProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const themed = getStackScreenOptions(themeMode);
  const merged =
    screenOptions && typeof screenOptions === 'object' && !Array.isArray(screenOptions)
      ? { ...themed, ...screenOptions }
      : themed;

  return <Stack screenOptions={merged} {...rest} />;
}

export const ThemedStack = Object.assign(ThemedStackInner, { Screen: Stack.Screen });
