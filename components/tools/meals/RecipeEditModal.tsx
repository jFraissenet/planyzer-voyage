import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Button, Input, Text } from "@/components/ui";
import {
  deleteEventToolMealRecipe,
  upsertEventToolMealRecipe,
  type MealRecipe,
  type MealRecipeInput,
  type MealUnit,
  MEAL_UNITS,
} from "@/lib/meals";
import { IngredientPicker, type IngredientPick } from "./IngredientPicker";
import { theme } from "@/lib/theme";

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  visible: boolean;
  toolId: string;
  existing?: MealRecipe;
  onClose: () => void;
  onSaved: () => void;
};

// Local draft shape — we mint a synthetic id so React keys stay stable while
// the user reorders/edits before save.
type DraftIngredient = {
  id: string;
  catalog_id: string | null;
  catalog_name: string | null;
  custom_name: string | null;
  quantity: string; // string so the user can type freely
  unit: MealUnit;
};

type DraftStep = { id: string; text: string };

function mintId(): string {
  return Math.random().toString(36).slice(2);
}

function emptyDraftIngredient(): DraftIngredient {
  return {
    id: mintId(),
    catalog_id: null,
    catalog_name: null,
    custom_name: null,
    quantity: "",
    unit: "piece",
  };
}

function fromExistingIngredients(
  source: MealRecipe["ingredients"] | undefined,
): DraftIngredient[] {
  if (!source) return [];
  return source.map((i) => ({
    id: i.id,
    catalog_id: i.catalog_id,
    catalog_name: i.catalog_name,
    custom_name: i.custom_name,
    quantity: String(i.quantity),
    unit: i.unit,
  }));
}

function fromExistingSteps(
  source: MealRecipe["steps"] | undefined,
): DraftStep[] {
  if (!source) return [];
  return source.map((s) => ({ id: s.id, text: s.text }));
}

