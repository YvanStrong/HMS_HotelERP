import { ThemedStack } from '../../../src/navigation/ThemedStack';

export default function ProductsLayout() {
  return (
    <ThemedStack>
      <ThemedStack.Screen name="index" options={{ title: 'Products' }} />
      <ThemedStack.Screen name="new" options={{ title: 'Add Product' }} />
      <ThemedStack.Screen name="[productId]" options={{ title: 'Edit Product' }} />
      <ThemedStack.Screen name="categories" options={{ title: 'Categories' }} />
    </ThemedStack>
  );
}
