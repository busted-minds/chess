import { describe, expect, it } from "vitest";

import {
  calculateClockTransition,
  clockFromDatabase,
  clockToDatabase,
  createClock,
  projectClock,
} from "./clock";

const START = "2026-01-01T00:00:00.000Z";

describe("authoritative chess clocks", () => {
  it("subtracts elapsed time, applies Fischer increment, and changes turn", () => {
    const clock = createClock({
      initialTimeMs: 60_000,
      incrementMs: 1_000,
      startedAt: START,
    });
    const transition = calculateClockTransition(
      clock,
      "2026-01-01T00:00:01.500Z",
    );

    expect(transition).toMatchObject({
      elapsedMs: 1_500,
      mover: "w",
      whiteTimeMs: 59_500,
      blackTimeMs: 60_000,
      incrementAppliedMs: 1_000,
      timedOut: false,
    });
    expect(transition.clock).toEqual({
      whiteTimeMs: 59_500,
      blackTimeMs: 60_000,
      incrementMs: 1_000,
      activeColor: "b",
      turnStartedAt: "2026-01-01T00:00:01.500Z",
    });
  });

  it("declares timeout before applying increment or changing active color", () => {
    const clock = createClock({ initialTimeMs: 1_000, incrementMs: 5_000, startedAt: START });
    const transition = calculateClockTransition(
      clock,
      "2026-01-01T00:00:01.000Z",
    );

    expect(transition).toMatchObject({
      timedOut: true,
      loser: "w",
      winner: "b",
      incrementAppliedMs: 0,
    });
    expect(transition.clock.whiteTimeMs).toBe(0);
    expect(transition.clock.activeColor).toBe("w");
    expect(transition.clock.turnStartedAt).toBeNull();
  });

  it("projects locally without mutating the stored snapshot", () => {
    const clock = createClock({ initialTimeMs: 10_000, startedAt: START });
    const projection = projectClock(clock, "2026-01-01T00:00:03.000Z");
    expect(projection.whiteTimeMs).toBe(7_000);
    expect(clock.whiteTimeMs).toBe(10_000);
  });

  it("does not grant time when server timestamps skew backwards", () => {
    const clock = createClock({ initialTimeMs: 10_000, startedAt: START });
    expect(projectClock(clock, "2025-12-31T23:59:59.000Z").whiteTimeMs).toBe(
      10_000,
    );
  });

  it("round-trips database clock field names", () => {
    const database = {
      white_time_ms: 60_000,
      black_time_ms: 58_500,
      increment_ms: 1_000,
      active_color: "b" as const,
      turn_started_at: START,
    };
    expect(clockToDatabase(clockFromDatabase(database))).toEqual(database);
  });
});
