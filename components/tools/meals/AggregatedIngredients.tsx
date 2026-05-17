import { useMemo } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import {
  formatQuantity,
  type IngredientType,
  type MealRecipe,
  type MealUnit,
} from "@/lib/meals";
import { theme } from "@/lib/theme";

// Groups all recipe ingredients into one flat shopping list, summed per
// catalog item (or per normalized free-text name) and per unit. Different
// units of the same ingredient stay on separate lines — we don't convert
// between g/kg or ml/l (yet).

type AggGroup = IngredientType | "custom";

type AggItem = {
  // Stable key for the row. Uses catalog_id when present, otherwise the
  // normalized custom_name.
  key: string;
  catalog_id: string | null;
  name: string;
  group: AggGroup;
  unit: MealUnit;
  quantity: number;
};

// Display order matches a typical grocery store walk-through. Custom items
// (free text) sink to the bottom since their type isn't known.
const GROUP_ORDER: AggGroup[] = [
  "legumes",
  "fruits",
  "champignons",
  "viande",
  "poisson",
  "crustaces",
  "cremerie",
  "boulangerie",
  "cereales",
  "feculents",
  "legumineuses",
  "graines",
  "epicerie_salee",
  "epicerie_sucree",
  "condiments_epices",
  "boissons",
  "surgele",
  "frais_traiteur",
  "custom",
];

export function AggregatedIngredients({
  recipes,
}: {
  recipes: MealRecipe[];
}) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const items = new Map<string, AggItem>();
    for (const r of recipes) {
      // Per-serving × recipe.servings = total for this recipe's contribution.
      const servings = r.servings > 0 ? r.servings : 1;
      for (const ing of r.ingredients) {
        const normalized = ing.custom_name?.trim().toLowerCase() ?? null;
        const idKey =
          ing.catalog_id ?? (normalized ? `custom:${normalized}` : null);
        if (!idKey) continue;
        const key = `${idKey}|${ing.unit}`;
        const contribution = ing.quantity * servings;
        const existing = items.get(key);
        if (existing) {
          existing.quantity += contribution;
        } else {
          items.set(key, {
            key,
            catalog_id: ing.catalog_id,
            name: ing.catalog_name ?? ing.custom_name?.trim() ?? "?",
            group: ing.catalog_id
              ? (ing.catalog_type ?? "custom")
              : "custom",
            unit: ing.unit,
            quantity: contribution,
          });
        }
      }
    }

    const byGroup = new Map<AggGroup, AggItem[]>();
    for (const item of items.values()) {
      if (!byGroup.has(item.group)) byGroup.set(item.group, []);
      byGroup.get(item.group)!.push(item);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return GROUP_ORDER
      .map((group) => ({ group, items: byGroup.get(group) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [recipes]);

  const totalItems = grouped.reduce((sum, g) => sum + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <View className="py-10 items-center">
        <Ionicons
          name="basket-outline"
          size={28}
          color="#9CA3AF"
          style={{ marginBottom: 8 }}
        />
        <Text
          variant="caption"
          style={{ color: "#6B7280", textAlign: "center", fontSize: 13 }}
        >
          {t("meals.shopping.empty")}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {grouped.map((g) => (
        <View key={g.group} className="mb-5">
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
            {t(`meals.types.${g.group}`)} · {g.items.length}
          </Text>
          <View
            className="rounded-xl"
            style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E8E3DB",
            }}
          >
            {g.items.map((item, idx) => (
              <View
                key={item.key}
                className="flex-row items-center px-3 py-2"
                style={{
                  gap: 8,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: "#F2EDE4",
                }}
              >
                <Ionicons
                  name={item.catalog_id ? "leaf" : "create-outline"}
                  size={14}
                  color={item.catalog_id ? theme.primary : "#9CA3AF"}
                />
                <Text
                  style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B6B6B",
                    fontWeight: "600",
                  }}
                >
                  {formatQuantity(item.quantity)} {t(`meals.units.${item.unit}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
