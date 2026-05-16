import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import {
  searchIngredientCatalog,
  type Ingredient,
  type MealUnit,
} from "@/lib/meals";
import { theme } from "@/lib/theme";

// Resolved pick: either a catalog item (preserves the FK + suggests its
// default unit) or a free-text fallback the user types in.
export type IngredientPick =
  | { source: "catalog"; ingredient: Ingredient }
  | { source: "custom"; name: string };

type Props = {
  placeholder?: string;
  onPick: (pick: IngredientPick) => void;
};

export function IngredientPicker({ placeholder, onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (lastQueryRef.current === trimmed) return;
    lastQueryRef.current = trimmed;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchIngredientCatalog(trimmed);
        if (!controller.signal.aborted) setResults(list);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  const pickCatalog = (ing: Ingredient) => {
    onPick({ source: "catalog", ingredient: ing });
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  const pickCustom = () => {
    const name = query.trim();
    if (!name) return;
    onPick({ source: "custom", name });
    setQuery("");
    setResults([]);
    setFocused(false);
  };

  const showDropdown =
    focused && query.trim().length >= 2 && (loading || results.length > 0 || true);
  // Even with 0 results we keep the dropdown open to show the "use custom"
  // affordance — that's the whole point of the hybrid input.

  return (
    <View className="w-full">
      <View
        className="flex-row items-center px-3 rounded-lg border bg-surface border-border"
      >
        <Ionicons name="search" size={16} color="#6B6B6B" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Slight delay so a tap on a suggestion still registers before
            // blur unmounts the dropdown.
            setTimeout(() => setFocused(false), 150);
          }}
          placeholder={placeholder ?? t("meals.ingredientSearchPlaceholder")}
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
        {loading ? <ActivityIndicator size="small" color={theme.primary} /> : null}
      </View>

      {showDropdown ? (
        <View
          className="mt-1 rounded-lg overflow-hidden"
          style={{
            borderWidth: 1,
            borderColor: "#E8E3DB",
            backgroundColor: "#FFFFFF",
          }}
        >
          {results.map((ing, idx) => (
            <Pressable
              key={ing.ingredient_id}
              onPress={() => pickCatalog(ing)}
              className="px-3 py-2.5 active:opacity-70"
              style={
                idx > 0
                  ? { borderTopWidth: 1, borderTopColor: "#F2EDE4" }
                  : undefined
              }
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Ionicons
                  name="leaf-outline"
                  size={14}
                  color={theme.primary}
                />
                <Text
                  style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
                >
                  {ing.ingredient_name}
                </Text>
                <Text variant="caption" style={{ fontSize: 11 }}>
                  {t(`meals.units.${ing.ingredient_default_unit}` as const, {
                    defaultValue: ing.ingredient_default_unit,
                  })}
                </Text>
              </View>
            </Pressable>
          ))}
          {!loading && results.length === 0 ? (
            <View
              className="px-3 py-2.5"
              style={{ borderTopWidth: 0 }}
            >
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t("meals.ingredientCatalogEmpty")}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={pickCustom}
            className="px-3 py-2.5 active:opacity-70"
            style={{
              backgroundColor: theme.primarySoft,
              borderTopWidth: 1,
              borderTopColor: "#F2EDE4",
            }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="add-circle" size={14} color={theme.primary} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.primaryDeep,
                  fontWeight: "600",
                }}
              >
                {t("meals.ingredientUseCustom", { name: query.trim() })}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// Helper to expose the supported unit list, used by the qty editor.
export function unitLabel(unit: MealUnit, t: (k: string) => string): string {
  return t(`meals.units.${unit}`);
}
