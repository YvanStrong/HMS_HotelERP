import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = "Search menu..." }: Props) {
  return (
    <View className="mx-3 mt-2 flex-row items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
      <Ionicons name="search-outline" size={18} color="#94a3b8" />
      <TextInput
        className="ml-2 flex-1 py-2.5 text-base text-slate-900"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8} className="p-1">
          <Ionicons name="close-circle" size={20} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Debounce a string value (default 200ms). */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
