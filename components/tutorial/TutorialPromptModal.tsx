import { Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "@/components/ui";
import { useTutorial } from "@/lib/tutorials/TutorialContext";
import { markTutorialSeen } from "@/lib/tutorials/api";
import { SCENARIOS } from "@/lib/tutorials/registry";
import { theme } from "@/lib/theme";

const SCENARIO_TITLES: Record<string, { title: string; subtitle: string; emoji: string }> = {
  birthday: {
    emoji: "🎂",
    title: "Anniversaire entre amis",
    subtitle: "Lieu, apéro, dépenses — un tour complet en 1 minute.",
  },
  wedding: {
    emoji: "💍",
    title: "Mariage",
    subtitle: "Planning, invités, repas… (à venir)",
  },
  ski: {
    emoji: "⛷️",
    title: "Weekend ski",
    subtitle: "Covoiturage, équipes, comptes… (à venir)",
  },
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TutorialPromptModal({ visible, onClose }: Props) {
  const { start } = useTutorial();

  const skip = async () => {
    try {
      await markTutorialSeen();
    } catch {
      // ignore
    }
    onClose();
  };

  const pick = async (scenarioId: string) => {
    onClose();
    try {
      await markTutorialSeen();
    } catch {
      // ignore
    }
    await start(scenarioId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={skip}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-4"
        onPress={skip}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-background rounded-2xl"
          style={{ padding: 20, maxHeight: "90%" }}
        >
          <View
            className="flex-row items-center justify-between mb-2"
            style={{ gap: 12 }}
          >
            <Text variant="h2" style={{ flex: 1 }}>
              Bienvenue sur Planyzer 👋
            </Text>
            <Pressable
              onPress={skip}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{ width: 30, height: 30, backgroundColor: "#F3F4F6" }}
            >
              <Ionicons name="close" size={14} color="#6B7280" />
            </Pressable>
          </View>
          <Text variant="caption" className="mb-4">
            On te montre l'app en 1 minute ? Choisis un scénario :
          </Text>

          <ScrollView style={{ maxHeight: 400 }}>
            {SCENARIOS.map((s) => {
              const meta = SCENARIO_TITLES[s.id];
              if (!meta) return null;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => (s.comingSoon ? null : pick(s.id))}
                  disabled={s.comingSoon}
                  className="flex-row items-start p-3 mb-2 rounded-xl active:opacity-70"
                  style={{
                    backgroundColor: s.comingSoon ? "#F3F4F6" : theme.primarySoft,
                    borderWidth: 1,
                    borderColor: s.comingSoon ? "#E5E7EB" : theme.primary,
                    opacity: s.comingSoon ? 0.55 : 1,
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: s.comingSoon ? "#6B7280" : theme.primaryDeep,
                      }}
                    >
                      {meta.title}
                    </Text>
                    <Text
                      variant="caption"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {meta.subtitle}
                    </Text>
                  </View>
                  {!s.comingSoon ? (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={theme.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={skip}
            className="items-center justify-center py-3 mt-2 active:opacity-70"
          >
            <Text
              variant="label"
              style={{ color: "#6B7280", fontWeight: "600" }}
            >
              Pas maintenant
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
