import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, inputStyle } from '../constants/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  required?: boolean;
};

export function FormField({ label, hint, required, style, ...props }: Props) {
  return (
    <View className="mb-3 w-full">
      <Text className="mb-1.5 text-sm font-semibold text-app-text">
        {label}
        {required ? <Text className="text-app-danger"> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[inputStyle, style]}
        {...props}
      />
      {hint ? <Text className="mt-1 text-xs text-app-muted">{hint}</Text> : null}
    </View>
  );
}
