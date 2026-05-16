import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Card, Text } from "@/components/ui";
import { totalTimeMinutes, type MealRecipe } from "@/lib/meals";
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
  recipe: MealRecipe;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
};

export function RecipeCard({ recipe, canEdit, onOpen, onEdit }: Props) {
  const { t } = useTranslation();
  const ingredientCount = recipe.ingredients.length;
  const stepCount = recipe.steps.length;
  const totalMin = totalTimeMinutes(recipe);

  return (
    <Card className="mb-3 overflow-hidden p-0">
      <Pressable onPress={onOpen} className="active:opacity-90">
        <View className="p-3">
          <View className="flex-row items-start mb-1.5" style={{ gap: 6 }}>
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: "700",
                color: "#1A1A1A",
              }}
            >
              {recipe.title}
            </Text>
            {canEdit ? (
              <Pressable
                onPress={onEdit}
                hitSlop={8}
                className="items-center justify-center rounded-full active:opacity-70"
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: theme.primarySoft,
                }}
              >
                <Ionicons name="pencil" size={12} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>

          {recipe.description ? (
            <Text
              variant="caption"
              numberOfLines={2}
              className="mb-2"
              style={{ color: "#6B6B6B" }}
            >
              {recipe.description}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {totalMin != null ? (
              <Chip
                icon="time-outline"
                label={t("meals.timeTotalLabel", { count: totalMin })}
              />
            ) : null}
            <Chip
              icon="people-outline"
              label={`${recipe.servings}`}
            />
            <Chip
              icon="leaf-outline"
              label={`${ingredientCount}`}
            />
            {stepCount > 0 ? (
              <Chip icon="list-outline" label={`${stepCount}`} />
            ) : null}
          </View>
        </View>
      </Pressable>

      <View
        className="px-3 pb-2.5"
        style={{
          borderTopWidth: 1,
          borderTopColor: "#F2EDE4",
          paddingTop: 8,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Avatar
            src={recipe.author_avatar_url ?? undefined}
            initials={initialsOf(recipe.author_full_name)}
            size="xs"
          />
          <Text variant="caption" style={{ fontSize: 11 }}>
            {t("meals.byAuthor", { name: firstName(recipe.author_full_name) })}
          </Text>
        </View>
      </View>
    </Card>
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
