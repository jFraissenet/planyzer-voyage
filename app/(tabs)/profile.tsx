import { View } from "react-native";
import { Avatar, Button, Card, Separator, Text } from "@/components/ui";
import { useSession } from "@/lib/useSession";
import { signOut } from "@/lib/auth";

export default function ProfileScreen() {
  const { session } = useSession();
  const user = session?.user;
  const fullName = user?.user_metadata?.full_name;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <View className="items-center mb-8">
        <Avatar
          src={avatarUrl}
          initials={initials}
          size="lg"
          className="mb-3"
        />
        <Text variant="h2">{fullName ?? "Utilisateur"}</Text>
        <Text variant="caption">{user?.email}</Text>
      </View>

      <Card className="mb-6">
        <Text variant="label" className="mb-1">
          Email
        </Text>
        <Text>{user?.email}</Text>
        <Separator className="my-3" />
        <Text variant="label" className="mb-1">
          Connexion
        </Text>
        <Text className="capitalize">
          {user?.app_metadata?.provider ?? "email"}
        </Text>
      </Card>

      <Button
        label="Se déconnecter"
        variant="outline"
        onPress={() => signOut()}
      />
    </View>
  );
}
