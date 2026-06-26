import { TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, inputStyle } from '../constants/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search...' }: Props) {
  return (
    <View className="mb-3 flex-row items-center rounded-xl border border-app-border bg-app-surface px-3">
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[inputStyle, { flex: 1, borderWidth: 0, marginLeft: 8, paddingVertical: 10 }]}
      />
    </View>
  );
}
