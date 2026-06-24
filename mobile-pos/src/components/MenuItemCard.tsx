import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import type { DepotProduct } from "../types";
import { productPrice } from "../api/menu";
import { resolveMediaUrl } from "../lib/mediaUrl";
import { isLowStock, isOutOfStock, menuCategoryLabel } from "../lib/stockHelpers";
import {
  ALLERGEN_ICONS,
  DIETARY_ICONS,
  localizedProductName,
  productConflictsWithGuest,
} from "../lib/allergens";
import { HighlightedText } from "./HighlightedText";

type Props = {
  product: DepotProduct;
  onAdd: () => void;
  onLongPress: () => void;
  onPreviewImage?: () => void;
  onCaptureImage?: () => void;
  canCaptureImage?: boolean;
  lowStockThreshold?: number;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  searchQuery?: string;
  showCategoryLabel?: boolean;
  guestRestrictions?: string[];
};

function FlagIcon({ code, kind }: { code: string; kind: "allergen" | "dietary" }) {
  const [tip, setTip] = useState(false);
  const meta = kind === "allergen" ? ALLERGEN_ICONS[code] : DIETARY_ICONS[code];
  if (!meta) return null;
  return (
    <Pressable
      onPress={() => setTip((v) => !v)}
      hitSlop={6}
      className="min-h-[44px] min-w-[44px] items-center justify-center"
      accessibilityLabel={meta.label}
    >
      <Text allowFontScaling={false} className="text-base">
        {meta.emoji}
      </Text>
      {tip ? (
        <Text allowFontScaling={false} className="absolute -bottom-5 text-[9px] text-slate-600">
          {meta.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function MenuItemCard({
  product,
  onAdd,
  onLongPress,
  onPreviewImage,
  onCaptureImage,
  canCaptureImage,
  lowStockThreshold = 5,
  isFavorited = false,
  onToggleFavorite,
  searchQuery = "",
  showCategoryLabel = false,
  guestRestrictions = [],
}: Props) {
  const { t, i18n } = useTranslation();
  const price = productPrice(product);
  const imageUri = resolveMediaUrl(product.photoUrl);
  const soldOut = isOutOfStock(product);
  const lowStock = !soldOut && isLowStock(product, lowStockThreshold);
  const displayName = localizedProductName(product, i18n.language);
  const conflict = productConflictsWithGuest(product.allergens, product.dietaryFlags, guestRestrictions);
  const flags = [
    ...(product.allergens ?? []).map((c) => ({ code: c, kind: "allergen" as const })),
    ...(product.dietaryFlags ?? []).map((c) => ({ code: c, kind: "dietary" as const })),
  ];

  function handleAdd() {
    if (soldOut) {
      Toast.show({ type: "error", text1: t("soldOut") });
      return;
    }
    onAdd();
  }

  return (
    <View
      className={`mb-3 w-[48%] overflow-hidden rounded-2xl border bg-white shadow-sm ${
        conflict.conflict ? "border-orange-500 border-2" : "border-slate-200"
      } ${soldOut ? "opacity-50" : ""}`}
    >
      <View className="relative">
        {imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              className="h-32 w-full bg-slate-100"
              contentFit="cover"
              cachePolicy="disk"
              transition={200}
            />
            <Pressable onPress={onPreviewImage} className="absolute inset-0" accessibilityLabel={displayName} />
          </>
        ) : (
          <View className="h-32 items-center justify-center bg-slate-100">
            <Ionicons name="fast-food-outline" size={32} color="#64748b" />
          </View>
        )}
        {onToggleFavorite ? (
          <Pressable
            onPress={onToggleFavorite}
            className="absolute right-2 top-2 z-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/90"
          >
            <Ionicons name={isFavorited ? "star" : "star-outline"} size={18} color={isFavorited ? "#f59e0b" : "#475569"} />
          </Pressable>
        ) : null}
        {soldOut ? (
          <View className="absolute bottom-2 left-2 rounded-full bg-red-700 px-2 py-0.5">
            <Text allowFontScaling={false} className="text-[10px] font-bold text-white">
              {t("soldOut")}
            </Text>
          </View>
        ) : lowStock ? (
          <View className="absolute bottom-2 left-2 rounded-full bg-amber-600 px-2 py-0.5">
            <Text allowFontScaling={false} className="text-[10px] font-bold text-white">
              {t("lowStock")}
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable onPress={handleAdd} onLongPress={onLongPress} className="p-3">
        <HighlightedText text={displayName} query={searchQuery} numberOfLines={2} />
        {showCategoryLabel ? (
          <Text allowFontScaling={false} className="mt-0.5 text-xs text-slate-600">
            {menuCategoryLabel(product)}
          </Text>
        ) : null}
        {flags.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap">
            {flags.slice(0, 6).map((f) => (
              <FlagIcon key={`${f.kind}-${f.code}`} code={f.code} kind={f.kind} />
            ))}
          </View>
        ) : null}
        {conflict.conflict && conflict.message ? (
          <Text allowFontScaling={true} className="mt-1 text-xs font-medium text-orange-700">
            {t("guestConflict", { message: conflict.message })}
          </Text>
        ) : null}
        <View className="mt-2 flex-row items-center justify-between">
          <Text allowFontScaling={false} className="font-bold text-indigo-700">
            {price.toFixed(2)}
          </Text>
          <Pressable
            onPress={handleAdd}
            disabled={soldOut}
            className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-full ${
              soldOut ? "bg-slate-400" : "bg-indigo-600"
            }`}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}
