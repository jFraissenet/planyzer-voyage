// Shape of a single tutorial step. The player drives them sequentially,
// auto-advancing every `durationMs` when in auto-play mode.
// Side-effects a step can trigger when it enters. Each listening component
// reacts to the kinds it cares about (mostly modals auto-opening on the
// data they need to show).
export type TutorialAction =
  | { kind: "close-all" }
  | { kind: "open-new-event" }
  | { kind: "open-edit-team"; teamId: string }
  | { kind: "open-edit-expense"; expenseId: string }
  | { kind: "set-money-tab"; tab: "expenses" | "breakdown" };

export type TutorialStep = {
  // Optional route to push before the step renders (e.g. /events/[id]).
  // If absent, the player stays on the current screen.
  route?: string;
  // nativeID of the UI element to highlight (rendered as `id` on web). If
  // missing or not mounted at render time, the overlay falls back to a
  // centered tooltip on a fully darkened screen.
  highlightID?: string;
  // Side-effect to fire on step entry (open a modal, switch a tab…).
  action?: TutorialAction;
  // Tooltip content. Plain strings for now (FR only). Switch to i18n keys
  // later when we go multi-language.
  title: string;
  body: string;
  // Override the default 6s auto-play delay for this step (ms).
  durationMs?: number;
};

export type Tutorial = {
  id: string;
  title: string;
  subtitle?: string;
  // Builds the steps once the orchestrator (RPC) has handed back the IDs of
  // the entities to point at. For tutorials that don't need any DB state,
  // `ctx` is just an empty object.
  buildSteps: (ctx: TutorialContext) => TutorialStep[];
  // Optional setup that runs before the first step (creates demo data,
  // returns the IDs consumed by buildSteps).
  setup?: () => Promise<TutorialContext>;
  // Optional teardown that runs when the player closes (deletes demo data).
  teardown?: (ctx: TutorialContext) => Promise<void>;
};

export type TutorialContext = Record<string, string>;

export const DEFAULT_STEP_DURATION_MS = 6000;
