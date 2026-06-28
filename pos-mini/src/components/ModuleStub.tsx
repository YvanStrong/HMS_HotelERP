import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Link = { label: string; href: Href };

type Props = {
  title: string;
  description: string;
  links?: Link[];
};

export function ModuleStub({ title, description, links = [] }: Props) {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={['bottom']}>
      <View className="flex-1 px-4 pt-4">
        <View className="mb-6 border-2 border-black bg-white p-5">
          <Text className="text-xl font-bold text-black">{title}</Text>
          <Text className="mt-2 text-gray-600">{description}</Text>
          <Text className="mt-3 text-sm font-bold text-accent">Coming in Phase C+</Text>
        </View>

        {links.map((link) => (
          <Pressable
            key={String(link.href)}
            onPress={() => router.push(link.href)}
            className="mb-2 flex-row items-center justify-between border-2 border-black bg-white p-4"
          >
            <Text className="font-bold text-black">{link.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#000" />
          </Pressable>
        ))}

        <Pressable onPress={() => router.back()} className="mt-4 border-2 border-black bg-app-primary py-3">
          <Text className="text-center font-bold text-white">Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
