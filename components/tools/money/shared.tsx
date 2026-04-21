import { View } from "react-native";
import { Avatar, Text } from "@/components/ui";

export function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function firstName(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/)[0];
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-3 uppercase"
      style={{
        letterSpacing: 1.2,
        fontWeight: "700",
        fontSize: 11,
        color: "#6050DC",
      }}
    >
      {children}
    </Text>
  );
}

export function MemberRow({
  name,
  avatarUrl,
  children,
}: {
  name: string | null;
  avatarUrl: string | null;
  children?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center py-2">
      <Avatar
        src={avatarUrl ?? undefined}
        initials={initialsOf(name)}
        size="sm"
        className="mr-3"
      />
      <View className="flex-1 pr-2">
        <Text numberOfLines={1}>{name ?? "?"}</Text>
      </View>
      {children}
    </View>
  );
}
