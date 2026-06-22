import { Pressable, Text, View } from "react-native";

type Props = {
  tables: string[];
  occupied?: Set<string>;
  onSelect: (table: string) => void;
  onWalkIn: () => void;
};

export function TablePicker({ tables, occupied, onSelect, onWalkIn }: Props) {
  return (
    <View>
      <Text className="mb-3 text-base font-semibold text-slate-800">Tables</Text>
      <View className="mb-6 flex-row flex-wrap">
        {tables.map((table) => {
          const busy = occupied?.has(table);
          return (
            <Pressable
              key={table}
              onPress={() => onSelect(table)}
              className={`m-1 h-16 w-[22%] items-center justify-center rounded-xl border ${
                busy ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <Text className="font-semibold text-slate-800">{table}</Text>
              <Text className={`text-[10px] ${busy ? "text-amber-700" : "text-emerald-700"}`}>
                {busy ? "Occupied" : "Available"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mb-3 text-base font-semibold text-slate-800">Walk-in / Counter</Text>
      <Pressable
        onPress={onWalkIn}
        className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 active:bg-indigo-100"
      >
        <Text className="text-center font-semibold text-indigo-700">Counter sale</Text>
        <Text className="mt-1 text-center text-xs text-indigo-500">Quick order without a table</Text>
      </Pressable>
    </View>
  );
}
