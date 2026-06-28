import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { fetchMenuForDepot, groupProductsByCategory } from "../../../src/api/menu";
import { fetchTicket } from "../../../src/api/tickets";
import { HOLD_COURSES, parseGuestRestrictions, type HoldCourse } from "../../../src/lib/allergens";
import { useTranslation } from "react-i18next";
import { fetchActiveAnnouncements, markAnnouncementRead } from "../../../src/api/announcements";
import { AnnouncementBannerStack } from "../../../src/components/AnnouncementBannerStack";
import { patchDepotProductPhoto } from "../../../src/api/inventory";
import { addLinesAction } from "../../../src/api/posActions";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { ProductPhoto } from "../../../src/components/ProductPhoto";
import { ScreenHeaderActions } from "../../../src/components/ScreenHeaderActions";
import { SearchBar, useDebouncedValue } from "../../../src/components/SearchBar";
import { productPrice } from "../../../src/api/menu";
import { menuCategoryLabel } from "../../../src/lib/stockHelpers";
import {
  FAVORITES_TAB,
  isFavorite,
  loadFavorites,
  toggleFavorite,
} from "../../../src/storage/favorites";
import type { CartLine, DepotProduct } from "../../../src/types";
import { useAuthStore } from "../../../src/store/authStore";
import { useCartStore } from "../../../src/store/cartStore";
import { useHeaderPadding } from "../../../src/hooks/useScreenInsets";

const MANAGER_ROLES = new Set(["HOTEL_ADMIN", "MANAGER", "SUPER_ADMIN"]);

