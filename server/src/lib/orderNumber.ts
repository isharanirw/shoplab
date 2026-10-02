/** The `SL-YYYYMMDD-` part of an order number, with the date in UTC. */
export function orderNumberPrefix(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `SL-${y}${m}${d}-`;
}

/** `SL-YYYYMMDD-NNNN`: the UTC date plus a per-day sequence padded to 4 digits. */
export function formatOrderNumber(date: Date, sequence: number): string {
  return `${orderNumberPrefix(date)}${String(sequence).padStart(4, '0')}`;
}

/** The next sequence for the day of `date`: one more than the highest already used that day, or 1. */
export function nextSequence(existingNumbers: string[], date: Date): number {
  const prefix = orderNumberPrefix(date);
  let highest = 0;
  for (const number of existingNumbers) {
    if (!number.startsWith(prefix)) continue;
    const suffix = number.slice(prefix.length);
    if (/^\d{4,}$/.test(suffix)) highest = Math.max(highest, Number(suffix));
  }
  return highest + 1;
}
