import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { navigateToStepRoute } from "./birthday";
import { getTutorial } from "./registry";
import type {
  Tutorial,
  TutorialAction,
  TutorialContext as TCtx,
  TutorialStep,
} from "./types";

type Status = "idle" | "loading" | "running";

type State = {
  status: Status;
  tutorial: Tutorial | null;
  ctx: TCtx;
  steps: TutorialStep[];
  index: number;
  playing: boolean;
};

const initial: State = {
  status: "idle",
  tutorial: null,
  ctx: {},
  steps: [],
  index: 0,
  playing: true,
};

type Api = State & {
  start: (tutorialId: string) => Promise<void>;
  stop: () => Promise<void>;
  next: () => void;
  prev: () => void;
  togglePlay: () => void;
  goTo: (index: number) => void;
  promptVisible: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
  currentAction: TutorialAction | null;
};

const Ctx = createContext<Api | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [promptVisible, setPromptVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<TutorialAction | null>(
    null,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const stop = useCallback(async () => {
    const s = stateRef.current;
    if (s.tutorial?.teardown && Object.keys(s.ctx).length > 0) {
      try {
        await s.tutorial.teardown(s.ctx);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("tutorial teardown failed:", err);
      }
    }
    setState(initial);
    setCurrentAction(null);
  }, []);

  const start = useCallback(async (tutorialId: string) => {
    const tutorial = getTutorial(tutorialId);
    if (!tutorial) return;
    setState({ ...initial, status: "loading", tutorial });
    setCurrentAction(null);
    try {
      const ctx = tutorial.setup ? await tutorial.setup() : {};
      const steps = tutorial.buildSteps(ctx);
      setState({
        status: "running",
        tutorial,
        ctx,
        steps,
        index: 0,
        playing: true,
      });
      if (steps[0]) {
        navigateToStepRoute(steps[0]);
        setCurrentAction(steps[0].action ?? { kind: "close-all" });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("tutorial setup failed:", err);
      setState(initial);
    }
  }, []);

  const goTo = useCallback((index: number) => {
    setState((prev) => {
      if (prev.status !== "running") return prev;
      const clamped = Math.max(0, Math.min(prev.steps.length - 1, index));
      const step = prev.steps[clamped];
      if (step) {
        navigateToStepRoute(step);
        // Steps without an explicit action implicitly close anything the
        // previous step opened so the user never sees stale modals.
        setCurrentAction(step.action ?? { kind: "close-all" });
      }
      return { ...prev, index: clamped };
    });
  }, []);

  const next = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "running") return;
    if (s.index >= s.steps.length - 1) {
      void stop();
      return;
    }
    goTo(s.index + 1);
  }, [goTo, stop]);

  const prev = useCallback(() => {
    goTo(stateRef.current.index - 1);
  }, [goTo]);

  const togglePlay = useCallback(() => {
    setState((p) => ({ ...p, playing: !p.playing }));
  }, []);

  const openPrompt = useCallback(() => setPromptVisible(true), []);
  const closePrompt = useCallback(() => setPromptVisible(false), []);

  const value = useMemo<Api>(
    () => ({
      ...state,
      start,
      stop,
      next,
      prev,
      togglePlay,
      goTo,
      promptVisible,
      openPrompt,
      closePrompt,
      currentAction,
    }),
    [state, start, stop, next, prev, togglePlay, goTo, promptVisible, openPrompt, closePrompt, currentAction],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTutorial(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTutorial must be used inside TutorialProvider");
  return v;
}
