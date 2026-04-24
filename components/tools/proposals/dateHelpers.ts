const pad = (n: number) => n.toString().padStart(2, "0");

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
