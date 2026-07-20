import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../hooks/useTheme';
import { FormField } from './FormField';
import { ProductPhoto } from './ProductPhoto';

type Props = {
  value: string | null;
  onChange: (uri: string | null) => void;
};

export function ProductImagePicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const [urlInput, setUrlInput] = useState(
    value && (value.startsWith('http://') || value.startsWith('https://')) ? value : '',
  );

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: fromCamera ? 'Camera permission required' : 'Photo library permission required' });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.65,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
    if (!result.canceled && result.assets[0]?.uri) {
      onChange(result.assets[0].uri);
      setUrlInput('');
    }
  };

  const applyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Toast.show({ type: 'error', text1: 'URL must start with http:// or https://' });
      return;
    }
    onChange(trimmed);
  };

  const clearImage = () => {
    onChange(null);
    setUrlInput('');
  };

  return (
    <View className="mb-3 w-full">
      <Text className="mb-1.5 text-sm font-semibold text-app-text">Product image</Text>
      <View className="flex-row flex-wrap items-center gap-4 rounded-xl border border-app-border bg-app-surface p-4">
        <ProductPhoto uri={value} size={88} />
        <View className="min-w-[140px] flex-1 gap-2">
          <Pressable
            onPress={() => void pickImage(true)}
            className="rounded-lg border border-app-border px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-app-text">Take photo</Text>
          </Pressable>
          <Pressable
            onPress={() => void pickImage(false)}
            className="rounded-lg bg-app-primary px-4 py-3 active:opacity-90"
          >
            <Text className="text-center text-sm font-semibold text-white">Choose photo</Text>
          </Pressable>
          {value ? (
            <Pressable onPress={clearImage} className="rounded-lg border border-app-border px-4 py-2">
              <Text className="text-center text-sm font-medium text-app-danger">Remove image</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View className="mt-3">
        <FormField
          label="Or paste image URL"
          hint="Shown on product cards during sales"
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="https://example.com/product.jpg"
          autoCapitalize="none"
          keyboardType="url"
          onBlur={applyUrl}
          onSubmitEditing={applyUrl}
        />
      </View>
      {value ? (
        <Text className="text-xs text-app-muted" style={{ color: colors.textMuted }}>
          Image will appear on the sales screen
        </Text>
      ) : null}
    </View>
  );
}
