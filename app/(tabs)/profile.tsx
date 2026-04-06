import { Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold mb-2">Profil</Text>
      <Text className="text-base text-gray-500">Connectez-vous pour commencer</Text>
    </View>
  );
}
