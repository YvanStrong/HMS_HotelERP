import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useInputStyle, useThemeColors } from '../hooks/useTheme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  required?: boolean;
};

export function FormField({ label, hint, required, style, ...props }: Props) {
  const inputStyle = useInputStyle();
  const palette = useThemeColors();

  return (
    <View className="mb-3 w-full">
      <Text className="mb-1.5 text-sm font-semibold text-app-text">
        {label}
        {required ? <Text className="text-app-danger"> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={palette.placeholder}
        style={[inputStyle, style]}
        {...props}
      />
      {hint ? <Text className="mt-1 text-xs text-app-muted">{hint}</Text> : null}
    </View>
  );
}
