import { Text } from "react-native";

type Props = {
  text: string;
  query: string;
  className?: string;
  numberOfLines?: number;
};

/** Bold the substring matching query (case-insensitive). */
export function HighlightedText({ text, query, className = "font-semibold text-slate-900", numberOfLines }: Props) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {before}
      <Text className="font-bold text-indigo-700">{match}</Text>
      {after}
    </Text>
  );
}
