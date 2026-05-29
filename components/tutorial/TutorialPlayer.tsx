import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text } from "@/components/ui";
import { useTutorial } from "@/lib/tutorials/TutorialContext";
import {
  DEFAULT_STEP_DURATION_MS,
  type TutorialStep,
} from "@/lib/tutorials/types";
import { theme } from "@/lib/theme";

type Rect = { x: number; y: number; width: number; height: number };

const HOLE_PADDING = 8;

/**
 * Resolve a DOM id into a screen-relative rectangle. Web only — on native
 * we'd need to instrument every component with refs, so the player just
 * falls back to a plain dark overlay there.
 */
function useTargetRect(
  id: string | undefined,
  active: boolean,
): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!active || !id || Platform.OS !== "web") {
      setRect(null);
      return;
    }
    let cancelled = false;
    let found = false;
    const measure = () => {
      if (cancelled || typeof document === "undefined") return;
      const el = document.getElementById(id);
      if (!el) {
        // Keep the last known rect while the target is still mounting
        // (e.g. the home FAB appears only after the events list loads).
        if (!found) setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      found = true;
      setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
    };
    measure();
    // Poll for a few seconds: the target may mount late (loading spinner,
    // navigation, modal animation) and may also move (scroll/resize).
    const interval = setInterval(measure, 250);
    const stop = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [id, active]);

  return rect;
}

function Halo({ rect }: { rect: Rect }) {
  const top = Math.max(0, rect.y - HOLE_PADDING);
  const left = Math.max(0, rect.x - HOLE_PADDING);
  const width = rect.width + HOLE_PADDING * 2;
  const height = rect.height + HOLE_PADDING * 2;

  if (Platform.OS === "web") {
    // box-shadow trick: a single fixed element creates the surrounding dark
    // overlay via an enormous shadow spread, so we don't have to compute the
    // viewport size ourselves (which was wrong inside the centered WebFrame).
    return (
      <View
        pointerEvents="none"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{
          position: "fixed" as never,
          left,
          top,
          width,
          height,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: theme.primary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" as never,
        } as never}
      />
    );
  }

  // Native fallback: 4 absolutely-positioned strips around the cutout.
  const win = Dimensions.get("window");
  const bg = "rgba(0,0,0,0.55)";
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: win.width,
          height: top,
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: top + height,
          width: win.width,
          height: Math.max(0, win.height - (top + height)),
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top,
          width: left,
          height,
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: left + width,
          top,
          width: Math.max(0, win.width - (left + width)),
          height,
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: theme.primary,
        }}
      />
    </>
  );
}

