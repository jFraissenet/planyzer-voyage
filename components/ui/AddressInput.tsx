import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { searchAddresses, type AddressSuggestion } from "@/lib/geocoding";
import { Text } from "./Text";
import { theme } from "@/lib/theme";

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onPickSuggestion?: (suggestion: AddressSuggestion) => void;
  language?: string;
};

export function AddressInput({
  label,
  placeholder,
  value,
  onChangeText,
  onPickSuggestion,
  language,
}: Props) {
  const { t, i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedDisplay, setPickedDisplay] = useState<string | null>(null);
  const lastQueryRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    // Skip the search round-trip if the field shows the just-picked value.
    if (pickedDisplay && trimmed === pickedDisplay) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (lastQueryRef.current === trimmed) return;
    lastQueryRef.current = trimmed;

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddresses(trimmed, {
          signal: controller.signal,
          language: language ?? i18n.language,
        });
        if (!controller.signal.aborted) setSuggestions(results);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [value, language, i18n.language, pickedDisplay]);

  const handleChange = (text: string) => {
    if (pickedDisplay && text !== pickedDisplay) setPickedDisplay(null);
    onChangeText(text);
  };

  const pick = (s: AddressSuggestion) => {
    setPickedDisplay(s.display);
    setSuggestions([]);
    setFocused(false);
    onPickSuggestion?.(s);
    onChangeText(s.display);
  };

  const showDropdown =
    focused && (loading || suggestions.length > 0);

  return (
    <View className="w-full">
      {label ? (
        <Text variant="label" className="mb-1.5">
          {label}
        </Text>
      ) : null}
      <View
        className="flex-row items-center px-4 rounded-lg border bg-surface border-border"
      >
        <Ionicons name="location-outline" size={16} color="#6B6B6B" />
        <TextInput
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a tap on a suggestion still registers.
            setTimeout(() => setFocused(false), 150);
          }}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            paddingVertical: 12,
            marginLeft: 8,
            fontSize: 16,
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
          {loading && suggestions.length === 0 ? (
            <View className="px-3 py-3 flex-row items-center" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t("address.searching")}
              </Text>
            </View>
          ) : (
            suggestions.map((s, idx) => (
              <Pressable
                key={`${s.lat}-${s.lng}-${idx}`}
                onPress={() => pick(s)}
                className="px-3 py-2.5 active:opacity-70"
                style={
                  idx > 0
                    ? { borderTopWidth: 1, borderTopColor: "#F2EDE4" }
                    : undefined
                }
              >
                <View className="flex-row items-start" style={{ gap: 8 }}>
                  <Ionicons
                    name="location"
                    size={14}
                    color={theme.primary}
                    style={{ marginTop: 2 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "#1A1A1A",
                      lineHeight: 18,
                    }}
                    numberOfLines={2}
                  >
                    {s.display}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
