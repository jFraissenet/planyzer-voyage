import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useIsMobile } from "@/lib/responsive";
import { Text } from "./Text";
import { theme } from "@/lib/theme";

export type AvatarStackEntry = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Props = {
  participants: AvatarStackEntry[];
  maxMobile?: number;
  maxDesktop?: number;
  onPress?: () => void;
  className?: string;
};

const AVATAR_PX = 32;
const OVERLAP_PX = 14;
const REMAINDER_BG = "#4B5563";

const PALETTE = [
  "#F97316",
  "#8B5CF6",
  "#EAB308",
  "#EC4899",
  "#14B8A6",
  "#3B82F6",
  "#EF4444",
  "#22C55E",
  theme.primary,
  "#F59E0B",
];

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function StackBubble({ entry }: { entry: AvatarStackEntry }) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [entry.avatar_url]);

  const bg = colorFor(entry.id);
  const showImage = entry.avatar_url && !errored;

  return (
    <View
      className="rounded-full items-center justify-center overflow-hidden"
      style={{
        width: AVATAR_PX,
        height: AVATAR_PX,
        backgroundColor: bg,
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: entry.avatar_url! }}
          onError={() => setErrored(true)}
          style={{
            width: AVATAR_PX,
            height: AVATAR_PX,
          }}
        />
      ) : (
        <Text className="text-xs font-bold" style={{ color: "#FFFFFF" }}>
          {initialsOf(entry.full_name)}
        </Text>
      )}
    </View>
  );
}

export function AvatarStack({
  participants,
  maxMobile = 4,
  maxDesktop = 6,
  onPress,
  className = "",
}: Props) {
  const isMobile = useIsMobile();
  const max = isMobile ? maxMobile : maxDesktop;
  const visible = participants.slice(0, max);
  const remaining = participants.length - visible.length;

  const content = (
    <View className={`flex-row items-center ${className}`}>
      {visible.map((p, idx) => (
        <View
          key={p.id}
          className="rounded-full border-2 border-background"
          style={{
            marginLeft: idx === 0 ? 0 : -OVERLAP_PX,
            zIndex: idx + 1,
          }}
        >
          <StackBubble entry={p} />
        </View>
      ))}
      {remaining > 0 ? (
        <View
          className="rounded-full border-2 border-background items-center justify-center"
          style={{
            width: AVATAR_PX,
            height: AVATAR_PX,
            backgroundColor: REMAINDER_BG,
            marginLeft: visible.length === 0 ? 0 : -OVERLAP_PX,
            zIndex: visible.length + 1,
          }}
        >
          <Text className="text-xs font-bold" style={{ color: "#FFFFFF" }}>
            +{remaining}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-70">
        {content}
      </Pressable>
    );
  }
  return content;
}
