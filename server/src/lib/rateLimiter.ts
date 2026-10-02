/**
 * Sliding-window limiter for failed attempts. A key is blocked once it has
 * `max` failures inside the last `windowMs` milliseconds.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.failures.delete(key);
    else this.failures.set(key, list);
    return list;
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  /** Whole seconds until the oldest failure leaves the window (at least 1). */
  retryAfterSeconds(key: string): number {
    const list = this.recent(key);
    const oldest = list[0];
    if (oldest === undefined) return 0;
    return Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.failures.set(key, list);
  }

  clearKey(key: string): void {
    this.failures.delete(key);
  }

  clearAll(): void {
    this.failures.clear();
  }
}
