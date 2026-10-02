/**
 * The flash sale always ends at the next 00:00:00 UTC. At exactly midnight the next sale
 * starts and ends 24 hours later, so the countdown never shows a negative or zero value.
 */
export function flashSaleEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function secondsRemaining(now: Date): number {
  return Math.ceil((flashSaleEnd(now).getTime() - now.getTime()) / 1000);
}

/** 3725 becomes "01:02:05". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
