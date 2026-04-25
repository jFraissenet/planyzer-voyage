export function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address.trim(),
  )}`;
}

export function formatPriceValue(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} €`;
  }
}

export function formatPriceRange(
  min: number | null,
  max: number | null,
  locale: string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${formatPriceValue(min, locale)} – ${formatPriceValue(max, locale)}`;
  }
  if (min != null && max == null) return formatPriceValue(min, locale);
  if (min == null && max != null) return `≤ ${formatPriceValue(max, locale)}`;
  return formatPriceValue(min as number, locale);
}

export function formatCapacityRange(
  min: number | null,
  max: number | null,
  t: (k: string, opts?: { count: number }) => string,
  shortKey = "proposals.capacityShort",
  upToKey = "proposals.capacityUpTo",
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min} – ${max}`;
  if (min != null && max == null) return t(shortKey, { count: min });
  if (min == null && max != null) return t(upToKey, { count: max });
  return t(shortKey, { count: min as number });
}
