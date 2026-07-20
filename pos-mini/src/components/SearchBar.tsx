import { TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInputStyle, useThemeColors } from '../hooks/useTheme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search...' }: Props) {
  const inputStyle = useInputStyle();
  const palette = useThemeColors();

  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-app-border bg-app-surface px-3">
      <Ionicons name="search" size={20} color={palette.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.placeholder}
        style={[inputStyle, { flex: 1, borderWidth: 0, marginLeft: 8, paddingVertical: 10 }]}
      />
    </View>
  );
}
