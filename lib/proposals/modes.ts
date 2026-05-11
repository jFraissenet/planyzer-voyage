// Proposal modes — single source of truth for the tool's "type".
// A proposals tool runs in exactly one mode at a time. The mode lives in
// event_tool_settings.mode (no schema change). Each mode declares:
//   - which question card shows on the empty-state TypePicker;
//   - which fields are visible in the create/edit form;
//   - which card layout renders the proposal in the list.
//
// The mode is non-destructive: changing it doesn't drop data, only switches
// the rendering. Fields not used by the new mode become hidden but stay in
// the DB so a later switch back makes them visible again.

import type Ionicons from "@expo/vector-icons/Ionicons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type ProposalMode =
  | "date"
  | "place"
  | "gift"
  | "text"
  | "free";

// Vote style — orthogonal to the mode. Each mode has a sensible default but
// the user can override it from the ⚙️ settings.
//   tri    : 👍 / 😐 / 👎 per proposal — nuanced comparison
//   check  : single "I'm in" toggle per proposal — Doodle-style multi-select
//   single : radio across all proposals — exactly one global vote per user
export type VoteStyle = "tri" | "check" | "single";

export type ProposalModeDescriptor = {
  id: ProposalMode;
  question: string;       // i18n key — the empty-state question card title
  subtitle: string;       // i18n key — the question card subtitle
  emptyHint: string;      // i18n key — empty state once the mode is set
  icon: IconName;
  color: string;
  cardLayout: "date" | "place" | "gift" | "text" | "rich";
  defaultVoteStyle: VoteStyle;
};

export const MODES: ProposalModeDescriptor[] = [
  {
    id: "date",
    question: "proposals.modes.date.question",
    subtitle: "proposals.modes.date.subtitle",
    emptyHint: "proposals.modes.date.empty",
    icon: "calendar-outline",
    color: "#F59E0B",
    cardLayout: "date",
    defaultVoteStyle: "check",
  },
  {
    id: "place",
    question: "proposals.modes.place.question",
    subtitle: "proposals.modes.place.subtitle",
    emptyHint: "proposals.modes.place.empty",
    icon: "location-outline",
    color: "#10B981",
    cardLayout: "place",
    defaultVoteStyle: "tri",
  },
  {
    id: "text",
    question: "proposals.modes.text.question",
    subtitle: "proposals.modes.text.subtitle",
    emptyHint: "proposals.modes.text.empty",
    icon: "chatbubble-ellipses-outline",
    color: "#3B82F6",
    cardLayout: "text",
    defaultVoteStyle: "single",
  },
  {
    id: "gift",
    question: "proposals.modes.gift.question",
    subtitle: "proposals.modes.gift.subtitle",
    emptyHint: "proposals.modes.gift.empty",
    icon: "gift-outline",
    color: "#EC4899",
    cardLayout: "gift",
    defaultVoteStyle: "tri",
  },
  {
    id: "free",
    question: "proposals.modes.free.question",
    subtitle: "proposals.modes.free.subtitle",
    emptyHint: "proposals.modes.free.empty",
    icon: "bulb-outline",
    color: "#8B5CF6",
    cardLayout: "rich",
    defaultVoteStyle: "tri",
  },
];

export function getMode(id: ProposalMode | null | undefined): ProposalModeDescriptor {
  // Falls back to "free" when the mode is unset or unknown — preserves
  // backward compatibility with proposals tools created before the registry.
  if (!id) return MODES.find((m) => m.id === "free")!;
  return MODES.find((m) => m.id === id) ?? MODES.find((m) => m.id === "free")!;
}

// Resolves the effective vote style: explicit override wins, else falls
// back to the active mode's default.
export function resolveVoteStyle(
  mode: ProposalMode | null | undefined,
  override: VoteStyle | null | undefined,
): VoteStyle {
  if (override) return override;
  return getMode(mode).defaultVoteStyle;
}

export type ProposalOrderBy =
  | "votes"
  | "date_asc"
  | "date_desc"
  | "created_asc";

// Resolves the effective order: explicit override wins; otherwise the
// "date" mode falls to date_asc and any other mode to votes.
export function resolveOrderBy(
  mode: ProposalMode | null | undefined,
  override: ProposalOrderBy | null | undefined,
): ProposalOrderBy {
  if (override) return override;
  return mode === "date" ? "date_asc" : "votes";
}
