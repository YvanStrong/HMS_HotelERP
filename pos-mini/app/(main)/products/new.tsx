import { useCallback, useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { BarcodeScannerModal } from '../../../src/components/BarcodeScannerModal';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { ProductImagePicker } from '../../../src/components/ProductImagePicker';
import { OptionPicker } from '../../../src/components/OptionPicker';
import { UnitPicker } from '../../../src/components/UnitPicker';
import { listCategories } from '../../../src/repositories/categoryRepository';
import { createProduct, updateProduct } from '../../../src/repositories/productRepository';
import type { Category } from '../../../src/types';
import type { ProductTaxClass } from '../../../src/constants/productTax';
import { PRODUCT_TAX_OPTIONS } from '../../../src/constants/productTax';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';
import { generateSkuFromName } from '../../../src/utils/barcode';
import { formatMoney } from '../../../src/utils/currency';
import { persistProductImage } from '../../../src/utils/productImage';

export default function NewProductScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [skuTouched, setSkuTouched] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [costPrice, setCostPrice] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [stockQty, setStockQty] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [taxClass, setTaxClass] = useState<ProductTaxClass>('A');
  const [trackStock, setTrackStock] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [batchLot, setBatchLot] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const margin = useMemo(() => {
    const cost = Number(costPrice) || 0;
    const sell = Number(sellPrice) || 0;
    if (sell <= 0) return { pct: 0, amount: 0 };
    return { pct: ((sell - cost) / sell) * 100, amount: sell - cost };
  }, [costPrice, sellPrice]);

  const onNameChange = (value: string) => {
    setName(value);
    if (!skuTouched) {
      setSku(value.trim() ? generateSkuFromName(value) : '');
    }
  };

  useFocusEffect(
    useCallback(() => {
      void listCategories().then(setCategories);
    }, []),
  );

  const save = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name is required' });
      return;
    }
    try {
      const product = await createProduct({
        name: name.trim(),
        description: description.trim() || null,
        sku: sku || generateSkuFromName(name),
        barcode: barcode || null,
        categoryId,
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        stockQty: trackStock ? Number(stockQty) || 0 : 0,
        minStock: trackStock ? Number(minStock) || 0 : 0,
        unit,
        taxClass,
        isTaxable: taxClass === 'B',
        taxRate: taxClass === 'B' ? 18 : 0,
        taxInclusive: false,
        imageUri: null,
        expiryDate: expiryDate.trim() || null,
        batchLot: batchLot.trim() || null,
        trackStock,
        isActive: true,
      });

      if (imageUri) {
        const savedImage = await persistProductImage(imageUri, product.id);
        await updateProduct(product.id, { imageUri: savedImage });
      }

      Toast.show({ type: 'success', text1: 'Product created' });
      router.replace(`/(main)/products/${product.id}`);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <>
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <ProductImagePicker value={imageUri} onChange={setImageUri} />
        <FormField label="Product name" required value={name} onChangeText={onNameChange} placeholder="e.g. Espresso" />
        <FormField label="Description" value={description} onChangeText={setDescription} multiline />
        <FormField
          label="SKU"
          value={sku}
          onChangeText={(v) => {
            setSkuTouched(true);
            setSku(v);
          }}
          placeholder="Generated from product name"
          hint="Auto-updates as you type the name — edit anytime"
        />
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
        <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
          <Text className="font-semibold text-app-text">Track stock</Text>
          <Switch value={trackStock} onValueChange={setTrackStock} />
        </View>
        {trackStock ? (
          <>
            <FormField label="Stock quantity" value={stockQty} onChangeText={setStockQty} keyboardType="decimal-pad" />
            <FormField label="Minimum stock alert" value={minStock} onChangeText={setMinStock} keyboardType="decimal-pad" />
          </>
        ) : null}
        <UnitPicker value={unit} onChange={setUnit} />
        <OptionPicker
          label="Tax category"
          options={PRODUCT_TAX_OPTIONS}
          value={taxClass}
          onChange={(v) => setTaxClass(v as ProductTaxClass)}
        />
        <FormField label="Expiry date" value={expiryDate} onChangeText={setExpiryDate} placeholder="YYYY-MM-DD (optional)" />
        <FormField label="Batch / lot" value={batchLot} onChangeText={setBatchLot} placeholder="Optional" />
        <Text className="mb-2 text-sm text-app-muted">Add variants after saving the product.</Text>
        <Pressable
          onPress={() => void save()}
          className="mb-8 rounded-xl py-4"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-center text-base font-semibold text-white">Save product</Text>
        </Pressable>
      </KeyboardFormScroll>
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={(code) => setBarcode(code)}
      />
    </>
  );
}
