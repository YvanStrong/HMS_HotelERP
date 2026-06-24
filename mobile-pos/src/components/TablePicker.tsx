import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

type Props = {
  tables: string[];
  occupied?: Set<string>;
  onSelect: (table: string) => void;
  onWalkIn: () => void;
};

export function TablePicker({ tables, occupied, onSelect, onWalkIn }: Props) {
  const { t } = useTranslation();

  return (
    <View>
      <Text allowFontScaling={false} className="mb-3 text-base font-semibold text-slate-800">
        {t("tables")}
      </Text>
      <View className="mb-6 flex-row flex-wrap">
        {tables.map((table) => {
          const busy = occupied?.has(table);
          return (
            <Pressable
              key={table}
              onPress={() => onSelect(table)}
              className={`m-1 min-h-[44px] min-w-[44px] h-16 w-[22%] items-center justify-center rounded-xl border ${
                busy ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <Text allowFontScaling={true} className="font-semibold text-slate-900">
                {table}
              </Text>
              <Text
                allowFontScaling={false}
                className={`text-[10px] font-medium ${busy ? "text-amber-800" : "text-emerald-800"}`}
              >
                {busy ? t("occupied") : t("available")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text allowFontScaling={false} className="mb-3 text-base font-semibold text-slate-800">
        {t("walkInCounter")}
      </Text>
      <Pressable
        onPress={onWalkIn}
        className="min-h-[44px] rounded-2xl border border-indigo-200 bg-indigo-50 p-4 active:bg-indigo-100"
      >
        <Text allowFontScaling={false} className="text-center font-semibold text-indigo-800">
          {t("counterSale")}
        </Text>
        <Text allowFontScaling={false} className="mt-1 text-center text-xs text-indigo-700">
          {t("counterSaleHint")}
        </Text>
      </Pressable>
    </View>
  );
}
