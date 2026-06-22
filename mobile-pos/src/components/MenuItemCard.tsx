import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { DepotProduct } from "../types";
import { productPrice } from "../api/menu";
import { resolveMediaUrl } from "../lib/mediaUrl";

type Props = {
  product: DepotProduct;
  onAdd: () => void;
  onLongPress: () => void;
  onPreviewImage?: () => void;
  onCaptureImage?: () => void;
  canCaptureImage?: boolean;
};

export function MenuItemCard({
  product,
  onAdd,
  onLongPress,
  onPreviewImage,
  onCaptureImage,
  canCaptureImage,
}: Props) {
  const price = productPrice(product);
  const imageUri = resolveMediaUrl(product.photoUrl);

  return (
    <View className="mb-3 w-[48%] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <Pressable
              onPress={onPreviewImage}
              className="absolute inset-0"
              accessibilityLabel={`Preview ${product.productName}`}
            />
            <View className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/40 p-1.5">
              <Ionicons name="expand-outline" size={14} color="#fff" />
            </View>
          </>
        ) : (
          <View className="h-32 items-center justify-center bg-slate-100">
            <Ionicons name="fast-food-outline" size={32} color="#94a3b8" />
            {canCaptureImage ? (
              <Pressable
                onPress={onCaptureImage}
                className="mt-2 flex-row items-center rounded-full bg-white px-3 py-1.5 shadow"
              >
                <Ionicons name="camera-outline" size={14} color="#4f46e5" />
                <Text className="ml-1 text-xs font-semibold text-indigo-600">Add photo</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {canCaptureImage && imageUri ? (
          <Pressable
            onPress={onCaptureImage}
            className="absolute left-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow"
          >
            <Ionicons name="camera-outline" size={16} color="#4f46e5" />
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onAdd} onLongPress={onLongPress} className="p-3">
        <Text className="font-semibold text-slate-900" numberOfLines={2}>
          {product.productName}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-bold text-indigo-600">{price.toFixed(2)}</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
            <Ionicons name="add" size={18} color="#fff" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
