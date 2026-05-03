// Source of truth for brand colors used in inline `style={{}}` props.
// Must stay in sync with the CSS variables in global.css and tailwind.config.js.
// Prefer Tailwind classes (e.g. `bg-primary`, `text-primary`) when possible —
// only reach for this object when an inline style is unavoidable (computed
// values, gradient stops, library APIs that take hex strings, etc.).

export const theme = {
  primary: "#10B981",
  primaryDeep: "#059669",
  primaryLight: "#34D399",
  primarySoft: "#D1FAE5",
  primaryForeground: "#FFFFFF",
  // Section titles (Participants, Outils, Mes événements...) stay dark,
  // independent of the primary brand color.
  sectionLabel: "#1A1A1A",
} as const;
