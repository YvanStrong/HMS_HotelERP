import { useCallback, useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { ProductImagePicker } from '../../../src/components/ProductImagePicker';
import { listCategories } from '../../../src/repositories/categoryRepository';
import { deleteProduct, getProductById, updateProduct } from '../../../src/repositories/productRepository';
import type { Category, Product } from '../../../src/types';
import { formatMoney } from '../../../src/utils/currency';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';
import { persistProductImage } from '../../../src/utils/productImage';

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [costPrice, setCostPrice] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [stockQty, setStockQty] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [trackStock, setTrackStock] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const margin = useMemo(() => {
    const cost = Number(costPrice) || 0;
    const sell = Number(sellPrice) || 0;
    if (sell <= 0) return { pct: 0, amount: 0 };
    return { pct: ((sell - cost) / sell) * 100, amount: sell - cost };
  }, [costPrice, sellPrice]);

  useFocusEffect(
    useCallback(() => {
      if (!productId) return;
      void Promise.all([getProductById(productId), listCategories()]).then(([p, cats]) => {
        if (p) {
          setProduct(p);
          setName(p.name);
          setDescription(p.description ?? '');
          setSku(p.sku ?? '');
          setBarcode(p.barcode ?? '');
          setCategoryId(p.categoryId);
          setCostPrice(String(p.costPrice));
          setSellPrice(String(p.sellPrice));
          setStockQty(String(p.stockQty));
          setMinStock(String(p.minStock));
          setUnit(p.unit);
          setTrackStock(p.trackStock);
          setImageUri(p.imageUri);
        }
        setCategories(cats);
      });
    }, [productId]),
  );

  const save = async () => {
    if (!productId || !name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    try {
      let savedImage = imageUri;
      if (imageUri && product && imageUri !== product.imageUri) {
        savedImage = await persistProductImage(imageUri, productId);
      }
      await updateProduct(productId, {
        name: name.trim(),
        description: description.trim() || null,
        sku: sku || null,
        barcode: barcode || null,
        categoryId,
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        stockQty: Number(stockQty) || 0,
        minStock: Number(minStock) || 0,
        unit,
        trackStock,
        imageUri: savedImage,
      });
      Toast.show({ type: 'success', text1: 'Product updated' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Update failed' });
    }
  };

  const remove = async () => {
    if (!productId) return;
    await deleteProduct(productId);
    setConfirmDelete(false);
    router.back();
  };

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-app-bg">
        <Text className="text-app-text">Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <ProductImagePicker value={imageUri} onChange={setImageUri} />
        <FormField label="Product name" required value={name} onChangeText={setName} />
        <FormField label="Description" value={description} onChangeText={setDescription} multiline />
        <FormField label="SKU" value={sku} onChangeText={setSku} />
        <View className="mb-4 flex-row items-end gap-2">
          <View className="flex-1">
            <FormField label="Barcode" value={barcode} onChangeText={setBarcode} placeholder="Scan or type" />
          </View>
          <Pressable
            onPress={() => setShowScanner(true)}
            className="mb-1 rounded-xl border border-app-border bg-app-surface px-4 py-3"
          >
            <Text className="font-semibold text-app-text">Scan</Text>
          </Pressable>
        </View>
        <Text className="mb-2 text-sm font-semibold text-app-text">Category</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              className="rounded-lg border px-3 py-2"
              style={{
                borderColor: categoryId === c.id ? colors.primary : colors.border,
                backgroundColor: categoryId === c.id ? colors.primarySoft : colors.surface,
              }}
            >
              <Text className="font-medium text-app-text">{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <FormField label="Cost price" value={costPrice} onChangeText={setCostPrice} keyboardType="decimal-pad" />
        <FormField label="Sell price" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" />
        <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-3">
          <Text className="text-sm text-app-muted">
            Profit margin: {margin.pct.toFixed(1)}% ({formatMoney(margin.amount, settings)} per unit)
          </Text>
        </View>
        <FormField label="Stock quantity" value={stockQty} onChangeText={setStockQty} keyboardType="decimal-pad" />
        <FormField label="Minimum stock alert" value={minStock} onChangeText={setMinStock} keyboardType="decimal-pad" />
        <FormField label="Unit" value={unit} onChangeText={setUnit} placeholder="pcs, kg, L…" />
        <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
          <Text className="font-semibold text-app-text">Track stock</Text>
          <Switch value={trackStock} onValueChange={setTrackStock} />
        </View>
        <Pressable
          onPress={() => void save()}
          className="rounded-xl py-4"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center font-semibold text-white">Save changes</Text>
        </Pressable>
        <Pressable
          onPress={() => setConfirmDelete(true)}
          className="mt-3 mb-8 rounded-xl border border-app-border bg-app-surface py-3"
        >
          <Text className="text-center font-semibold text-app-danger">Deactivate product</Text>
        </Pressable>
      </KeyboardFormScroll>
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={(code) => setBarcode(code)}
      />
      <ConfirmModal
        visible={confirmDelete}
        title="Deactivate product?"
        message="This product will be hidden from sales."
        confirmLabel="Deactivate"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
        destructive
      />
    </>
  );
}
