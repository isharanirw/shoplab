/** The active flag IDs, read once from /api/config when the app starts. Empty means no variants are active. */
let active: ReadonlySet<string> = new Set();

export function setClientFlags(ids: readonly string[]): void {
  active = new Set(ids);
}

export function isOn(id: string): boolean {
  return active.has(id);
}

export function clientFlags(): string[] {
  return [...active].sort();
}

/** Reads the flag IDs from a /api/config response body; anything unexpected gives an empty list. */
export function parseConfigFlags(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const flags = (payload as { flags?: unknown }).flags;
  if (!Array.isArray(flags)) return [];
  return flags.filter((f): f is string => typeof f === 'string');
}

/** Fetches /api/config once. A failure or a slow answer leaves every flag off, so the app starts normally. */
export async function loadClientFlags(timeoutMs = 3000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/config', { credentials: 'same-origin', signal: controller.signal });
    if (response.ok) setClientFlags(parseConfigFlags(await response.json()));
  } catch {
    setClientFlags([]);
  } finally {
    clearTimeout(timer);
  }
}
