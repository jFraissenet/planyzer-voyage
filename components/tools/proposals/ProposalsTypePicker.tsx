import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { MODES, type ProposalMode } from "@/lib/proposals/modes";

type Props = {
  onPick: (mode: ProposalMode) => void;
};

export function ProposalsTypePicker({ onPick }: Props) {
  const { t } = useTranslation();
  return (
    <View className="py-4" style={{ gap: 12 }}>
      <Text variant="caption" className="text-center mb-2" style={{ fontSize: 13 }}>
        {t("proposals.typePicker.intro")}
      </Text>
      {MODES.map((mode) => (
        <Pressable
          key={mode.id}
          onPress={() => onPick(mode.id)}
          className="active:opacity-80 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E8E3DB",
          }}
        >
          <View
            className="flex-row items-center p-4"
            style={{ gap: 14 }}
          >
            <View
              className="rounded-2xl items-center justify-center"
              style={{
                width: 52,
                height: 52,
                backgroundColor: mode.color + "22",
              }}
            >
              <Ionicons name={mode.icon} size={26} color={mode.color} />
            </View>
            <View className="flex-1">
              <Text
                style={{
                  color: "#1A1A1A",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                {t(mode.question)}
              </Text>
              <Text
                variant="caption"
                style={{ fontSize: 12, marginTop: 2 }}
                numberOfLines={2}
              >
                {t(mode.subtitle)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
