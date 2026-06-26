import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import type { Sale, SaleItem } from '../types';
import { getReceiptDisplayPrefs } from '../repositories/metaRepository';
import { formatMoney } from '../utils/currency';
import { useAppStore } from '../store/appStore';
import { cardStyle } from '../constants/theme';

type Props = {
  sale: Sale;
  items: SaleItem[];
  barcodes?: Record<string, string | null>;
};

export function ReceiptView({ sale, items, barcodes = {} }: Props) {
  const settings = useAppStore((s) => s.settings);
  const [prefs, setPrefs] = useState({
    showLogo: true,
    showTax: true,
    showChange: true,
    showBarcode: false,
  });

  useEffect(() => {
    void getReceiptDisplayPrefs().then(setPrefs);
  }, []);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View className="p-4" style={cardStyle}>
        {prefs.showLogo && settings?.businessLogo ? (
          <Image
            source={{ uri: settings.businessLogo }}
            className="mb-2 h-14 w-full"
            resizeMode="contain"
          />
        ) : null}
        {settings?.receiptHeader ? (
          <Text className="mb-2 text-center text-sm text-app-muted">{settings.receiptHeader}</Text>
        ) : null}
        <Text className="text-center text-lg font-bold text-app-text">
          {settings?.businessName || 'POS Mini'}
        </Text>
        {settings?.address ? (
          <Text className="text-center text-sm text-app-muted">{settings.address}</Text>
        ) : null}
        <Text className="mt-3 text-sm text-app-text">Invoice: {sale.invoiceNumber}</Text>
        <Text className="text-sm text-app-muted">{new Date(sale.createdAt).toLocaleString()}</Text>
        {sale.notes?.trim() ? (
          <Text className="mt-1 text-sm text-app-muted">Note: {sale.notes}</Text>
        ) : null}
        <View className="my-3 border-t border-app-border" />
        {items.map((item) => (
          <View key={item.id} className="mb-2">
            <View className="flex-row justify-between">
              <Text className="flex-1 text-sm text-app-text">
                {item.productName} × {item.quantity}
              </Text>
              <Text className="text-sm font-bold text-app-text">
                {formatMoney(item.lineTotal, settings)}
              </Text>
            </View>
            {prefs.showBarcode && barcodes[item.productId] ? (
              <Text className="text-xs text-app-muted">{barcodes[item.productId]}</Text>
            ) : null}
          </View>
        ))}
        <View className="my-3 border-t border-app-border" />
        <View className="flex-row justify-between">
          <Text className="text-app-text">Subtotal</Text>
          <Text className="font-bold text-app-text">{formatMoney(sale.subtotal, settings)}</Text>
        </View>
        {sale.discountAmount > 0 ? (
          <View className="flex-row justify-between">
            <Text className="text-app-text">Discount</Text>
            <Text className="font-bold text-app-text">-{formatMoney(sale.discountAmount, settings)}</Text>
          </View>
        ) : null}
        {prefs.showTax && sale.taxAmount > 0 ? (
          <View className="flex-row justify-between">
            <Text className="text-app-text">{settings?.taxName || 'Tax'}</Text>
            <Text className="font-bold text-app-text">{formatMoney(sale.taxAmount, settings)}</Text>
          </View>
        ) : null}
        <View className="mt-2 flex-row justify-between">
          <Text className="text-lg font-bold text-app-text">Total</Text>
          <Text className="text-lg font-bold text-app-text">{formatMoney(sale.total, settings)}</Text>
        </View>
        <Text className="mt-2 text-sm text-app-muted">
          Paid: {formatMoney(sale.amountPaid, settings)} ({sale.paymentMethod})
        </Text>
        {prefs.showChange && sale.changeAmount > 0 ? (
          <Text className="text-sm text-app-muted">
            Change: {formatMoney(sale.changeAmount, settings)}
          </Text>
        ) : null}
        <Text className="mt-4 text-center text-sm text-app-muted">
          {settings?.receiptFooter || 'Thank you!'}
        </Text>
      </View>
    </ScrollView>
  );
}
