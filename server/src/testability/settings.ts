/** The active seed scenario, held in memory. Flags live in flags.ts and chaos settings in the chaos engine. */
let scenario = 'default';

export function getScenario(): string {
  return scenario;
}

export function setScenario(next: string): void {
  scenario = next;
}