export function RecipeEditModal({
  mode,
  visible,
  toolId,
  existing,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timePrep, setTimePrep] = useState("");
  const [timeCook, setTimeCook] = useState("");
  const [timeRest, setTimeRest] = useState("");
  const [calories, setCalories] = useState("");
  const [servings, setServings] = useState("4");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setTimePrep(
      existing?.time_prep_minutes != null ? String(existing.time_prep_minutes) : "",
    );
    setTimeCook(
      existing?.time_cook_minutes != null ? String(existing.time_cook_minutes) : "",
    );
    setTimeRest(
      existing?.time_rest_minutes != null ? String(existing.time_rest_minutes) : "",
    );
    setCalories(
      existing?.calories != null ? String(existing.calories) : "",
    );
    setServings(String(existing?.servings ?? 4));
    setIngredients(fromExistingIngredients(existing?.ingredients));
    setSteps(fromExistingSteps(existing?.steps));
    setError(null);
    setBusy(false);
  }, [visible, existing]);

  const addIngredient = (pick: IngredientPick) => {
    setIngredients((prev) => [
      ...prev,
      {
        id: mintId(),
        catalog_id: pick.source === "catalog" ? pick.ingredient.ingredient_id : null,
        catalog_name: pick.source === "catalog" ? pick.ingredient.ingredient_name : null,
        custom_name: pick.source === "custom" ? pick.name : null,
        quantity: "",
        unit:
          pick.source === "catalog"
            ? pick.ingredient.ingredient_default_unit
            : "piece",
      },
    ]);
  };

  const updateIngredient = (id: string, patch: Partial<DraftIngredient>) => {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: mintId(), text: "" }]);
    // Defer the scroll to the next tick so the new row is laid out before
    // we measure the new content size.
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const updateStep = (id: string, text: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const build = (): MealRecipeInput | null => {
    const titleTrim = title.trim();
    if (!titleTrim) {
      setError(t("meals.errorTitleRequired"));
      return null;
    }
    const cleanIngredients = [];
    for (const i of ingredients) {
      const qty = Number(i.quantity.replace(",", "."));
      const hasName = i.catalog_id || (i.custom_name && i.custom_name.trim());
      if (!Number.isFinite(qty) || qty <= 0 || !hasName) {
        setError(t("meals.errorIngredientInvalid"));
        return null;
      }
      cleanIngredients.push({
        catalog_id: i.catalog_id,
        custom_name: i.catalog_id ? null : (i.custom_name ?? "").trim(),
        quantity: qty,
        unit: i.unit,
      });
    }
    const cleanSteps = steps
      .map((s) => s.text.trim())
      .filter((s) => s.length > 0);

    const parseMin = (v: string): number | null => {
      const trimmed = v.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const cal = calories.trim() === "" ? null : Number(calories);
    const serv = servings.trim() === "" ? 4 : Number(servings);

    return {
      title: titleTrim,
      description: description.trim() ? description.trim() : null,
      time_prep_minutes: parseMin(timePrep),
      time_cook_minutes: parseMin(timeCook),
      time_rest_minutes: parseMin(timeRest),
      calories: Number.isFinite(cal as number) ? (cal as number) : null,
      servings: Number.isFinite(serv) && serv > 0 ? serv : 4,
      ingredients: cleanIngredients,
      steps: cleanSteps,
    };
  };

  const save = async () => {
    const input = build();
    if (!input) return;
    setBusy(true);
    try {
      await upsertEventToolMealRecipe(
        toolId,
        mode === "edit" && existing ? existing.recipe_id : null,
        input,
      );
      onSaved();
    } catch (e) {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    const msg = t("meals.deleteConfirm");
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) void runDelete();
      return;
    }
    Alert.alert(msg, undefined, [
      { text: t("meals.cancel"), style: "cancel" },
      {
        text: t("meals.delete"),
        style: "destructive",
        onPress: () => runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteEventToolMealRecipe(existing.recipe_id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const titleLabel =
    mode === "create" ? t("meals.createTitle") : t("meals.editTitle");

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
          <View
            className="flex-row items-center justify-between px-5 pt-5 pb-3"
            style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}
          >
            <Text variant="h2">{titleLabel}</Text>
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

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            <Input
              label={t("meals.titleLabel")}
              placeholder={t("meals.titlePlaceholder")}
              value={title}
              onChangeText={setTitle}
              autoFocus
              required
            />
            <Input
              label={t("meals.descriptionLabel")}
              placeholder={t("meals.descriptionPlaceholder")}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("meals.timeSection")}</Text>
              <TimeRow
                label={t("meals.timePrepLabel")}
                value={timePrep}
                onChangeText={setTimePrep}
                placeholder="15"
              />
              <TimeRow
                label={t("meals.timeCookLabel")}
                value={timeCook}
                onChangeText={setTimeCook}
                placeholder="30"
              />
              <TimeRow
                label={t("meals.timeRestLabel")}
                value={timeRest}
                onChangeText={setTimeRest}
                placeholder="0"
              />
            </View>
            <View style={{ height: 1, backgroundColor: "#F2EDE4" }} />
            <View style={{ gap: 8 }}>
              <TimeRow
                label={t("meals.caloriesLabel")}
                value={calories}
                onChangeText={setCalories}
                placeholder="450"
              />
              <TimeRow
                label={t("meals.servingsLabel")}
                value={servings}
                onChangeText={setServings}
                placeholder="4"
                required
              />
            </View>
            <View style={{ height: 1, backgroundColor: "#F2EDE4" }} />

            {/* Ingredients */}
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("meals.ingredientsSection")}</Text>
              {ingredients.length === 0 ? (
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {t("meals.ingredientsEmpty")}
                </Text>
              ) : (
                ingredients.map((ing) => (
                  <View
                    key={ing.id}
                    className="rounded-xl px-3 py-2"
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderWidth: 1,
                      borderColor: "#E8E3DB",
                      gap: 6,
                    }}
                  >
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Ionicons
                        name={ing.catalog_id ? "leaf" : "create-outline"}
                        size={14}
                        color={ing.catalog_id ? theme.primary : "#9CA3AF"}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: "#1A1A1A",
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >
                        {ing.catalog_name ?? ing.custom_name ?? "?"}
                      </Text>
                      <Pressable
                        onPress={() => removeIngredient(ing.id)}
                        hitSlop={6}
                        className="items-center justify-center rounded-full"
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: "#FEE2E2",
                        }}
                      >
                        <Ionicons name="close" size={12} color="#991B1B" />
                      </Pressable>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <TextInput
                        value={ing.quantity}
                        onChangeText={(v) =>
                          updateIngredient(ing.id, { quantity: v })
                        }
                        placeholder={t("meals.quantityLabel")}
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1,
                          backgroundColor: "#F9FAFB",
                          borderWidth: 1,
                          borderColor: "#E8E3DB",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 14,
                        }}
                      />
                      <UnitDropdown
                        unit={ing.unit}
                        onChange={(u) => updateIngredient(ing.id, { unit: u })}
                      />
                    </View>
                  </View>
                ))
              )}
              <IngredientPicker onPick={addIngredient} />
            </View>

            {/* Steps */}
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("meals.stepsSection")}</Text>
              {steps.length === 0 ? (
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {t("meals.stepsEmpty")}
                </Text>
              ) : (
                steps.map((s, idx) => (
                  <View
                    key={s.id}
                    className="flex-row items-start"
                    style={{ gap: 6 }}
                  >
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: theme.primarySoft,
                        marginTop: 6,
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
                    <TextInput
                      value={s.text}
                      onChangeText={(v) => updateStep(s.id, v)}
                      placeholder={t("meals.stepPlaceholder")}
                      placeholderTextColor="#9ca3af"
                      multiline
                      style={{
                        flex: 1,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "#E8E3DB",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 14,
                        textAlignVertical: "top",
                        minHeight: 60,
                      }}
                    />
                    <Pressable
                      onPress={() => removeStep(s.id)}
                      hitSlop={6}
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: "#FEE2E2",
                        marginTop: 6,
                      }}
                    >
                      <Ionicons name="close" size={12} color="#991B1B" />
                    </Pressable>
                  </View>
                ))
              )}
              <Pressable
                onPress={addStep}
                hitSlop={6}
                className="flex-row items-center justify-center rounded-lg border bg-surface border-border active:opacity-70"
                style={{ paddingVertical: 10, gap: 6 }}
              >
                <Ionicons name="add" size={16} color={theme.primary} />
                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {t("meals.addStep")}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Text style={{ color: "#991B1B", fontSize: 12 }}>{error}</Text>
            ) : null}
          </ScrollView>

          <View className="px-5 pb-5 pt-2" style={{ gap: 8 }}>
            <Button
              variant="cta"
              size="lg"
              label={busy ? t("meals.saving") : t("meals.save")}
              onPress={save}
              disabled={busy || !title.trim()}
            />
            <Button
              variant="ghost"
              label={t("meals.cancel")}
              onPress={onClose}
              disabled={busy}
            />
            {mode === "edit" ? (
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                className="py-3 items-center"
                style={{ opacity: busy ? 0.5 : 1 }}
              >
                <Text
                  variant="label"
                  style={{ color: "#991B1B", fontWeight: "700" }}
                >
                  {t("meals.delete")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Tiny dropdown for picking a unit. Cycles through MEAL_UNITS for now to
// keep the surface light — we can swap for a proper bottom-sheet picker
// once we have real recipes to test friction.
function UnitDropdown({
  unit,
  onChange,
}: {
  unit: MealUnit;
  onChange: (u: MealUnit) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: "relative" }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={4}
        className="flex-row items-center rounded-lg px-2.5 py-1.5"
        style={{
          backgroundColor: "#F3F0FA",
          borderWidth: 1,
          borderColor: "#E8E3DB",
          gap: 4,
          minWidth: 64,
        }}
      >
        <Text style={{ fontSize: 13, color: "#1A1A1A", fontWeight: "600" }}>
          {t(`meals.units.${unit}`)}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={12}
          color="#6B6B6B"
        />
      </Pressable>
      {open ? (
        <View
          className="rounded-lg overflow-hidden"
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E8E3DB",
            zIndex: 50,
            minWidth: 120,
            maxHeight: 240,
          }}
        >
          <ScrollView>
            {MEAL_UNITS.map((u, idx) => (
              <Pressable
                key={u}
                onPress={() => {
                  onChange(u);
                  setOpen(false);
                }}
                className="px-3 py-2 active:opacity-70"
                style={
                  idx > 0
                    ? { borderTopWidth: 1, borderTopColor: "#F2EDE4" }
                    : undefined
                }
              >
                <Text style={{ fontSize: 13, color: "#1A1A1A" }}>
                  {t(`meals.units.${u}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

// One line for a numeric field: label on the left, narrow input on the right.
// Used for the three time legs AND for calories / servings so the whole
// "numbers" block of the form shares the same rhythm.
function TimeRow({
  label,
  value,
  onChangeText,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Text style={{ flex: 1, fontSize: 14, color: "#1A1A1A" }}>
        {label}
        {required ? <Text style={{ color: "#EF4444" }}> *</Text> : null}
      </Text>
      <View style={{ width: 110 }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          style={{
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E8E3DB",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: "#1A1A1A",
            textAlign: "right",
          }}
        />
      </View>
    </View>
  );
}
