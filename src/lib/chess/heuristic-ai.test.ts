import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { chooseHeuristicMove, heuristicThinkTimeMs } from "./heuristic-ai";
import { createGameFromFen, replayMoves } from "./rules";

describe("heuristic AI fallback", () => {
  it("returns the same legal move for the same seed and personality", () => {
    const game = replayMoves(["e2e4", "c7c5", "g1f3"]).state;
    const options = { seed: "house-player-7", personality: "tactician" as const };
    const first = chooseHeuristicMove(game.fen, options);
    const second = chooseHeuristicMove(game.fen, options);

    expect(second).toEqual(first);
    expect(first).not.toBeNull();
    const validation = createGameFromFen(game.fen).tryApplyMove(first!.move);
    expect(validation.ok).toBe(true);
  });

  it("always finds a mate in one at full strength", () => {
    const position = replayMoves(["f2f3", "e7e5", "g2g4"]).finalFen;
    const choice = chooseHeuristicMove(position, { strength: 1, seed: "mate" });
    expect(choice).toMatchObject({ uci: "d8h4", selectedRank: 0 });
    expect(choice?.reasons).toContain("checkmate");
  });

  it("does not mutate a supplied chess.js instance", () => {
    const chess = new Chess();
    const before = chess.fen();
    chooseHeuristicMove(chess, { seed: 42, personality: "solid" });
    expect(chess.fen()).toBe(before);
  });

  it("returns null in a terminal position", () => {
    expect(
      chooseHeuristicMove("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
    ).toBeNull();
  });

  it("samples a deterministic, clock-aware think time", () => {
    const options = { seed: 7, positionKey: "abc", minMs: 100, maxMs: 1_000 };
    expect(heuristicThinkTimeMs(options)).toBe(heuristicThinkTimeMs(options));
    expect(heuristicThinkTimeMs({ ...options, timeRemainingMs: 2_000 })).toBeLessThanOrEqual(
      160,
    );
  });
});
