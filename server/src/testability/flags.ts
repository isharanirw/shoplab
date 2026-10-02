import { ApiError } from '../lib/errors';

/** Every flag ID the server knows. All flags start off. */
export const FLAG_IDS = [
  'f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f10', 'f11', 'f12', 'f13',
  'f14', 'f15', 'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24', 'f25',
] as const;

export type FlagId = (typeof FLAG_IDS)[number];

export const FLAG_PRESETS = ['none', 'all'] as const;
export type FlagPreset = (typeof FLAG_PRESETS)[number];

const known = new Set<string>(FLAG_IDS);

export function isFlagId(value: unknown): value is FlagId {
  return typeof value === 'string' && known.has(value);
}

/** Active IDs in registry order. */
function ordered(ids: Iterable<string>): FlagId[] {
  const set = new Set(ids);
  return FLAG_IDS.filter((id) => set.has(id));
}

const active = new Set<FlagId>();

export function activeFlags(): FlagId[] {
  return ordered(active);
}

export function isActive(id: FlagId): boolean {
  return active.has(id);
}

export function setActiveFlags(ids: Iterable<FlagId>): void {
  active.clear();
  for (const id of ids) active.add(id);
}

export interface ParsedFlagList {
  flags: FlagId[];
  unknown: string[];
}

/** Parses a comma separated list such as the FLAGS environment variable. "all" and "none" are accepted as words. */
export function parseFlagList(text: string | undefined | null): ParsedFlagList {
  const flags = new Set<FlagId>();
  const unknown: string[] = [];
  for (const raw of (text ?? '').split(',')) {
    const token = raw.trim().toLowerCase();
    if (token === '') continue;
    if (token === 'all') FLAG_IDS.forEach((id) => flags.add(id));
    else if (token === 'none') flags.clear();
    else if (isFlagId(token)) flags.add(token);
    else unknown.push(raw.trim());
  }
  return { flags: ordered(flags), unknown };
}

/** Applies the FLAGS environment variable at boot; an unknown ID stops the start with a clear message. */
export function initFlagsFromEnv(text: string | undefined | null): FlagId[] {
  const parsed = parseFlagList(text);
  if (parsed.unknown.length > 0) {
    throw new Error(`FLAGS contains unknown flag IDs: ${parsed.unknown.join(', ')}.`);
  }
  setActiveFlags(parsed.flags);
  return parsed.flags;
}

function readIdList(value: unknown, field: string, errors: Record<string, string>): FlagId[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    errors[field] = 'Must be a list of flag IDs.';
    return [];
  }
  const bad = (value as string[]).filter((v) => !isFlagId(v));
  if (bad.length > 0) {
    errors[field] = `Unknown flag IDs: ${bad.join(', ')}.`;
    return [];
  }
  return value as FlagId[];
}

export interface FlagRequest {
  preset?: FlagPreset;
  enable: FlagId[];
  disable: FlagId[];
}

/** Validates the body of POST /api/test/flags. Every problem is reported together; nothing is applied on error. */
export function parseFlagRequest(body: Record<string, unknown>): FlagRequest {
  const errors: Record<string, string> = {};
  let preset: FlagPreset | undefined;
  if (body.preset !== undefined) {
    if (body.preset === 'none' || body.preset === 'all') preset = body.preset;
    else errors.preset = `Must be one of ${FLAG_PRESETS.join(', ')}.`;
  }
  const enable = readIdList(body.enable, 'enable', errors);
  const disable = readIdList(body.disable, 'disable', errors);
  if (body.preset === undefined && body.enable === undefined && body.disable === undefined) {
    errors.body = 'Send enable, disable or preset.';
  }
  if (Object.keys(errors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please correct the highlighted fields.', { fieldErrors: errors });
  }
  return { preset, enable, disable };
}

/** The next active set: the preset first, then enable, then disable. */
export function nextFlags(current: readonly FlagId[], request: FlagRequest): FlagId[] {
  const next = new Set<FlagId>(request.preset === 'all' ? FLAG_IDS : request.preset === 'none' ? [] : current);
  request.enable.forEach((id) => next.add(id));
  request.disable.forEach((id) => next.delete(id));
  return ordered(next);
}
