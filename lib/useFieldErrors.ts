import { useCallback, useState } from "react";

// Generic per-field validation-error state for any form.
//
// Keys are arbitrary field ids (e.g. "title", "servings", or an ingredient's
// row id). Pair with the `clampInt`/`clampDecimal` helpers in formValidation.ts:
// clamp on change to prevent bad input, validate on save to fill these errors,
// and call `clear(field)` from a field's onChangeText so the message disappears
// as soon as the user fixes it.
export function useFieldErrors<K extends string = string>() {
  const [errors, setErrors] = useState<Record<K, string>>(
    {} as Record<K, string>,
  );

  const set = useCallback((field: K, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clear = useCallback((field: K) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setErrors({} as Record<K, string>);
  }, []);

  // Replace the whole map at once — handy after a save-time validation pass.
  const replace = useCallback((next: Record<K, string>) => {
    setErrors(next);
  }, []);

  const has = (field: K) => Boolean(errors[field]);
  const get = (field: K): string | undefined => errors[field];

  return { errors, set, clear, reset, replace, has, get };
}
