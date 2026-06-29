import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { KeyboardAvoidingScreen } from '../../../src/components/KeyboardFormScroll';
import { CategoryBadge } from '../../../src/components/CategoryBadge';
import { EmptyState } from '../../../src/components/EmptyState';
import { createCategory, deleteCategory, listCategories } from '../../../src/repositories/categoryRepository';
import type { Category } from '../../../src/types';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    void listCategories().then(setCategories);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createCategory({ name: name.trim() });
      setName('');
      reload();
      Toast.show({ type: 'success', text1: 'Category added' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  const remove = async (id: string) => {
    await deleteCategory(id);
    reload();
  };

  return (
    <KeyboardAvoidingScreen>
      <View className="min-h-0 flex-1 px-4 pt-2">
        <View className="mb-3 flex-row gap-2">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="New category"
            className="flex-1 border-2 border-black bg-white px-3 py-3 text-black"
          />
          <Pressable onPress={() => void add()} className="border-2 border-black bg-app-primary px-4 justify-center">
            <Text className="font-bold text-white">Add</Text>
          </Pressable>
        </View>

        {categories.length === 0 ? (
          <EmptyState title="No categories" />
        ) : (
          <View className="min-h-0 flex-1">
            <FlashList
              data={categories}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
              <View className="mb-2 flex-row items-center justify-between border-2 border-black bg-white p-3">
                <CategoryBadge name={item.name} color={item.color} />
                <Pressable onPress={() => void remove(item.id)}>
                  <Text className="font-bold text-red-600">Delete</Text>
                </Pressable>
              </View>
            )}
          />
          </View>
        )}
      </View>
    </KeyboardAvoidingScreen>
  );
}
