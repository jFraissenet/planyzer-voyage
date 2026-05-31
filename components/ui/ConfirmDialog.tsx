import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { Modal, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { Text } from "./Text";
import { theme } from "@/lib/theme";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red, trash-styled confirmation for irreversible deletions.
  destructive?: boolean;
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<Ctx>({
  confirm: async () => false,
});

// Returns a function that opens a styled confirmation modal and resolves to
// true (confirmed) or false (cancelled/dismissed). Replaces the native
// window.confirm / Alert.alert prompts so deletions look consistent.
export function useConfirm(): Ctx["confirm"] {
  return useContext(ConfirmContext).confirm;
}

type Pending = {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Ctx["confirm"]>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setPending({ opts, resolve });
      }),
    [],
  );

  const settle = useCallback((result: boolean) => {
    setPending((cur) => {
      cur?.resolve(result);
      return null;
    });
  }, []);

  const opts = pending?.opts;
  const destructive = opts?.destructive ?? false;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {/* Mounted only while a confirmation is pending so its RN-web portal is
          appended to <body> AFTER any already-open modal — guaranteeing the
          dialog paints in front of the modal that triggered it. */}
      {pending && opts ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => settle(false)}
        >
          <Pressable
            className="flex-1 bg-black/40 items-center justify-center px-4"
            onPress={() => settle(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-background rounded-2xl p-5"
            >
              <View className="items-center mb-4">
                <View
                  className="rounded-full items-center justify-center mb-3"
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: destructive ? "#FEE2E2" : theme.primarySoft,
                  }}
                >
                  <Ionicons
                    name={destructive ? "trash-outline" : "help-circle-outline"}
                    size={24}
                    color={destructive ? "#DC2626" : theme.primary}
                  />
                </View>
                <Text variant="h2" className="text-center">
                  {opts.title}
                </Text>
                {opts.message ? (
                  <Text variant="caption" className="text-center mt-1.5">
                    {opts.message}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={() => settle(true)}
                  className="items-center justify-center rounded-2xl px-6 py-4 active:opacity-85"
                  style={{
                    backgroundColor: destructive ? "#DC2626" : theme.primary,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    {opts.confirmLabel ?? t("common.confirm")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => settle(false)}
                  className="items-center justify-center rounded-2xl px-6 py-3 active:opacity-70"
                >
                  <Text style={{ color: theme.sectionLabel, fontWeight: "600" }}>
                    {opts.cancelLabel ?? t("common.cancel")}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}
