import { describe, expect, it } from "vitest";

import {
  getOpeningName,
  openingContinuations,
  recognizeOpening,
  recognizeOpeningFromPgn,
} from "./openings";

describe("curated opening recognition", () => {
  it("selects the longest matching opening line", () => {
    const match = recognizeOpening([
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1b5",
      "g8f6",
      "e1g1",
    ]);
    expect(match).toMatchObject({
      eco: "C65",
      name: "Ruy López",
      variation: "Berlin Defense",
      ply: 6,
    });
  });

  it("accepts SAN and PGN histories", () => {
    expect(getOpeningName(["e4", "c5", "c3"])).toBe(
      "Sicilian Defense: Alapin",
    );
    expect(recognizeOpeningFromPgn("1. d4 d5 2. c4 e6 3. Nc3 Nf6")?.eco).toBe(
      "D30",
    );
  });

  it("falls back to a broad root and returns null for an unknown first move", () => {
    expect(recognizeOpening(["e2e4", "a7a6"])?.eco).toBe("B00");
    expect(recognizeOpening(["a2a3"])).toBeNull();
  });

  it("returns deterministic book continuations", () => {
    const moves = openingContinuations(["e2e4", "c7c5"]);
    expect(moves.map((continuation) => continuation.move)).toEqual([
      "b1c3",
      "c2c3",
      "g1f3",
    ]);
  });
});
