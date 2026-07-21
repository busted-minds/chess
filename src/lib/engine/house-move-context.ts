import { z } from "zod";

const engineProfileSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u);

const engineVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._+:-]*$/u);

export const houseMoveContextSchema = z
  .object({
    house_player_id: z.uuid(),
    engine_profile: engineProfileSchema,
    engine_version: engineVersionSchema,
    difficulty: z.number().int().min(1).max(20),
    min_think_ms: z.number().int().min(0).max(60_000),
    max_think_ms: z.number().int().min(50).max(120_000),
    mistake_frequency: z.number().min(0).max(1),
    risk_level: z.number().min(0).max(1),
    tactical_tendency: z.number().min(0).max(1),
    positional_tendency: z.number().min(0).max(1),
    time_management: z.enum(["fast", "balanced", "deliberate", "time-pressure"]),
    opening_weights: z.record(z.string(), z.unknown()),
    deterministic_seed: z.union([
      z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
      z.string().min(1).max(128).regex(/^-?[0-9]+$/u),
    ]),
    expected_version: z.number().int().min(0),
  })
  .strict()
  .refine((context) => context.max_think_ms >= context.min_think_ms, {
    message: "The maximum think time must be at least the minimum think time.",
    path: ["max_think_ms"],
  });

export type HouseMoveContext = z.infer<typeof houseMoveContextSchema>;

export type HouseEngineAttestation = {
  profileId: string;
  level: number;
  version: string;
  seed: string | number;
};

const stableHash = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

/**
 * Uses the approved strength and think-time window. Stockfish does not expose
 * the remaining personality fields as UCI options, so those stay descriptive.
 */
export function stockfishSearchOptionsFor(context: HouseMoveContext): {
  skillLevel: number;
  moveTimeMs: number;
} {
  const range = context.max_think_ms - context.min_think_ms;
  const offset = range === 0
    ? 0
    : stableHash(`${context.deterministic_seed}:${context.expected_version}`) % (range + 1);

  return {
    skillLevel: context.difficulty,
    // The bundled worker enforces an 80 ms floor for a stable UCI search.
    moveTimeMs: Math.max(80, context.min_think_ms + offset),
  };
}

export function houseEngineAttestationFor(context: HouseMoveContext): HouseEngineAttestation {
  return {
    profileId: context.engine_profile,
    level: context.difficulty,
    version: context.engine_version,
    seed: context.deterministic_seed,
  };
}

export function houseEngineAttestationMatches(
  context: HouseMoveContext,
  attestation: HouseEngineAttestation,
): boolean {
  return attestation.profileId === context.engine_profile &&
    attestation.level === context.difficulty &&
    attestation.version === context.engine_version &&
    String(attestation.seed) === String(context.deterministic_seed);
}
