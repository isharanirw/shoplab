/** Runtime test settings held in memory. Reset returns them to neutral values. */
export interface ChaosSettings {
  latencyMs: number;
  jitterMs: number;
  failureRate: number;
  paths: string[];
  status: 500 | 503 | 429;
  deterministic: boolean;
}

export const NEUTRAL_CHAOS: ChaosSettings = {
  latencyMs: 0,
  jitterMs: 0,
  failureRate: 0,
  paths: [],
  status: 503,
  deterministic: true,
};

export interface TestSettings {
  scenario: string;
  flags: string[];
  chaos: ChaosSettings;
}

const settings: TestSettings = { scenario: 'default', flags: [], chaos: { ...NEUTRAL_CHAOS } };

export function getTestSettings(): Readonly<TestSettings> {
  return settings;
}

export function resetTestSettings(scenario: string): void {
  settings.scenario = scenario;
  settings.flags = [];
  settings.chaos = { ...NEUTRAL_CHAOS, paths: [] };
}
