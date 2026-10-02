export interface StarModel {
  /** Whole stars drawn filled (the average rounded to the nearest star, 0 to 5). */
  filled: number;
  empty: number;
  /** The average to one decimal, such as "4.0". */
  valueText: string;
  /** "(28)" when the count is shown, otherwise an empty string. */
  countText: string;
}

/** What the star widget draws for an average rating and review count. */
export function starModel(average: number, count: number, showCount: boolean): StarModel {
  const safe = Number.isFinite(average) ? Math.min(5, Math.max(0, average)) : 0;
  const filled = Math.round(safe);
  return {
    filled,
    empty: 5 - filled,
    valueText: safe.toFixed(1),
    countText: showCount ? `(${Math.max(0, Math.trunc(count))})` : '',
  };
}

/** Parses a numeric attribute value; anything else gives the fallback. */
export function numberAttribute(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
