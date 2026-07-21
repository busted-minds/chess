import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

import {
  CHESS960_CONFORMANCE_COMPLETE,
  ChessDomainError,
  createGame,
  createGameFromFen,
  createStandardGame,
  hasMatingMaterial,
  outcomeFromTimeout,
  replayMoves,
} from "./index";

describe("ChessRulesAdapter", () => {
  it("starts an orthodox game with twenty legal moves", () => {
    const game = createStandardGame();
    expect(game.turn).toBe("w");
    expect(game.status().legalMoveCount).toBe(20);
    expect(game.status().outcome.status).toBe("active");
  });

  it("applies legal moves without accepting an illegal move", () => {
    const game = createStandardGame();
    const move = game.applyMove("e2e4");
    expect(move).toMatchObject({ from: "e2", to: "e4", san: "e4", uci: "e2e4" });
    expect(game.turn).toBe("b");

    const before = game.fen;
    const attempt = game.tryApplyMove({ from: "e4", to: "e6" });
    expect(attempt.ok).toBe(false);
    expect(game.fen).toBe(before);
  });

  it("detects checkmate and locks the completed game", () => {
    const game = createStandardGame();
    for (const move of ["f2f3", "e7e5", "g2g4", "d8h4"]) game.applyMove(move);

    expect(game.status().outcome).toEqual({
      status: "finished",
      result: "0-1",
      winner: "b",
      termination: "checkmate",
    });
    expect(() => game.applyMove("a2a3")).toThrowError(ChessDomainError);
  });

  it.each([
    ["stalemate", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"],
    ["insufficient-material", "7k/8/8/8/8/8/8/K7 w - - 0 1"],
    ["fifty-move", "7k/8/8/8/8/8/8/K6R w - - 100 51"],
  ] as const)("detects %s from FEN", (termination, fen) => {
    const outcome = createGameFromFen(fen).status().outcome;
    expect(outcome).toMatchObject({
      status: "finished",
      result: "1/2-1/2",
      termination,
    });
  });

  it("detects threefold repetition from replay history", () => {
    const game = createStandardGame();
    for (const move of [
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
      "g1f3",
      "g8f6",
      "f3g1",
      "f6g8",
    ]) {
      game.applyMove(move);
    }

    expect(game.status().outcome).toMatchObject({
      status: "finished",
      termination: "threefold-repetition",
    });
  });

  it("replays a compact move list and reports a failing ply", () => {
    const replay = replayMoves(["e2e4", "e7e5", "g1f3"]);
    expect(replay.moves.map((move) => move.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(replay.state.turn).toBe("b");

    expect(() => replayMoves(["e2e4", "e7e5", "e4e6"])).toThrow(
      /ply 3/u,
    );
  });

  it("provides all promotion choices and requires an explicit selection", () => {
    const game = createGameFromFen("7k/P7/8/8/8/8/8/7K w - - 0 1");
    expect(game.promotionOptions("a7", "a8")).toEqual(["q", "r", "b", "n"]);
    expect(game.requiresPromotion("a7", "a8")).toBe(true);
    expect(() => game.applyMove({ from: "a7", to: "a8" })).toThrow(
      /promotion piece is required/iu,
    );
    expect(game.applyMove({ from: "a7", to: "a8", promotion: "n" })).toMatchObject({
      promotion: "n",
      isPromotion: true,
    });
  });

  it("explicitly rejects Chess960 until conformance is enabled", () => {
    expect(CHESS960_CONFORMANCE_COMPLETE).toBe(false);
    expect(() => createGame({ variant: "chess960", position: 518 })).toThrow(
      /feature-flagged off/iu,
    );
  });

  it("adjudicates timeout as a draw when the non-flagging side cannot mate", () => {
    const bareKings = new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1");
    const loneBishop = new Chess("7k/8/8/8/8/8/6b1/K7 w - - 0 1");

    expect(hasMatingMaterial(bareKings, "b")).toBe(false);
    expect(outcomeFromTimeout(bareKings, "w")).toMatchObject({
      result: "1/2-1/2",
      winner: null,
      termination: "timeout",
    });
    expect(outcomeFromTimeout(loneBishop, "w")).toMatchObject({
      result: "1/2-1/2",
      winner: null,
      termination: "timeout",
    });
  });

  it("awards a timeout win when mating material exists in the durable position", () => {
    const rook = new Chess("7k/8/8/8/8/8/6r1/K7 w - - 0 1");
    const bishopWithOpponentPawn = new Chess("7k/8/8/8/8/8/P5b1/K7 w - - 0 1");

    expect(outcomeFromTimeout(rook, "w")).toMatchObject({
      result: "0-1",
      winner: "b",
      termination: "timeout",
    });
    expect(outcomeFromTimeout(bishopWithOpponentPawn, "w")).toMatchObject({
      result: "0-1",
      winner: "b",
      termination: "timeout",
    });
  });
});
