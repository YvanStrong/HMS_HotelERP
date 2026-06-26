import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import type { DepotProduct } from "../types";
import { productPrice } from "../api/menu";
import { isLowStock, isOutOfStock, menuCategoryLabel } from "../lib/stockHelpers";
import {
  ALLERGEN_ICONS,
  DIETARY_ICONS,
  localizedProductName,
  productConflictsWithGuest,
} from "../lib/allergens";
import { HighlightedText } from "./HighlightedText";
import { ProductPhoto } from "./ProductPhoto";

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    width: "48%",
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  cardConflict: {
    borderColor: "#f97316",
    borderWidth: 2,
  },
  cardSoldOut: {
    opacity: 0.5,
  },
  imageWrap: {
    position: "relative",
  },
  body: {
    padding: 12,
  },
});
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
      style={[
        styles.card,
        conflict.conflict ? styles.cardConflict : null,
        soldOut ? styles.cardSoldOut : null,
      ]}
    >
      <View style={styles.imageWrap}>
        <ProductPhoto photoUrl={product.photoUrl} />
        {onPreviewImage && product.photoUrl ? (
          <Pressable onPress={onPreviewImage} style={StyleSheet.absoluteFill} accessibilityLabel={displayName} />
        ) : null}
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
      <Pressable onPress={handleAdd} onLongPress={onLongPress} style={styles.body}>
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
