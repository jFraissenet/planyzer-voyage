import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FAB, Text } from "@/components/ui";
import {
  listEventToolMealRecipes,
  type MealRecipe,
} from "@/lib/meals";
import { useSession } from "@/lib/useSession";
import { AggregatedIngredients } from "./AggregatedIngredients";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetailModal } from "./RecipeDetailModal";
import { RecipeEditModal } from "./RecipeEditModal";
import { ToolShell, type ToolProps } from "../ToolShell";
import { theme } from "@/lib/theme";

type MealsTab = "recipes" | "shopping";

export function MealsTool(props: ToolProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [recipes, setRecipes] = useState<MealRecipe[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MealRecipe | null>(null);
  const [openDetail, setOpenDetail] = useState<MealRecipe | null>(null);
  const [tab, setTab] = useState<MealsTab>("recipes");

  const load = useCallback(async () => {
    try {
      const list = await listEventToolMealRecipes(props.tool.event_tool_id);
      setRecipes(list);
    } catch {
      setRecipes([]);
    }
  }, [props.tool.event_tool_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-sync the detail modal with the freshly-loaded list so edits propagate
  // (mirrors how proposals tool handles it).
  useEffect(() => {
    if (!openDetail) return;
    const fresh = recipes.find((r) => r.recipe_id === openDetail.recipe_id);
    if (fresh && fresh !== openDetail) setOpenDetail(fresh);
  }, [recipes, openDetail]);

  const canEdit = (r: MealRecipe): boolean =>
    r.author_id === currentUserId || props.isToolAdmin;

  return (
    <>
      <ToolShell {...props}>
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          <TabButton
            label={t("meals.tabs.recipes")}
            active={tab === "recipes"}
            onPress={() => setTab("recipes")}
          />
          <TabButton
            label={t("meals.tabs.shopping")}
            active={tab === "shopping"}
            onPress={() => setTab("shopping")}
          />
        </View>

        {tab === "recipes" ? (
          recipes.length === 0 ? (
            <View className="py-10 items-center">
              <Text variant="caption" className="text-center">
                {t("meals.empty")}
              </Text>
            </View>
          ) : (
            recipes.map((r) => (
              <RecipeCard
                key={r.recipe_id}
                recipe={r}
                canEdit={canEdit(r)}
                onOpen={() => setOpenDetail(r)}
                onEdit={() => setEditing(r)}
              />
            ))
          )
        ) : (
          <AggregatedIngredients recipes={recipes} />
        )}
      </ToolShell>

      {tab === "recipes" ? (
        <FAB
          icon="add"
          onPress={() => setCreating(true)}
          accessibilityLabel={t("meals.add")}
        />
      ) : null}

      <RecipeEditModal
        mode="create"
        visible={creating}
        toolId={props.tool.event_tool_id}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
      />

      {editing ? (
        <RecipeEditModal
          mode="edit"
          visible
          toolId={props.tool.event_tool_id}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      <RecipeDetailModal
        visible={!!openDetail}
        recipe={openDetail}
        canEdit={openDetail ? canEdit(openDetail) : false}
        onClose={() => setOpenDetail(null)}
        onEdit={() => {
          if (openDetail) {
            setEditing(openDetail);
            setOpenDetail(null);
          }
        }}
      />
    </>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className="flex-1 items-center justify-center rounded-full active:opacity-70"
      style={{
        paddingVertical: 8,
        backgroundColor: active ? theme.primary : "#F3F0FA",
        borderWidth: 1,
        borderColor: active ? theme.primary : "#E8E3DB",
      }}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : theme.primaryDeep,
          fontWeight: "700",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