export default function MenuScreen() {
  const { t } = useTranslation();
  const { depotId } = useLocalSearchParams<{ depotId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hotelId = useAuthStore((s) => s.user?.hotelId) ?? "";
  const userId = useAuthStore((s) => s.user?.id) ?? "";
  const headerPad = useHeaderPadding();
  const lowStockThreshold = useAuthStore((s) => s.posLowStockThreshold);
  const userRole = useAuthStore((s) => s.user?.role?.toUpperCase() ?? "");
  const canCaptureImage = MANAGER_ROLES.has(userRole);
  const depot = useCartStore((s) => s.selectedDepot);
  const tableLabel = useCartStore((s) => s.tableLabel);
  const addItem = useCartStore((s) => s.addItem);
  const ticketId = useCartStore((s) => s.ticketId);
  const itemCount = useCartStore((s) => s.itemCount());
  const total = useCartStore((s) => s.total());

  const [category, setCategory] = useState<string>(FAVORITES_TAB);
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, 200);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [noteProduct, setNoteProduct] = useState<DepotProduct | null>(null);
  const [noteText, setNoteText] = useState("");
  const [holdEnabled, setHoldEnabled] = useState(false);
  const [holdCourse, setHoldCourse] = useState<HoldCourse | "">("");
  const [previewProduct, setPreviewProduct] = useState<DepotProduct | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [actionProduct, setActionProduct] = useState<DepotProduct | null>(null);

  const resolvedDepotId = String(depotId ?? depot?.id ?? "");

  useEffect(() => {
    if (userId && resolvedDepotId) {
      setFavoriteIds(loadFavorites(userId, resolvedDepotId));
    }
  }, [userId, resolvedDepotId]);

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["menu", hotelId, resolvedDepotId],
    queryFn: () => fetchMenuForDepot(hotelId, resolvedDepotId),
    enabled: !!hotelId && !!resolvedDepotId,
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (hotelId && resolvedDepotId) {
        void refetch();
      }
    }, [hotelId, resolvedDepotId, refetch]),
  );

  const { data: linkedTicket } = useQuery({
    queryKey: ["pos-ticket-menu", hotelId, ticketId],
    queryFn: () => fetchTicket(hotelId, ticketId!),
    enabled: !!hotelId && !!ticketId,
  });
  const guestRestrictions = parseGuestRestrictions(linkedTicket?.dietaryNotes);

  const { data: announcements = [], refetch: refetchAnnouncements } = useQuery({
    queryKey: ["announcements", hotelId, resolvedDepotId],
    queryFn: () => fetchActiveAnnouncements(hotelId, resolvedDepotId),
    enabled: !!hotelId && !!resolvedDepotId,
    refetchInterval: 60_000,
  });

  async function dismissAnnouncement(id: string) {
    try {
      await markAnnouncementRead(hotelId, id);
      await refetchAnnouncements();
    } catch {
      Toast.show({ type: "error", text1: "Could not dismiss announcement" });
    }
  }

  const grouped = useMemo(() => groupProductsByCategory(products), [products]);
  const categories = useMemo(
    () => [FAVORITES_TAB, "All", ...Object.keys(grouped).sort()],
    [grouped],
  );

  const isSearching = debouncedSearch.trim().length > 0;

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => {
      const name = p.productName.toLowerCase();
      const cat = menuCategoryLabel(p).toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [products, debouncedSearch]);

  const visible = useMemo(() => {
    if (isSearching) return searchResults;
    if (category === FAVORITES_TAB) {
      const favSet = new Set(favoriteIds);
      return products.filter((p) => favSet.has(p.id));
    }
    if (category === "All") return products;
    return grouped[category] ?? [];
  }, [isSearching, searchResults, category, favoriteIds, products, grouped]);

  const handleToggleFavorite = useCallback(
    (productId: string) => {
      if (!userId || !resolvedDepotId) return;
      const result = toggleFavorite(userId, resolvedDepotId, productId);
      if (!result.added && !favoriteIds.includes(productId) && favoriteIds.length >= 12) {
        Toast.show({ type: "info", text1: "Favorites full", text2: "Maximum 12 items per outlet" });
        return;
      }
      setFavoriteIds(result.favorites);
      Toast.show({
        type: "success",
        text1: result.added ? "Added to favorites" : "Removed from favorites",
        visibilityTime: 1200,
      });
    },
    [userId, resolvedDepotId, favoriteIds],
  );

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
      { text: "Take photo", onPress: () => void pickProductPhoto(product, "camera") },
      { text: "Choose from gallery", onPress: () => void pickProductPhoto(product, "library") },
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
      await queryClient.invalidateQueries({ queryKey: ["menu", hotelId, resolvedDepotId] });
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

  async function addToTicket(
    product: DepotProduct,
    note?: string,
    hold?: { isHeld?: boolean; holdCourse?: HoldCourse },
  ) {
    if (!ticketId || !hotelId) {
      addItem(product, note, hold);
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
      isHeld: hold?.isHeld,
      holdCourse: hold?.holdCourse,
      allergens: product.allergens,
      dietaryFlags: product.dietaryFlags,
    };
    try {
      await addLinesAction(hotelId, ticketId, [line]);
      Toast.show({ type: "success", text1: "Added to ticket", text2: product.productName, visibilityTime: 1200 });
    } catch {
      addItem(product, note);
      Toast.show({ type: "info", text1: "Added to cart", text2: "Will sync when online" });
    }
  }

  function renderProductCard(product: DepotProduct) {
    const favorited = favoriteIds.includes(product.id);
    return (
      <MenuItemCard
        key={product.id}
        product={product}
        lowStockThreshold={lowStockThreshold}
        isFavorited={favorited}
        onToggleFavorite={() => handleToggleFavorite(product.id)}
        searchQuery={isSearching ? debouncedSearch : ""}
        showCategoryLabel={isSearching}
        guestRestrictions={guestRestrictions}
        canCaptureImage={canCaptureImage}
        onPreviewImage={() => setPreviewProduct(product)}
        onCaptureImage={() => void captureProductPhoto(product)}
        onAdd={() => {
          if (ticketId) void addToTicket(product);
          else {
            addItem(product);
            Toast.show({ type: "success", text1: "Added", text2: product.productName, visibilityTime: 1200 });
          }
        }}
        onLongPress={() => setActionProduct(product)}
      />
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="border-b border-slate-200 bg-white px-4 pb-3" style={{ paddingTop: headerPad }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900">{depot?.name ?? "Menu"}</Text>
            <Text className="text-sm text-indigo-600">{tableLabel ?? "No table selected"}</Text>
          </View>
          <ScreenHeaderActions />
        </View>
        <SearchBar value={searchText} onChangeText={setSearchText} />
        <AnnouncementBannerStack items={announcements} onDismiss={(id) => void dismissAnnouncement(id)} />
      </View>

      {!isSearching ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-12 border-b border-slate-200 bg-white px-2">
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              className={`mx-1 my-2 rounded-full px-4 py-2 ${category === cat ? "bg-indigo-600" : "bg-slate-100"}`}
            >
              <Text className={`text-sm font-medium ${category === cat ? "text-white" : "text-slate-600"}`}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {isError ? (
        <Pressable onPress={() => void refetch()} className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-slate-600">{t("menuLoadError")}</Text>
          <Text className="mt-2 font-semibold text-indigo-600">{t("retry")}</Text>
        </Pressable>
      ) : isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#4f46e5" />
        </View>
      ) : visible.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-slate-500">
            {isSearching
              ? `No results for '${debouncedSearch.trim()}'`
              : category === FAVORITES_TAB
                ? "No favorites yet. Long-press any item to add it here."
                : "No items in this category."}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-3 py-3"
          contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}
        >
          {visible.map((product) => renderProductCard(product))}
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
              <ProductPhoto photoUrl={previewProduct.photoUrl} contentFit="contain" height={288} />
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
              className="mb-3 rounded-xl border border-slate-200 px-3 py-3"
            />
            <Pressable
              onPress={() => setHoldEnabled((v) => !v)}
              className="mb-2 flex-row items-center gap-2"
            >
              <View className={`h-5 w-5 rounded border ${holdEnabled ? "bg-indigo-600" : "bg-white"}`} />
              <Text>{t("holdFireLater")}</Text>
            </Pressable>
            {holdEnabled ? (
              <View className="mb-3 flex-row flex-wrap gap-2">
                {HOLD_COURSES.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setHoldCourse(c.id)}
                    className={`rounded-lg px-3 py-2 ${holdCourse === c.id ? "bg-indigo-600" : "bg-slate-100"}`}
                  >
                    <Text className={holdCourse === c.id ? "text-white" : "text-slate-700"}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <Pressable onPress={() => setNoteProduct(null)} className="flex-1 rounded-xl bg-slate-100 py-3">
                <Text className="text-center font-medium text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (noteProduct) {
                    const note = noteText.trim() || undefined;
                    const hold = holdEnabled
                      ? { isHeld: true, holdCourse: holdCourse || undefined }
                      : undefined;
                    if (ticketId) void addToTicket(noteProduct, note, hold);
                    else addItem(noteProduct, note, hold);
                    setNoteProduct(null);
                    setHoldEnabled(false);
                    setHoldCourse("");
                  }
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-3"
              >
                <Text className="text-center font-medium text-white">{t("addWithNote")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!actionProduct} transparent animationType="fade" onRequestClose={() => setActionProduct(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setActionProduct(null)}>
          <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <Text className="mb-3 text-center text-sm font-semibold text-slate-500">
              {actionProduct?.productName}
            </Text>
            {actionProduct && userId && resolvedDepotId ? (
              <>
                <Pressable
                  onPress={() => {
                    handleToggleFavorite(actionProduct.id);
                    setActionProduct(null);
                  }}
                  className="border-b border-slate-100 py-4"
                >
                  <Text className="text-center text-base text-slate-900">
                    {isFavorite(userId, resolvedDepotId, actionProduct.id)
                      ? "★ Remove from Favorites"
                      : "⭐ Add to Favorites"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setNoteProduct(actionProduct);
                    setNoteText("");
                    setHoldEnabled(false);
                    setHoldCourse("");
                    setActionProduct(null);
                  }}
                  className="py-4"
                >
                  <Text className="text-center text-base text-slate-900">📝 {t("addWithNotes")}</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => setActionProduct(null)} className="mt-2 py-3">
              <Text className="text-center font-medium text-slate-500">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
