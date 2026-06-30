import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import {
  createModifierGroup,
  createModifierOption,
  listModifierGroups,
  listModifierOptions,
} from '../../../src/repositories/modifierRepository';
import { colors } from '../../../src/constants/theme';

export default function ModifiersSettingsScreen() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof listModifierGroups>>>([]);
  const [groupName, setGroupName] = useState('');
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('0');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof listModifierOptions>>>([]);

  const load = useCallback(async () => {
    setGroups(await listModifierGroups());
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const loadOptions = async (groupId: string) => {
    setActiveGroupId(groupId);
    setOptions(await listModifierOptions(groupId, false));
  };

  const addGroup = async () => {
    if (!groupName.trim()) {
      Toast.show({ type: 'error', text1: 'Group name required' });
      return;
    }
    await createModifierGroup({
      name: groupName.trim(),
      minSelect: 0,
      maxSelect: 1,
      required: false,
      sortOrder: groups.length,
      isActive: true,
    });
    setGroupName('');
    await load();
    Toast.show({ type: 'success', text1: 'Modifier group added' });
  };

  const addOption = async () => {
    if (!activeGroupId || !optionName.trim()) {
      Toast.show({ type: 'error', text1: 'Select a group and enter option name' });
      return;
    }
    await createModifierOption({
      groupId: activeGroupId,
      name: optionName.trim(),
      priceDelta: Number(optionPrice) || 0,
      sortOrder: options.length,
    });
    setOptionName('');
    setOptionPrice('0');
    await loadOptions(activeGroupId);
    Toast.show({ type: 'success', text1: 'Option added' });
  };

  return (
    <ScreenContainer scroll>
      <Text className="mb-4 text-sm text-app-muted">
        Create modifier groups (e.g. Size, Toppings) and assign them to products on the product edit screen.
      </Text>

      <Text className="mb-2 font-bold text-app-text">{t('settings.modifiers')}</Text>
      {groups.map((g) => (
        <Pressable
          key={g.id}
          onPress={() => void loadOptions(g.id)}
          className="mb-2 rounded-xl border border-app-border bg-app-surface p-3"
          style={{
            borderColor: activeGroupId === g.id ? colors.primary : colors.border,
            backgroundColor: activeGroupId === g.id ? colors.primarySoft : colors.surface,
          }}
        >
          <Text className="font-semibold text-app-text">{g.name}</Text>
          <Text className="text-sm text-app-muted">
            {g.required ? 'Required · ' : ''}Max {g.maxSelect}
          </Text>
        </Pressable>
      ))}

      <Text className="mb-2 mt-4 font-bold text-app-text">New group</Text>
      <TextInput
        value={groupName}
        onChangeText={setGroupName}
        placeholder="Group name"
        className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
      />
      <Pressable onPress={() => void addGroup()} className="rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Add group</Text>
      </Pressable>

      {activeGroupId ? (
        <View className="mt-6">
          <Text className="mb-2 font-bold text-app-text">Options</Text>
          {options.map((o) => (
            <View key={o.id} className="mb-2 rounded-xl border border-app-border bg-app-surface p-3">
              <Text className="font-semibold text-app-text">{o.name}</Text>
              <Text className="text-sm text-app-muted">+{o.priceDelta}</Text>
            </View>
          ))}
          <TextInput
            value={optionName}
            onChangeText={setOptionName}
            placeholder="Option name"
            className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
          />
          <TextInput
            value={optionPrice}
            onChangeText={setOptionPrice}
            placeholder="Price delta"
            keyboardType="decimal-pad"
            className="mb-2 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-app-text"
          />
          <Pressable onPress={() => void addOption()} className="rounded-xl py-3" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center font-semibold text-white">Add option</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
