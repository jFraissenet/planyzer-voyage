import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Button, Input, Text, useConfirm } from "@/components/ui";
import {
  deleteEventToolMealRecipe,
  roundToQuarter,
  upsertEventToolMealRecipe,
  type MealRecipe,
  type MealRecipeInput,
  type MealUnit,
  MEAL_UNITS,
} from "@/lib/meals";
import { IngredientPicker, type IngredientPick } from "./IngredientPicker";
import { theme } from "@/lib/theme";
import {
  clampDecimal,
  clampInt,
  digitsOf,
  parseIntOrNull,
} from "@/lib/formValidation";
import { useFieldErrors } from "@/lib/useFieldErrors";

type Mode = "create" | "edit";

// Hard limits — kept well below the DB column ceilings (int columns for
// time/calories/servings, numeric(10,2) for quantities) so an out-of-range
// value can never reach Postgres and surface as a raw "erreur".
const LIMITS = {
  title: 120,
  description: 1000,
  step: 1000,
  timeMax: 10000, // minutes (~7 days)
  caloriesMax: 100000,
  servingsMax: 500,
  quantityMax: 100000,
} as const;

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

// Stored quantities are per-serving; the form shows totals for the current
// servings, so we multiply on load (and divide back on save).
function fromExistingIngredients(
  source: MealRecipe["ingredients"] | undefined,
  servings: number,
): DraftIngredient[] {
  if (!source) return [];
  return source.map((i) => ({
    id: i.id,
    catalog_id: i.catalog_id,
    catalog_name: i.catalog_name,
    custom_name: i.custom_name,
    quantity: String(roundToQuarter(i.quantity * servings)),
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
  const confirm = useConfirm();

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
  // Per-field validation messages, shown inline (red border + text under the
  // field). Keys: "title", "servings", and each ingredient row id. `error`
  // above is reserved for the save-failure safety net.
  const fieldErrors = useFieldErrors();
  // Scroll offset of each validated section (direct children of the scroll
  // content, so onLayout y == scroll offset), so we can jump to the first
  // field in error on save.
  const sectionY = useRef<{
    numbers: number;
    ingredients: number;
    steps: number;
  }>({
    numbers: 0,
    ingredients: 0,
    steps: 0,
  });
  // Which ingredient's unit picker is expanded (only one at a time). Inline
  // chip grid rather than an absolute dropdown so it never stacks behind the
  // search field / following rows.
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Tracks the last valid (>0) servings the form has seen, so we keep scaling
  // correctly even when the user clears the input mid-edit (transient "" or
  // "0" states must not break the ratio).
  const lastValidServingsRef = useRef<number>(4);

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
    const initialServings = existing?.servings ?? 4;
    lastValidServingsRef.current = initialServings;
    setIngredients(
      fromExistingIngredients(existing?.ingredients, initialServings),
    );
    setSteps(fromExistingSteps(existing?.steps));
    setError(null);
    fieldErrors.reset();
    setBusy(false);
    setOpenUnitId(null);
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
    fieldErrors.clear(id);
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    fieldErrors.clear(id);
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
    fieldErrors.clear(id);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    fieldErrors.clear(id);
  };

  const scrollToError = (
    which: "title" | "servings" | "ingredients" | "steps",
  ) => {
    const y =
      which === "title"
        ? 0
        : which === "servings"
          ? sectionY.current.numbers
          : which === "ingredients"
            ? sectionY.current.ingredients
            : sectionY.current.steps;
    scrollViewRef.current?.scrollTo({ y, animated: true });
  };

  const build = (): MealRecipeInput | null => {
    const errs: Record<string, string> = {};
    let firstError:
      | "title"
      | "servings"
      | "ingredients"
      | "steps"
      | null = null;

    const titleTrim = title.trim();
    if (!titleTrim) {
      errs.title = t("meals.errorTitleRequired");
      firstError = firstError ?? "title";
    }

    const serv = servings.trim() === "" ? 0 : Number(servings);
    const safeServings = Number.isFinite(serv) && serv >= 1 ? serv : 0;
    if (safeServings < 1) {
      errs.servings = t("meals.errorServingsRequired");
      firstError = firstError ?? "servings";
    }

    // Form holds totals for the current servings; storage is per-serving.
    const cleanIngredients = [];
    for (const i of ingredients) {
      const qty = Number(i.quantity.replace(",", "."));
      const hasName = i.catalog_id || (i.custom_name && i.custom_name.trim());
      if (!hasName) {
        errs[i.id] = t("meals.errorIngredientName");
        firstError = firstError ?? "ingredients";
        continue;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        errs[i.id] = t("meals.errorIngredientQuantity");
        firstError = firstError ?? "ingredients";
        continue;
      }
      cleanIngredients.push({
        catalog_id: i.catalog_id,
        custom_name: i.catalog_id ? null : (i.custom_name ?? "").trim(),
        quantity: qty / safeServings,
        unit: i.unit,
      });
    }
    // Steps can't be blank — flag each empty one instead of silently dropping
    // it, so the user understands why the form won't save.
    for (const s of steps) {
      if (s.text.trim().length === 0) {
        errs[s.id] = t("meals.errorStepEmpty");
        firstError = firstError ?? "steps";
      }
    }

    fieldErrors.replace(errs);

    if (firstError) {
      scrollToError(firstError);
      return null;
    }

    const cleanSteps = steps.map((s) => s.text.trim());

    return {
      title: titleTrim,
      description: description.trim() ? description.trim() : null,
      time_prep_minutes: parseIntOrNull(timePrep),
      time_cook_minutes: parseIntOrNull(timeCook),
      time_rest_minutes: parseIntOrNull(timeRest),
      calories: parseIntOrNull(calories),
      servings: safeServings,
      ingredients: cleanIngredients,
      steps: cleanSteps,
    };
  };

  // When the user changes the servings count, rescale all ingredient totals
  // by the same ratio. Quarter-rounded so we never display 1.86. The user can
  // still edit individual quantities afterward — those overrides stick.
  //
  // We compare against `lastValidServingsRef`, NOT the current servings state,
  // because intermediate edits (typing "" between "12" and "5") would otherwise
  // poison the ratio with prev=0 and break subsequent scaling.
  const handleServingsChange = (raw: string) => {
    const next = clampInt(raw, LIMITS.servingsMax);
    fieldErrors.clear("servings");
    const newServ = Number(next);
    if (Number.isFinite(newServ) && newServ > 0) {
      const prev = lastValidServingsRef.current;
      if (prev > 0 && newServ !== prev) {
        const ratio = newServ / prev;
        setIngredients((items) =>
          items.map((i) => {
            const oldQty = Number(i.quantity.replace(",", "."));
            if (!Number.isFinite(oldQty) || oldQty <= 0) return i;
            return {
              ...i,
              quantity: String(roundToQuarter(oldQty * ratio)),
            };
          }),
        );
      }
      lastValidServingsRef.current = newServ;
    }
    setServings(next);
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
      setError(t("meals.errorSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: t("meals.deleteConfirm"),
      confirmLabel: t("meals.delete"),
      cancelLabel: t("meals.cancel"),
      destructive: true,
    });
    if (ok) void runDelete();
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
              onChangeText={(v) => {
                setTitle(v);
                fieldErrors.clear("title");
              }}
              maxLength={LIMITS.title}
              error={fieldErrors.get("title")}
              autoFocus
              required
            />
            <Input
              label={t("meals.descriptionLabel")}
              placeholder={t("meals.descriptionPlaceholder")}
              value={description}
              onChangeText={setDescription}
              maxLength={LIMITS.description}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <View style={{ gap: 8 }}>
              <Text variant="label">{t("meals.timeSection")}</Text>
              <TimeRow
                label={t("meals.timePrepLabel")}
                value={timePrep}
                onChangeText={(v) => setTimePrep(clampInt(v, LIMITS.timeMax))}
                maxLength={digitsOf(LIMITS.timeMax)}
                placeholder="15"
              />
              <TimeRow
                label={t("meals.timeCookLabel")}
                value={timeCook}
                onChangeText={(v) => setTimeCook(clampInt(v, LIMITS.timeMax))}
                maxLength={digitsOf(LIMITS.timeMax)}
                placeholder="30"
              />
              <TimeRow
                label={t("meals.timeRestLabel")}
                value={timeRest}
                onChangeText={(v) => setTimeRest(clampInt(v, LIMITS.timeMax))}
                maxLength={digitsOf(LIMITS.timeMax)}
                placeholder="0"
              />
            </View>
            <View style={{ height: 1, backgroundColor: "#F2EDE4" }} />
            <View
              style={{ gap: 8 }}
              onLayout={(e) => {
                sectionY.current.numbers = e.nativeEvent.layout.y;
              }}
            >
              <TimeRow
                label={t("meals.caloriesLabel")}
                value={calories}
                onChangeText={(v) =>
                  setCalories(clampInt(v, LIMITS.caloriesMax))
                }
                maxLength={digitsOf(LIMITS.caloriesMax)}
                placeholder="450"
              />
              <TimeRow
                label={t("meals.servingsLabel")}
                value={servings}
                onChangeText={handleServingsChange}
                maxLength={digitsOf(LIMITS.servingsMax)}
                placeholder="4"
                required
                error={fieldErrors.get("servings")}
              />
            </View>
            <View style={{ height: 1, backgroundColor: "#F2EDE4" }} />

            {/* Ingredients */}
            <View
              style={{ gap: 8 }}
              onLayout={(e) => {
                sectionY.current.ingredients = e.nativeEvent.layout.y;
              }}
            >
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
                          updateIngredient(ing.id, {
                            quantity: clampDecimal(v, LIMITS.quantityMax),
                          })
                        }
                        placeholder={t("meals.quantityLabel")}
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1,
                          backgroundColor: "#F9FAFB",
                          borderWidth: 1,
                          borderColor: fieldErrors.has(ing.id)
                            ? "#EF4444"
                            : "#E8E3DB",
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          fontSize: 14,
                        }}
                      />
                      <Pressable
                        onPress={() =>
                          setOpenUnitId((cur) =>
                            cur === ing.id ? null : ing.id,
                          )
                        }
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
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#1A1A1A",
                            fontWeight: "600",
                          }}
                        >
                          {t(`meals.units.${ing.unit}`)}
                        </Text>
                        <Ionicons
                          name={
                            openUnitId === ing.id
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={12}
                          color="#6B6B6B"
                        />
                      </Pressable>
                    </View>
                    {openUnitId === ing.id ? (
                      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                        {MEAL_UNITS.map((u) => {
                          const sel = u === ing.unit;
                          return (
                            <Pressable
                              key={u}
                              onPress={() => {
                                updateIngredient(ing.id, { unit: u });
                                setOpenUnitId(null);
                              }}
                              className="rounded-full px-3 py-1.5 active:opacity-70"
                              style={{
                                backgroundColor: sel
                                  ? theme.primary
                                  : "#F3F0FA",
                                borderWidth: 1,
                                borderColor: sel ? theme.primary : "#E8E3DB",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "600",
                                  color: sel ? "#FFFFFF" : theme.primaryDeep,
                                }}
                              >
                                {t(`meals.units.${u}`)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    {fieldErrors.get(ing.id) ? (
                      <Text style={{ color: "#991B1B", fontSize: 12 }}>
                        {fieldErrors.get(ing.id)}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
              <IngredientPicker onPick={addIngredient} />
            </View>

            {/* Steps */}
            <View
              style={{ gap: 8 }}
              onLayout={(e) => {
                sectionY.current.steps = e.nativeEvent.layout.y;
              }}
            >
              <Text variant="label">{t("meals.stepsSection")}</Text>
              {steps.length === 0 ? (
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {t("meals.stepsEmpty")}
                </Text>
              ) : (
                steps.map((s, idx) => (
                  <View key={s.id} style={{ gap: 4 }}>
                    <View className="flex-row items-start" style={{ gap: 6 }}>
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
                      maxLength={LIMITS.step}
                      multiline
                      style={{
                        flex: 1,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: fieldErrors.has(s.id)
                          ? "#EF4444"
                          : "#E8E3DB",
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
                    {fieldErrors.get(s.id) ? (
                      <Text
                        style={{
                          color: "#991B1B",
                          fontSize: 12,
                          marginLeft: 30,
                        }}
                      >
                        {fieldErrors.get(s.id)}
                      </Text>
                    ) : null}
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

// One line for a numeric field: label on the left, narrow input on the right.
// Used for the three time legs AND for calories / servings so the whole
// "numbers" block of the form shares the same rhythm.
function TimeRow({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  required?: boolean;
  maxLength?: number;
  error?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
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
            maxLength={maxLength}
            style={{
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: error ? "#EF4444" : "#E8E3DB",
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
      {error ? (
        <Text style={{ color: "#991B1B", fontSize: 12, textAlign: "right" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
