import { describe, expect, it } from "vitest";
import {
  createGameSchema,
  feedbackSchema,
  gameActionSchema,
  moveSubmissionSchema,
  ratingPoolFor,
} from "./schemas";

const requestId = "a4bb189e-8bf9-4ad0-9ff8-13c5ea7b62c7";

describe("trusted API request schemas", () => {
  it("accepts a compact move envelope and rejects authoritative fields", () => {
    expect(
      moveSubmissionSchema.parse({
        move: { from: "e7", to: "e8", promotion: "q" },
        expectedVersion: 18,
        idempotencyKey: requestId,
      }),
    ).toMatchObject({ expectedVersion: 18, move: { promotion: "q" } });

    expect(
      moveSubmissionSchema.safeParse({
        move: { from: "e2", to: "e4" },
        expectedVersion: 0,
        idempotencyKey: requestId,
        resultingFen: "client-controlled",
      }).success,
    ).toBe(false);
  });

  it("strictly bounds optional house-engine attestations", () => {
    expect(
      moveSubmissionSchema.safeParse({
        move: { from: "g8", to: "f6" },
        expectedVersion: 1,
        idempotencyKey: requestId,
        engine: {
          profileId: "nova-knight",
          level: 8,
          version: "stockfish-18-lite",
          seed: "7241901",
        },
      }).success,
    ).toBe(true);
    expect(
      moveSubmissionSchema.safeParse({
        move: { from: "g8", to: "f6" },
        expectedVersion: 1,
        idempotencyKey: requestId,
        engine: {
          level: 6,
          version: "stockfish-18-lite-single",
          seed: "2da48a64-595c-4470-9790-cf9134b1893d-1",
        },
      }).success,
    ).toBe(false);
    expect(
      moveSubmissionSchema.safeParse({
        move: { from: "g8", to: "f6" },
        expectedVersion: 1,
        idempotencyKey: requestId,
        engine: {
          profileId: "nova knight<script>",
          level: 99,
          version: "unknown version",
          seed: "not-a-seed",
        },
      }).success,
    ).toBe(false);
  });

  it("prevents rated custom-position and clockless games", () => {
    expect(
      createGameSchema.safeParse({
        variant: "from_position",
        initialFen: "8/8/8/8/8/8/8/K6k w - - 0 1",
        baseTimeMs: 60_000,
        rated: true,
        idempotencyKey: requestId,
      }).success,
    ).toBe(false);
    expect(
      createGameSchema.safeParse({
        variant: "standard",
        baseTimeMs: 0,
        rated: true,
        idempotencyKey: requestId,
      }).success,
    ).toBe(false);
  });

  it("derives consistent rating pools from estimated game duration", () => {
    expect(ratingPoolFor(60_000, 0)).toBe("bullet");
    expect(ratingPoolFor(180_000, 2_000)).toBe("blitz");
    expect(ratingPoolFor(600_000, 0)).toBe("rapid");
    expect(ratingPoolFor(1_800_000, 0)).toBe("classical");
  });

  it("accepts an authoritative timeout claim without client clock data", () => {
    expect(
      gameActionSchema.safeParse({
        action: "claim_timeout",
        expectedVersion: 7,
        idempotencyKey: requestId,
      }).success,
    ).toBe(true);
    expect(
      gameActionSchema.safeParse({
        action: "claim_timeout",
        expectedVersion: 7,
        idempotencyKey: requestId,
        opponentTimeMs: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts contact-form categories while bounding stored content", () => {
    expect(
      feedbackSchema.safeParse({
        category: "privacy",
        email: "player@example.com",
        message: "Please help me understand the retention policy.",
        idempotencyKey: requestId,
        consent: true,
      }).success,
    ).toBe(true);
    expect(
      feedbackSchema.safeParse({
        category: "privacy",
        email: "player@example.com",
        message: "x".repeat(4_001),
        idempotencyKey: requestId,
      }).success,
    ).toBe(false);
  });
});
