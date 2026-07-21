import { describe, expect, it } from "vitest";
import {
  houseEngineAttestationFor,
  houseEngineAttestationMatches,
  houseMoveContextSchema,
  stockfishSearchOptionsFor,
} from "./house-move-context";

const context = {
  house_player_id: "10000000-0000-4000-8000-000000000004",
  engine_profile: "stockfish-lite",
  engine_version: "18-lite-wasm",
  difficulty: 8,
  min_think_ms: 250,
  max_think_ms: 1_600,
  mistake_frequency: 0.095,
  risk_level: 0.8,
  tactical_tendency: 0.85,
  positional_tendency: 0.35,
  time_management: "time-pressure" as const,
  opening_weights: { vienna: 2, sicilian: 3 },
  deterministic_seed: 100_004,
  expected_version: 17,
};

describe("house move context", () => {
  it("turns the authoritative context into an exact engine attestation", () => {
    const parsed = houseMoveContextSchema.parse(context);

    expect(houseEngineAttestationFor(parsed)).toEqual({
      profileId: "stockfish-lite",
      level: 8,
      version: "18-lite-wasm",
      seed: 100_004,
    });
  });

  it("requires every supplied attestation field to match the assignment", () => {
    const parsed = houseMoveContextSchema.parse(context);
    const approved = houseEngineAttestationFor(parsed);

    expect(houseEngineAttestationMatches(parsed, approved)).toBe(true);
    expect(houseEngineAttestationMatches(parsed, { ...approved, profileId: "other-profile" })).toBe(false);
    expect(houseEngineAttestationMatches(parsed, { ...approved, level: approved.level + 1 })).toBe(false);
    expect(houseEngineAttestationMatches(parsed, { ...approved, version: "17-lite-wasm" })).toBe(false);
    expect(houseEngineAttestationMatches(parsed, { ...approved, seed: 999_999 })).toBe(false);
  });

  it("derives a stable Stockfish search inside the approved time window", () => {
    const parsed = houseMoveContextSchema.parse(context);
    const first = stockfishSearchOptionsFor(parsed);
    const second = stockfishSearchOptionsFor(parsed);

    expect(first).toEqual(second);
    expect(first.skillLevel).toBe(context.difficulty);
    expect(first.moveTimeMs).toBeGreaterThanOrEqual(context.min_think_ms);
    expect(first.moveTimeMs).toBeLessThanOrEqual(context.max_think_ms);
  });

  it("rejects malformed or internally inconsistent server context", () => {
    expect(houseMoveContextSchema.safeParse({ ...context, max_think_ms: 100 }).success).toBe(false);
    expect(houseMoveContextSchema.safeParse({ ...context, difficulty: 21 }).success).toBe(false);
    expect(houseMoveContextSchema.safeParse({ ...context, unexpected_secret: "nope" }).success).toBe(false);
  });
});
