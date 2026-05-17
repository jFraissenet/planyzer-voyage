import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import {
  listEventToolMealRecipes,
  type MealRecipe,
} from "@/lib/meals";
import { useSession } from "@/lib/useSession";
import { AggregatedIngredients } from "./AggregatedIngredients";
import { RecipeCard } from "./RecipeCard";
import { RecipeCataloguePicker } from "./RecipeCataloguePicker";
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickingCatalogue, setPickingCatalogue] = useState(false);

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
        <View className="flex-row mb-3" style={{ gap: 8 }}>
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
          <Pressable
            onPress={() => setAddMenuOpen(true)}
            accessibilityLabel={t("meals.addMenu.title")}
            className="flex-row items-center justify-center mb-4 py-3 rounded-lg active:opacity-80"
            style={{
              backgroundColor: theme.primary,
              gap: 6,
            }}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
              {t("meals.addMenu.title")}
            </Text>
          </Pressable>
        ) : null}

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

      <AddMenu
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        onCreate={() => {
          setAddMenuOpen(false);
          setCreating(true);
        }}
        onPickFromCatalogue={() => {
          setAddMenuOpen(false);
          setPickingCatalogue(true);
        }}
      />

      <RecipeCataloguePicker
        visible={pickingCatalogue}
        toolId={props.tool.event_tool_id}
        onClose={() => setPickingCatalogue(false)}
        onAdded={load}
      />

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

// Bottom-sheet action menu offering the two creation paths. Surfaced when
// the user taps the FAB so they pick "from scratch" vs "from catalogue"
// without polluting the recipe form.
function AddMenu({
  visible,
  onClose,
  onCreate,
  onPickFromCatalogue,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  onPickFromCatalogue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface rounded-t-2xl"
          style={{ paddingBottom: 24 }}
        >
          <View
            className="px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#F2EDE4" }}
          >
            <Text variant="label" style={{ fontSize: 15, fontWeight: "700" }}>
              {t("meals.addMenu.title")}
            </Text>
          </View>
          <Pressable
            onPress={onCreate}
            className="flex-row items-center px-5 py-4 active:opacity-70"
            style={{ gap: 12 }}
          >
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 36,
                height: 36,
                backgroundColor: theme.primarySoft,
              }}
            >
              <Ionicons name="create-outline" size={18} color={theme.primary} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: "#1A1A1A" }}>
              {t("meals.addMenu.createFromScratch")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
          <Pressable
            onPress={onPickFromCatalogue}
            className="flex-row items-center px-5 py-4 active:opacity-70"
            style={{ gap: 12 }}
          >
            <View
              className="rounded-full items-center justify-center"
              style={{
                width: 36,
                height: 36,
                backgroundColor: theme.primarySoft,
              }}
            >
              <Ionicons name="book-outline" size={18} color={theme.primary} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: "#1A1A1A" }}>
              {t("meals.addMenu.fromCatalogue")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
