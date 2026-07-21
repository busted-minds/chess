import { z } from "zod";

export const uuidSchema = z.uuid();
export const idempotencyKeySchema = z.uuid();

export const createGameSchema = z
  .object({
    variant: z.enum(["standard", "chess960", "from_position"]).default("standard"),
    initialFen: z.string().trim().min(1).max(256).optional(),
    baseTimeMs: z.number().int().min(0).max(86_400_000).default(300_000),
    incrementMs: z.number().int().min(0).max(600_000).default(0),
    rated: z.boolean().default(false),
    visibility: z.enum(["public", "unlisted", "private"]).default("unlisted"),
    colorPreference: z.enum(["white", "black", "random"]).default("random"),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.variant === "from_position" && !value.initialFen) {
      context.addIssue({
        code: "custom",
        path: ["initialFen"],
        message: "A starting FEN is required for a from-position game.",
      });
    }
    if (value.rated && (value.variant !== "standard" || value.baseTimeMs === 0)) {
      context.addIssue({
        code: "custom",
        path: ["rated"],
        message: "Rated games require standard chess and a clock.",
      });
    }
  });

export const joinGameSchema = z
  .object({
    inviteToken: z.string().trim().min(16).max(512).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const moveSubmissionSchema = z
  .object({
    move: z
      .object({
        from: z.string().regex(/^[a-h][1-8]$/u),
        to: z.string().regex(/^[a-h][1-8]$/u),
        promotion: z.enum(["q", "r", "b", "n"]).optional(),
      })
      .strict(),
    engine: z
      .object({
        profileId: z
          .string()
          .trim()
          .min(2)
          .max(64)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u),
        level: z.number().int().min(1).max(20),
        version: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9._+:-]*$/u),
        seed: z.union([
          z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
          z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u),
        ]),
      })
      .strict()
      .optional(),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const gameActionSchema = z
  .object({
    action: z.enum([
      "resign",
      "offer_draw",
      "accept_draw",
      "decline_draw",
      "request_takeback",
      "accept_takeback",
      "decline_takeback",
      "abort",
      "claim_timeout",
      "claim_draw",
    ]),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const matchmakingSchema = z
  .object({
    variant: z.enum(["standard", "chess960"]).default("standard"),
    baseTimeMs: z.number().int().min(30_000).max(86_400_000).default(300_000),
    incrementMs: z.number().int().min(0).max(600_000).default(0),
    rated: z.boolean().default(false),
    colorPreference: z.enum(["white", "black", "random"]).default("random"),
    ratingRange: z.number().int().min(25).max(2_000).default(150),
    allowHousePlayers: z.boolean().default(true),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const cancelMatchmakingSchema = z
  .object({
    ticketId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const chatMessageSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const feedbackSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    category: z.enum([
      "idea",
      "bug",
      "experience",
      "accessibility",
      "feedback",
      "account",
      "safety",
      "privacy",
      "other",
    ]),
    message: z.string().trim().min(10).max(4_000),
    email: z.email().max(254).optional(),
    page: z.string().trim().max(512).optional(),
    consent: z.literal(true).optional(),
    idempotencyKey: idempotencyKeySchema.default(() => crypto.randomUUID()),
    website: z.string().max(200).optional(),
  })
  .strict();

const matchmakingRuleSchema = z
  .object({
    pool: z.enum(["bullet", "blitz", "rapid", "classical", "custom"]),
    botFallbackEnabled: z.boolean().optional(),
    fallbackWaitSeconds: z.number().int().min(0).max(300).optional(),
    initialRatingRange: z.number().int().min(25).max(1_000).optional(),
    ratingRangeGrowthPerSecond: z.number().min(0).max(1_000).optional(),
    maxRatingRange: z.number().int().min(50).max(2_000).optional(),
    casualBotsEnabled: z.boolean().optional(),
    ratedBotsEnabled: z.boolean().optional(),
    tournamentBotsEnabled: z.boolean().optional(),
    maxBotGameRatio: z.number().min(0).max(1).optional(),
  })
  .strict();

const housePlayerConfigSchema = z
  .object({
    id: uuidSchema,
    isEnabled: z.boolean().optional(),
    isListed: z.boolean().optional(),
    estimatedRating: z.number().int().min(400).max(3_000).optional(),
    difficulty: z.number().int().min(1).max(20).optional(),
    allowMatchmaking: z.boolean().optional(),
    allowTournaments: z.boolean().optional(),
    allowRated: z.boolean().optional(),
    ratingMode: z.enum(["fixed", "dynamic"]).optional(),
    paused: z.boolean().optional(),
  })
  .strict();

const featureFlagSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_.-]{2,63}$/u),
    enabled: z.boolean().optional(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
    minimumPopulation: z.number().int().min(0).max(1_000_000).optional(),
    publicConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const adminConfigPatchSchema = z
  .object({
    featureFlags: z.array(featureFlagSchema).max(50).optional(),
    matchmakingRules: z.array(matchmakingRuleSchema).max(5).optional(),
    housePlayers: z.array(housePlayerConfigSchema).max(50).optional(),
    maintenanceMode: z.boolean().optional(),
    announcement: z
      .object({
        slug: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/u).default("primary-banner"),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(1_000),
        severity: z.enum(["info", "success", "warning", "maintenance"]),
        published: z.boolean(),
        startsAt: z.iso.datetime({ offset: true }).optional(),
        endsAt: z.iso.datetime({ offset: true }).optional(),
      })
      .strict()
      .optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .refine(
    ({ featureFlags, matchmakingRules, housePlayers, maintenanceMode, announcement }) =>
      featureFlags !== undefined ||
      matchmakingRules !== undefined ||
      housePlayers !== undefined ||
      maintenanceMode !== undefined ||
      announcement !== undefined,
    { message: "Include at least one configuration change." },
  );

export const ratingPoolFor = (baseTimeMs: number, incrementMs: number) => {
  const estimatedDuration = baseTimeMs + incrementMs * 40;
  if (estimatedDuration < 180_000) return "bullet" as const;
  if (estimatedDuration < 600_000) return "blitz" as const;
  if (estimatedDuration < 1_800_000) return "rapid" as const;
  return "classical" as const;
};
