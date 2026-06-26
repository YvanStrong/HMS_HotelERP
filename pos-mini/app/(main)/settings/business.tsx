import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FormField } from '../../../src/components/FormField';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { ProductImagePicker } from '../../../src/components/ProductImagePicker';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';
import { persistBusinessLogo } from '../../../src/utils/businessLogo';

export default function BusinessSettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [businessName, setBusinessName] = useState('');
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!settings) return;
      setBusinessName(settings.businessName);
      setBusinessLogo(settings.businessLogo);
      setAddress(settings.address);
      setPhone(settings.phone);
      setEmail(settings.email);
    }, [settings]),
  );

  const save = async () => {
    if (!businessName.trim()) {
      Toast.show({ type: 'error', text1: 'Business name is required' });
      return;
    }
    try {
      let logoPath = businessLogo;
      if (businessLogo && !businessLogo.includes('/business/logo')) {
        logoPath = await persistBusinessLogo(businessLogo);
      }
      await updateSettings({
        businessName: businessName.trim(),
        businessLogo: logoPath,
        address,
        phone,
        email,
      });
      Toast.show({ type: 'success', text1: 'Settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Text className="mb-2 text-sm font-semibold text-app-text">Business logo</Text>
      <ProductImagePicker value={businessLogo} onChange={setBusinessLogo} />
      <FormField label="Business name" required value={businessName} onChangeText={setBusinessName} />
      <FormField label="Address" value={address} onChangeText={setAddress} />
      <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

      <Pressable onPress={() => void save()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Save settings</Text>
      </Pressable>
    </KeyboardFormScroll>
  );
}
