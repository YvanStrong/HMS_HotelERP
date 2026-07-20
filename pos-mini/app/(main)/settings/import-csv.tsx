import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { createProduct } from '../../../src/repositories/productRepository';
import { parseProductsCsv } from '../../../src/utils/csvImport';
import { useThemeColors } from '../../../src/hooks/useTheme';

export default function ImportCsvScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [rows, setRows] = useState<ReturnType<typeof parseProductsCsv>['rows']>([]);
  const [importing, setImporting] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed = parseProductsCsv(content);
      setRows(parsed.rows);
      if (parsed.rows.length === 0) Toast.show({ type: 'error', text1: 'No product rows found' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed to read CSV' });
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0 && r.name);
  const invalidCount = rows.length - validRows.length;

  const runImport = async () => {
    if (validRows.length === 0) {
      Toast.show({ type: 'error', text1: 'No valid rows to import' });
      return;
    }
    setImporting(true);
    try {
      for (const row of validRows) {
        await createProduct({
          name: row.name,
          description: null,
          sku: row.sku,
          barcode: row.barcode,
          categoryId: null,
          costPrice: row.costPrice,
          sellPrice: row.sellPrice,
          stockQty: row.stockQty,
          minStock: 0,
          unit: row.unit,
          taxClass: 'A',
          isTaxable: false,
          taxRate: 0,
          taxInclusive: false,
          imageUri: null,
          expiryDate: null,
          batchLot: null,
          trackStock: true,
          isActive: true,
        });
      }
      Toast.show({ type: 'success', text1: `${validRows.length} products imported` });
      router.back();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text className="mb-3 text-sm text-app-muted">
        Expected columns: name, sku, barcode, cost, sell, stock, unit. Review rows before importing.
      </Text>

      <Pressable onPress={() => void pickFile()} className="mb-4 rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Choose CSV file</Text>
      </Pressable>

      {rows.length > 0 ? (
        <>
          <Text className="mb-2 font-semibold text-app-text">
            {validRows.length} valid · {invalidCount} skipped
          </Text>
          <ScrollView className="mb-4 max-h-96">
            {rows.map((row) => (
              <View
                key={row.rowNumber}
                className="mb-2 rounded-lg border p-3"
                style={{
                  borderColor: row.errors.length ? colors.danger : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Text className="font-semibold text-app-text">
                  Row {row.rowNumber}: {row.name || '(empty)'}
                </Text>
                <Text className="text-xs text-app-muted">
                  Sell {row.sellPrice} · Stock {row.stockQty} {row.unit}
                </Text>
                {row.errors.map((e) => (
                  <Text key={e} className="text-xs text-app-danger">
                    {e}
                  </Text>
                ))}
                {row.warnings.map((w) => (
                  <Text key={w} className="text-xs text-app-warning">
                    {w}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <Pressable
            disabled={importing || validRows.length === 0}
            onPress={() => void runImport()}
            className="mb-8 rounded-xl py-3"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-center font-semibold text-white">
              {importing ? 'Importing…' : `Import ${validRows.length} products`}
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScreenContainer>
  );
}
