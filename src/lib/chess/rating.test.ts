import { describe, expect, it } from "vitest";

import {
  calculateEloPair,
  defaultKFactor,
  expectedEloScore,
  ratingPoolForTimeControl,
} from "./rating";

describe("rating pools", () => {
  it.each([
    [{ initialMs: 60_000, incrementMs: 0 }, "bullet"],
    [{ initialMs: 180_000, incrementMs: 0 }, "blitz"],
    [{ initialMs: 300_000, incrementMs: 5_000 }, "blitz"],
    [{ initialMs: 600_000, incrementMs: 0 }, "rapid"],
    [{ initialMs: 1_800_000, incrementMs: 0 }, "classical"],
  ] as const)("maps %o to %s", (control, expected) => {
    expect(ratingPoolForTimeControl(control)).toBe(expected);
  });
});
describe("Elo calculation", () => {
  it("has a symmetric expected score at equal ratings", () => {
    expect(expectedEloScore(1500, 1500)).toBe(0.5);
  });

  it("is zero-sum for equal K factors", () => {
    const result = calculateEloPair(
      { rating: 1500, gamesPlayed: 50, kFactor: 20 },
      { rating: 1700, gamesPlayed: 50, kFactor: 20 },
      1,
    );
    expect(result.playerA.change).toBeGreaterThan(10);
    expect(result.playerA.change + result.playerB.change).toBe(0);
    expect(result.playerA.after).toBe(1500 + result.playerA.change);
  });

  it("uses a larger provisional K factor and a smaller master K factor", () => {
    expect(defaultKFactor({ rating: 1500, gamesPlayed: 5 })).toBe(40);
    expect(defaultKFactor({ rating: 2000, gamesPlayed: 100 })).toBe(20);
    expect(defaultKFactor({ rating: 2450, gamesPlayed: 100 })).toBe(10);
  });

  it("rejects impossible scores", () => {
    expect(() =>
      calculateEloPair(
        { rating: 1500, gamesPlayed: 30 },
        { rating: 1500, gamesPlayed: 30 },
        0.25 as 0.5,
      ),
    ).toThrow(/0, 0.5, or 1/u);
  });
});
