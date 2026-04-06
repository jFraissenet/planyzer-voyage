import { Text, View } from "react-native";

export default function TripsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold mb-2">Mes voyages</Text>
      <Text className="text-base text-gray-500">Aucun voyage pour le moment</Text>
    </View>
  );
}
