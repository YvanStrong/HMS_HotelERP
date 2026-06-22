import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { fetchMenuForDepot, groupProductsByCategory } from "../../../src/api/menu";
import { patchDepotProductPhoto } from "../../../src/api/inventory";
import { addLinesAction } from "../../../src/api/posActions";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { ScreenHeaderActions } from "../../../src/components/ScreenHeaderActions";
import { productPrice } from "../../../src/api/menu";
import { resolveMediaUrl } from "../../../src/lib/mediaUrl";
import type { CartLine, DepotProduct } from "../../../src/types";
import { useAuthStore } from "../../../src/store/authStore";
import { useCartStore } from "../../../src/store/cartStore";

const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);

export default function MenuScreen() {
  const { depotId } = useLocalSearchParams<{ depotId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const userRole = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");
  const canCaptureImage = MANAGER_ROLES.has(userRole);
  const depot = useCartStore((s) => s.selectedDepot);
  const tableLabel = useCartStore((s) => s.tableLabel);
  const addItem = useCartStore((s) => s.addItem);
  const ticketId = useCartStore((s) => s.ticketId);
  const itemCount = useCartStore((s) => s.itemCount());
  const total = useCartStore((s) => s.total());

  const [category, setCategory] = useState<string>("All");
  const [noteProduct, setNoteProduct] = useState<DepotProduct | null>(null);
  const [noteText, setNoteText] = useState("");
  const [previewProduct, setPreviewProduct] = useState<DepotProduct | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["menu", hotelId, depotId],
    queryFn: () => fetchMenuForDepot(hotelId, String(depotId)),
    enabled: !!hotelId && !!depotId,
  });

  const grouped = useMemo(() => groupProductsByCategory(products), [products]);
  const categories = useMemo(() => ["All", ...Object.keys(grouped).sort()], [grouped]);

  const visible = useMemo(() => {
    if (category === "All") return products;
    return grouped[category] ?? [];
  }, [category, grouped, products]);

  function openTicket() {
    if (ticketId) {
      router.push(`/(main)/ticket/${ticketId}`);
      return;
    }
    router.push("/(main)/ticket/index");
  }

  async function captureProductPhoto(product: DepotProduct) {
    if (!hotelId || !canCaptureImage) return;
    Alert.alert("Product photo", product.productName, [
      {
        text: "Take photo",
        onPress: () => void pickProductPhoto(product, "camera"),
      },
      {
        text: "Choose from gallery",
        onPress: () => void pickProductPhoto(product, "library"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function pickProductPhoto(product: DepotProduct, source: "camera" | "library") {
    if (!hotelId) return;
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: "error", text1: "Permission needed", text2: "Allow camera or photos access" });
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
            base64: true,
          });
    if (result.canceled || !result.assets[0]?.base64) return;
    const mime = result.assets[0].mimeType ?? "image/jpeg";
    const dataUrl = `data:${mime};base64,${result.assets[0].base64}`;
    setUploadingPhoto(true);
    try {
      await patchDepotProductPhoto(hotelId, product.id, dataUrl);
      await queryClient.invalidateQueries({ queryKey: ["menu", hotelId, depotId] });
      Toast.show({ type: "success", text1: "Photo saved", text2: product.productName });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Could not save photo",
        text2: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function addToTicket(product: DepotProduct, note?: string) {
    if (!ticketId || !hotelId) {
      addItem(product, note);
      return;
    }
    const line: CartLine = {
      productId: product.id,
      productName: product.productName,
      qty: 1,
      unitPrice: productPrice(product),
      notes: note,
      imageUrl: product.photoUrl ?? undefined,
      taxable: product.taxable,
    };
    try {
      await addLinesAction(hotelId, ticketId, [line]);
      Toast.show({ type: "success", text1: "Added to ticket", text2: product.productName, visibilityTime: 1200 });
    } catch {
      addItem(product, note);
      Toast.show({ type: "info", text1: "Added to cart", text2: "Will sync when online" });
    }
  }


  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-12">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900">{depot?.name ?? "Menu"}</Text>
            <Text className="text-sm text-indigo-600">{tableLabel ?? "No table selected"}</Text>
          </View>
          <ScreenHeaderActions />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 border-b border-slate-200 bg-white px-2">
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            className={`mx-1 my-2 rounded-full px-4 py-2 ${category === cat ? "bg-indigo-600" : "bg-slate-100"}`}
          >
            <Text className={`text-sm font-medium ${category === cat ? "text-white" : "text-slate-600"}`}>{cat}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-3 py-3" contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {visible.map((product) => (
            <MenuItemCard
              key={product.id}
              product={product}
              canCaptureImage={canCaptureImage}
              onPreviewImage={() => setPreviewProduct(product)}
              onCaptureImage={() => void captureProductPhoto(product)}
              onAdd={() => {
                if (ticketId) {
                  void addToTicket(product);
                } else {
                  addItem(product);
                  Toast.show({ type: "success", text1: "Added", text2: product.productName, visibilityTime: 1200 });
                }
              }}
              onLongPress={() => {
                setNoteProduct(product);
                setNoteText("");
              }}
            />
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={openTicket}
        className="mx-4 mb-6 rounded-2xl bg-indigo-600 px-4 py-4 active:bg-indigo-700"
      >
        <Text className="text-center font-semibold text-white">
          {ticketId ? "View ticket" : `View order (${itemCount} items)`} — {total.toFixed(2)}
        </Text>
      </Pressable>

      <Modal visible={!!previewProduct} transparent animationType="fade" onRequestClose={() => setPreviewProduct(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/90 px-4" onPress={() => setPreviewProduct(null)}>
          {previewProduct ? (
            <>
              <Image
                source={{ uri: resolveMediaUrl(previewProduct.photoUrl) ?? undefined }}
                className="h-72 w-full max-w-md rounded-2xl bg-slate-800"
                contentFit="contain"
              />
              <Text className="mt-4 text-center text-lg font-semibold text-white">{previewProduct.productName}</Text>
              <Text className="mt-1 text-indigo-300">{productPrice(previewProduct).toFixed(2)}</Text>
            </>
          ) : null}
        </Pressable>
      </Modal>

      {uploadingPhoto ? (
        <View className="absolute inset-0 items-center justify-center bg-black/30">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      <Modal visible={!!noteProduct} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl bg-white p-4">
            <Text className="mb-2 font-semibold text-slate-900">{noteProduct?.productName}</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Special instructions (e.g. no onions)"
              className="mb-4 rounded-xl border border-slate-200 px-3 py-3"
            />
            <View className="flex-row gap-3">
              <Pressable onPress={() => setNoteProduct(null)} className="flex-1 rounded-xl bg-slate-100 py-3">
                <Text className="text-center font-medium text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (noteProduct) {
                    const note = noteText.trim() || undefined;
                    if (ticketId) void addToTicket(noteProduct, note);
                    else addItem(noteProduct, note);
                    setNoteProduct(null);
                  }
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-3"
              >
                <Text className="text-center font-medium text-white">Add with note</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