function Tooltip({
  step,
  rect,
  pinnedTop,
  index,
  total,
  playing,
  onPrev,
  onNext,
  onTogglePlay,
  onClose,
}: {
  step: TutorialStep;
  rect: Rect | null;
  // When true, the tooltip is pinned to the top of the screen instead of
  // following a halo / centering. Used for steps that open an app modal,
  // so the tooltip never covers the modal it's describing.
  pinnedTop?: boolean;
  index: number;
  total: number;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onClose: () => void;
}) {
  const win = Dimensions.get("window");
  // Place the tooltip below the halo when there's room, otherwise above,
  // otherwise centered.
  const tooltipMaxWidth = Math.min(420, win.width - 32);
  let top: number;
  let left: number;
  if (pinnedTop) {
    top = 24;
    left = (win.width - tooltipMaxWidth) / 2;
  } else if (!rect) {
    top = Math.max(80, win.height / 2 - 120);
    left = (win.width - tooltipMaxWidth) / 2;
  } else {
    const spaceBelow = win.height - (rect.y + rect.height) - 24;
    const spaceAbove = rect.y - 24;
    const desiredHeight = 220;
    if (spaceBelow >= desiredHeight || spaceBelow >= spaceAbove) {
      top = rect.y + rect.height + 20;
    } else {
      top = Math.max(20, rect.y - desiredHeight - 20);
    }
    left = Math.max(
      16,
      Math.min(win.width - tooltipMaxWidth - 16, rect.x),
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        ...(Platform.OS === "web"
          ? ({ position: "fixed" } as never)
          : { position: "absolute" }),
        left,
        top,
        width: tooltipMaxWidth,
      }}
    >
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 18,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }}
      >
        <View
          className="flex-row items-center justify-between mb-2"
          style={{ gap: 8 }}
        >
          <Text
            variant="caption"
            style={{
              color: theme.sectionLabel,
              fontWeight: "700",
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {index + 1} / {total}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            className="rounded-full items-center justify-center"
            style={{ width: 26, height: 26, backgroundColor: "#F3F4F6" }}
          >
            <Ionicons name="close" size={14} color="#6B7280" />
          </Pressable>
        </View>

        <Text
          variant="label"
          style={{ fontSize: 16, fontWeight: "700", marginBottom: 6 }}
        >
          {step.title}
        </Text>
        <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}>
          {step.body}
        </Text>

        <View
          className="flex-row items-center justify-between mt-4"
          style={{ gap: 8 }}
        >
          <Pressable
            onPress={onPrev}
            disabled={index === 0}
            hitSlop={6}
            className="rounded-full items-center justify-center active:opacity-70"
            style={{
              width: 38,
              height: 38,
              backgroundColor: index === 0 ? "#F3F4F6" : theme.primarySoft,
              opacity: index === 0 ? 0.4 : 1,
            }}
          >
            <Ionicons name="play-skip-back" size={16} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={onTogglePlay}
            hitSlop={6}
            className="flex-row items-center justify-center rounded-full active:opacity-70 px-4"
            style={{ height: 38, backgroundColor: theme.primary, gap: 6 }}
          >
            <Ionicons
              name={playing ? "pause" : "play"}
              size={14}
              color="#FFFFFF"
            />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
              {playing ? "Pause" : "Lecture"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            hitSlop={6}
            className="rounded-full items-center justify-center active:opacity-70"
            style={{
              width: 38,
              height: 38,
              backgroundColor: theme.primarySoft,
            }}
          >
            <Ionicons
              name="play-skip-forward"
              size={16}
              color={theme.primary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function TutorialPlayer() {
  const {
    status,
    steps,
    index,
    playing,
    next,
    prev,
    togglePlay,
    stop,
  } = useTutorial();

  const step = steps[index];
  const rect = useTargetRect(step?.highlightID, status === "running");

  const duration = useMemo(
    () => step?.durationMs ?? DEFAULT_STEP_DURATION_MS,
    [step],
  );

  useEffect(() => {
    if (status !== "running" || !playing) return;
    const id = setTimeout(next, duration);
    return () => clearTimeout(id);
  }, [status, playing, index, duration, next]);

  if (status !== "running" || !step) return null;

  // Steps that open an app modal (RN Modal). On web those modals portal to
  // <body> and would otherwise sit on top of the player; we render the player
  // overlay with a very high zIndex so it stays above them, drop the dark
  // backdrop so the modal stays visible, and pin the tooltip to the top.
  const opensModal =
    step.action?.kind === "open-edit-team" ||
    step.action?.kind === "open-edit-expense" ||
    step.action?.kind === "open-new-event";

  const content = (
    <>
      {rect ? (
        <Halo rect={rect} />
      ) : opensModal ? null : (
        <View
          pointerEvents="none"
          style={{
            ...(Platform.OS === "web"
              ? { position: "fixed" as never }
              : { position: "absolute" }),
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
      )}
      <Tooltip
        step={step}
        rect={rect}
        pinnedTop={opensModal && !rect}
        index={index}
        total={steps.length}
        playing={playing}
        onPrev={prev}
        onNext={next}
        onTogglePlay={togglePlay}
        onClose={() => void stop()}
      />
    </>
  );

  // Web: render outside a RN Modal as a fixed, top-of-stack overlay so it
  // always paints above app modals (which portal to <body> with z-index auto).
  if (Platform.OS === "web") {
    return (
      <View
        pointerEvents="box-none"
        style={
          {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483000,
          } as never
        }
      >
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => void stop()}
    >
      <View pointerEvents="box-none" style={{ flex: 1 }}>
        {content}
      </View>
    </Modal>
  );
}
