import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Avatar, Button, Text } from "@/components/ui";
import {
  cloneRecipeToEventTool,
  listRecipeCatalogue,
  totalTimeMinutes,
  type CatalogueRecipeSummary,
} from "@/lib/meals";
import { useSession } from "@/lib/useSession";
import { theme } from "@/lib/theme";

type Props = {
  visible: boolean;
  toolId: string;
  onClose: () => void;
  // Fires after a successful clone so the parent reloads its recipe list.
  onAdded: () => void;
};

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

export function RecipeCataloguePicker({
  visible,
  toolId,
  onClose,
  onAdded,
}: Props) {
  const { t } = useTranslation();
  const { session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogueRecipeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Selected recipe pending servings input. Null = no import dialog open.
  const [pendingImport, setPendingImport] =
    useState<CatalogueRecipeSummary | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const list = await listRecipeCatalogue(q, 50);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load("");
    setQuery("");
  }, [visible, load]);

  // Debounce the search so we don't hit the RPC on every keystroke.
  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      void load(query.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [query, visible, load]);

  const handleImport = async (
    recipe: CatalogueRecipeSummary,
    servings: number,
  ) => {
    setBusyId(recipe.recipe_id);
    setPendingImport(null);
    try {
      await cloneRecipeToEventTool(recipe.recipe_id, toolId, servings);
      onAdded();
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
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
          style={{ height: "92%" }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            <Text variant="label" style={{ fontSize: 17, fontWeight: "700" }}>
              {t("meals.catalogue.title")}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="rounded-full items-center justify-center"
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-5 pt-3 pb-2">
            <View
              className="flex-row items-center px-3 rounded-lg border bg-surface border-border"
            >
              <Ionicons name="search" size={16} color="#6B6B6B" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("meals.catalogue.search")}
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  marginLeft: 8,
                  fontSize: 15,
                  color: "#1A1A1A",
                }}
              />
              {loading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : null}
            </View>
          </View>

          {/* List */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {loading && items.length === 0 ? (
              <View className="py-8 items-center">
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : items.length === 0 ? (
              <View className="py-10 items-center">
                <Ionicons
                  name="book-outline"
                  size={28}
                  color="#9CA3AF"
                  style={{ marginBottom: 8 }}
                />
                <Text
                  variant="caption"
                  style={{
                    color: "#6B7280",
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  {t("meals.catalogue.empty")}
                </Text>
              </View>
            ) : (
              items.map((r) => (
                <CatalogueRow
                  key={r.recipe_id}
                  recipe={r}
                  isMine={r.owner_id === currentUserId}
                  busy={busyId === r.recipe_id}
                  onAdd={() => setPendingImport(r)}
                />
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>

      <ImportServingsDialog
        recipe={pendingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={(servings) =>
          pendingImport ? handleImport(pendingImport, servings) : undefined
        }
      />
    </Modal>
  );
}

// Small modal that asks "for how many people?" before cloning a catalogue
// recipe into the meals tool. Defaults to the source recipe's servings so a
// user who just wants the recipe as-is can tap Confirm immediately.
function ImportServingsDialog({
  recipe,
  onCancel,
  onConfirm,
}: {
  recipe: CatalogueRecipeSummary | null;
  onCancel: () => void;
  onConfirm: (servings: number) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (recipe) setValue(String(recipe.servings));
  }, [recipe]);

  if (!recipe) return null;

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 999;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-background rounded-2xl p-5"
        >
          <Text variant="h2" className="mb-1">
            {t("meals.catalogue.addToTool")}
          </Text>
          <Text variant="caption" className="mb-4" numberOfLines={2}>
            {recipe.title}
          </Text>

          <Text variant="label" className="mb-1.5">
            {t("meals.servingsLabel")}
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            style={{
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E8E3DB",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              color: "#1A1A1A",
            }}
          />

          <View className="flex-row mt-4" style={{ gap: 8 }}>
            <View className="flex-1">
              <Button
                variant="ghost"
                label={t("meals.cancel")}
                onPress={onCancel}
              />
            </View>
            <View className="flex-1">
              <Button
                variant="cta"
                label={t("meals.catalogue.addToTool")}
                onPress={() => onConfirm(parsed)}
                disabled={!valid}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CatalogueRow({
  recipe,
  isMine,
  busy,
  onAdd,
}: {
  recipe: CatalogueRecipeSummary;
  isMine: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const totalMin = totalTimeMinutes(recipe);

  const visibilityLabel =
    recipe.visibility === "public"
      ? t("meals.catalogue.public")
      : isMine
        ? t("meals.catalogue.private")
        : t("meals.catalogue.shared");
  const visibilityColor =
    recipe.visibility === "public"
      ? "#16A34A"
      : isMine
        ? theme.primary
        : "#F59E0B";

  return (
    <View
      className="mb-3 rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E8E3DB",
      }}
    >
      <View className="p-3">
        <View
          className="flex-row items-start mb-1.5"
          style={{ gap: 6 }}
        >
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
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: visibilityColor + "22" }}
          >
            <Text
              style={{
                color: visibilityColor,
                fontSize: 10,
                fontWeight: "700",
              }}
            >
              {visibilityLabel}
            </Text>
          </View>
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

        <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
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
            label={`${recipe.ingredients_count}`}
          />
          {recipe.steps_count > 0 ? (
            <Chip icon="list-outline" label={`${recipe.steps_count}`} />
          ) : null}
        </View>

        {recipe.owner_full_name ? (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Avatar
              src={recipe.owner_avatar_url ?? undefined}
              initials={initialsOf(recipe.owner_full_name)}
              size="xs"
            />
            <Text variant="caption" style={{ fontSize: 11 }}>
              {recipe.owner_full_name}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={busy ? undefined : onAdd}
        disabled={busy}
        className="flex-row items-center justify-center py-2.5 active:opacity-70"
        style={{
          backgroundColor: theme.primarySoft,
          borderTopWidth: 1,
          borderTopColor: "#F2EDE4",
          gap: 6,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <>
            <Ionicons name="add" size={16} color={theme.primary} />
            <Text
              style={{
                color: theme.primary,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {t("meals.catalogue.addToTool")}
            </Text>
          </>
        )}
      </Pressable>
    </View>
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
