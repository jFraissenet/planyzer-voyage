import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Text } from "@/components/ui";
import {
  formatQuantity,
  saveEventToolRecipeToCatalogue,
  totalTimeMinutes,
  type MealRecipe,
} from "@/lib/meals";
import { theme } from "@/lib/theme";

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

function firstName(full: string | null): string {
  if (!full) return "?";
  return full.trim().split(/\s+/)[0];
}

type Props = {
  visible: boolean;
  recipe: MealRecipe | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
};

export function RecipeDetailModal({
  visible,
  recipe,
  canEdit,
  onClose,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  if (!recipe) return null;

  const handleSaveToCatalogue = async () => {
    if (saving) return;
    setSaving(true);
    setSavedMessage(null);
    try {
      await saveEventToolRecipeToCatalogue(recipe.recipe_id);
      setSavedMessage(t("meals.saveToCatalogueDone"));
      // Auto-clear the success message after a few seconds so it doesn't
      // linger forever in the modal.
      setTimeout(() => setSavedMessage(null), 3500);
    } catch {
      // Surface a generic error via the same slot — keeps the surface small.
      setSavedMessage(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-4"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-2xl bg-background rounded-2xl overflow-hidden"
          style={{ maxHeight: "92%" }}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            <View
              className="flex-row items-start justify-between mb-2"
              style={{ gap: 8 }}
            >
              <Text
                className="flex-1"
                style={{ fontSize: 20, fontWeight: "700", color: "#1A1A1A" }}
              >
                {recipe.title}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                className="rounded-full items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons name="close" size={16} color="#6B7280" />
              </Pressable>
            </View>

            <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
              <Avatar
                src={recipe.author_avatar_url ?? undefined}
                initials={initialsOf(recipe.author_full_name)}
                size="xs"
              />
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t("meals.byAuthor", { name: firstName(recipe.author_full_name) })}
              </Text>
            </View>

            {recipe.description ? (
              <Text
                className="mb-3"
                style={{ color: "#3A3A3A", fontSize: 14, lineHeight: 20 }}
              >
                {recipe.description}
              </Text>
            ) : null}

            <View className="flex-row flex-wrap mb-4" style={{ gap: 6 }}>
              {recipe.time_prep_minutes != null ? (
                <Chip
                  icon="hand-left-outline"
                  label={t("meals.timeTotalLabel", { count: recipe.time_prep_minutes })}
                />
              ) : null}
              {recipe.time_cook_minutes != null ? (
                <Chip
                  icon="flame-outline"
                  label={t("meals.timeTotalLabel", { count: recipe.time_cook_minutes })}
                />
              ) : null}
              {recipe.time_rest_minutes != null ? (
                <Chip
                  icon="hourglass-outline"
                  label={t("meals.timeTotalLabel", { count: recipe.time_rest_minutes })}
                />
              ) : null}
              {/* Total chip only when at least two legs are present —
                  otherwise it's just a duplicate of the single leg. */}
              {totalTimeMinutes(recipe) != null &&
              Number(recipe.time_prep_minutes != null) +
                Number(recipe.time_cook_minutes != null) +
                Number(recipe.time_rest_minutes != null) >=
                2 ? (
                <Chip
                  icon="time-outline"
                  label={`${t("meals.timeTotalShort")} · ${t("meals.timeTotalLabel", { count: totalTimeMinutes(recipe) })}`}
                />
              ) : null}
              <Chip icon="people-outline" label={`${recipe.servings}`} />
              {recipe.calories != null ? (
                <Chip icon="bonfire-outline" label={`${recipe.calories} kcal`} />
              ) : null}
            </View>

            {/* Ingredients */}
            <SectionLabel>{t("meals.ingredientsSection")}</SectionLabel>
            <View
              className="rounded-xl mb-4"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E8E3DB",
              }}
            >
              {recipe.ingredients.length === 0 ? (
                <Text
                  variant="caption"
                  style={{ padding: 12, fontSize: 12 }}
                >
                  {t("meals.ingredientsEmpty")}
                </Text>
              ) : (
                recipe.ingredients.map((i, idx) => (
                  <View
                    key={i.id}
                    className="flex-row items-center px-3 py-2"
                    style={{
                      gap: 8,
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: "#F2EDE4",
                    }}
                  >
                    <Ionicons
                      name={i.catalog_id ? "leaf" : "create-outline"}
                      size={14}
                      color={i.catalog_id ? theme.primary : "#9CA3AF"}
                    />
                    <Text
                      style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
                    >
                      {i.catalog_name ?? i.custom_name ?? "?"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#6B6B6B",
                        fontWeight: "600",
                      }}
                    >
                      {formatQuantity(i.quantity * recipe.servings)}{" "}
                      {t(`meals.units.${i.unit}`)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Steps */}
            {recipe.steps.length > 0 ? (
              <>
                <SectionLabel>{t("meals.stepsSection")}</SectionLabel>
                <View style={{ gap: 10 }}>
                  {recipe.steps.map((s, idx) => (
                    <View
                      key={s.id}
                      className="flex-row items-start"
                      style={{ gap: 8 }}
                    >
                      <View
                        className="rounded-full items-center justify-center"
                        style={{
                          width: 22,
                          height: 22,
                          backgroundColor: theme.primarySoft,
                          marginTop: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: theme.primaryDeep,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: "#1A1A1A",
                          lineHeight: 20,
                        }}
                      >
                        {s.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View className="mt-5" style={{ gap: 8 }}>
              {canEdit ? (
                <Pressable
                  onPress={onEdit}
                  className="items-center justify-center py-2.5 rounded-lg"
                  style={{ backgroundColor: theme.primarySoft }}
                >
                  <Text
                    style={{
                      color: theme.primary,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {t("meals.editTitle")}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={saving ? undefined : handleSaveToCatalogue}
                disabled={saving}
                className="flex-row items-center justify-center py-2.5 rounded-lg active:opacity-70"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E8E3DB",
                  gap: 6,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="bookmark-outline" size={14} color={theme.primary} />
                )}
                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {saving
                    ? t("meals.savingToCatalogue")
                    : t("meals.saveToCatalogue")}
                </Text>
              </Pressable>

              {savedMessage ? (
                <Text
                  variant="caption"
                  className="text-center"
                  style={{ color: theme.primary, fontSize: 12 }}
                >
                  {savedMessage}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="caption"
      className="mb-2 uppercase"
      style={{
        letterSpacing: 1,
        fontWeight: "700",
        fontSize: 11,
        color: theme.primary,
      }}
    >
      {children}
    </Text>
  );
}

function Chip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "#F3F0FA", gap: 4 }}
    >
      <Ionicons name={icon} size={11} color={theme.primary} />
      <Text
        style={{ color: theme.primaryDeep, fontSize: 11, fontWeight: "600" }}
      >
        {label}
      </Text>
    </View>
  );
}
