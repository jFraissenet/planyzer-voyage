import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Animated, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "./Text";

export type ToastVariant = "info" | "success" | "error";

type ShowOptions = {
  variant?: ToastVariant;
  duration?: number;
};

type ToastEntry = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type Ctx = {
  show: (message: string, opts?: ShowOptions) => void;
};

const ToastContext = createContext<Ctx>({
  show: () => undefined,
});

export function useToast(): Ctx {
  return useContext(ToastContext);
}

let counter = 0;
const newId = () => `toast-${counter++}`;

const VARIANT_STYLE: Record<
  ToastVariant,
  { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  info: {
    bg: "#1A1A1A",
    fg: "#FFFFFF",
    icon: "information-circle",
  },
  success: {
    bg: "#16A34A",
    fg: "#FFFFFF",
    icon: "checkmark-circle",
  },
  error: {
    bg: "#DC2626",
    fg: "#FFFFFF",
    icon: "warning",
  },
};

function ToastPill({ entry }: { entry: ToastEntry }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = VARIANT_STYLE[entry.variant];

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        backgroundColor: style.bg,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        maxWidth: 380,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
      }}
    >
      <Ionicons name={style.icon} size={18} color={style.fg} />
      <Text
        style={{
          color: style.fg,
          fontSize: 14,
          fontWeight: "600",
          flexShrink: 1,
        }}
      >
        {entry.message}
      </Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);

  const show = useCallback<Ctx["show"]>((message, opts) => {
    const id = newId();
    const variant: ToastVariant = opts?.variant ?? "info";
    const duration = opts?.duration ?? 3000;
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {items.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            elevation: 99,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 60,
            paddingHorizontal: 20,
          }}
        >
          <View
            pointerEvents="box-none"
            style={{ alignItems: "center", gap: 8 }}
          >
            {items.map((item) => (
              <ToastPill key={item.id} entry={item} />
            ))}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
