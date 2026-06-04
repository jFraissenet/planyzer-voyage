// Generic, reusable form-input helpers shared across every tool's forms.
//
// The goal: a bad value can never reach Postgres and surface as a raw "erreur".
// Numeric inputs are sanitized + hard-clamped AS THE USER TYPES, with maxLength
// derived from the allowed maximum, so the field physically can't overflow.
//
// Postgres column ceilings, for reference when picking a `max`:
//   - int4 columns   → ±2_147_483_647        (INT4_MAX below)
//   - numeric(10,2)  → 99_999_999.99          (NUMERIC_10_2_MAX below)
// Always pick a *realistic* business max well under these, not the raw ceiling.

export const INT4_MAX = 2_147_483_647;
export const NUMERIC_10_2_MAX = 99_999_999.99;

// Shared, realistic business caps reused across forms. Each is well under the
// backing column's ceiling so a value can never overflow Postgres. Per-form
// specifics (e.g. meal cooking time) keep their own local constants.
export const TEXT_MAX = {
  name: 120, // titles, labels, names
  shortText: 200, // single-line free text
  description: 1000, // multi-line description
  longText: 5000, // free-form notes / long bodies
  url: 2000,
} as const;

export const NUM_MAX = {
  amount: 1_000_000, // money amounts — numeric(12,2) columns
  percent: 100, // share percentages
  count: 100_000, // generic integer counts / capacities
  members: 1000, // team / room size
} as const;

// Number of digits in `n` — drives `maxLength` on integer inputs so the field
// caps the typed length too (e.g. max 10_000 → 5 digits).
export const digitsOf = (n: number): number => String(Math.floor(n)).length;

/**
 * Sanitize a raw text value to an integer string, clamped to `max`.
 * Strips everything but digits. Returns "" for an empty/cleared field so the
 * user can blank it mid-edit (callers treat "" as "not set").
 */
export function clampInt(raw: string, max: number): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  const n = Number(digits);
  return String(n > max ? max : n);
}

/**
 * Sanitize a raw text value to a decimal string, clamped to `max`.
 * Keeps digits plus a SINGLE decimal separator (accepts "," or "."), so e.g.
 * "1.2.3" collapses to "1.23" and "12,5" stays "12,5". Returns "" when empty.
 */
export function clampDecimal(raw: string, max: number): string {
  let s = raw.replace(/[^0-9.,]/g, "");
  const sep = s.search(/[.,]/);
  if (sep !== -1) {
    s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, "");
  }
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n) && n > max) return String(max);
  return s;
}

/** Parse a sanitized integer-string field. Returns null when empty/invalid. */
export function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse a sanitized decimal-string field (accepts ","). null when empty/invalid. */
export function parseDecimalOrNull(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
