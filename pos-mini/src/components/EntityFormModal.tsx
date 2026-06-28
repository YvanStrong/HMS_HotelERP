import { Modal, Pressable, ScrollView, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { FormField } from './FormField';
import { colors } from '../constants/theme';

export type EntityFormValues = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type Props = {
  visible: boolean;
  title: string;
  values: EntityFormValues;
  onChange: (values: EntityFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
};

export function EntityFormModal({
  visible,
  title,
  values,
  onChange,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: Props) {
  const set = (key: keyof EntityFormValues, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="max-h-[90%] rounded-t-2xl border-t border-app-border bg-app-surface p-4">
          <Text className="mb-4 text-xl font-bold text-app-text">{title}</Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <FormField
              label="Name"
              required
              value={values.name}
              onChangeText={(v) => set('name', v)}
              placeholder="Full name"
            />
            <FormField
              label="Phone"
              value={values.phone}
              onChangeText={(v) => set('phone', v)}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
            <FormField
              label="Email"
              value={values.email}
              onChangeText={(v) => set('email', v)}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              label="Address"
              value={values.address}
              onChangeText={(v) => set('address', v)}
              placeholder="Street, city"
            />
            <FormField
              label="Notes"
              value={values.notes}
              onChangeText={(v) => set('notes', v)}
              placeholder="Optional notes"
              multiline
            />
          </ScrollView>
          <View className="mt-4 flex-row gap-3">
            <Pressable onPress={onCancel} className="flex-1 rounded-xl border border-app-border py-3">
              <Text className="text-center font-semibold text-app-text">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              className="flex-1 rounded-xl py-3"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-center font-semibold text-white">{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
