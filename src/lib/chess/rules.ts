import {
  Chess,
  DEFAULT_POSITION,
  type Move,
  type Square,
  validateFen,
} from "chess.js";

import {
  ChessDomainError,
  PROMOTION_PIECES,
  oppositeColor,
  type AppliedMove,
  type ChessColor,
  type FenGameSetup,
  type FinishedGameOutcome,
  type GameOutcome,
  type GameSetup,
  type MoveInput,
  type MoveLike,
  type PositionState,
  type PromotionPiece,
  type ReplayResult,
  type SupportedChessVariant,
} from "./types";

/**
 * chess.js 1.4.0 does not provide a conformance-tested Chess960 rules surface.
 * Keep this off until castling/FEN semantics and replay fixtures are verified.
 */
export const CHESS960_CONFORMANCE_COMPLETE = false as const;

export const CHESS_VARIANT_SUPPORT = {
  standard: true,
  "from-fen": true,
  chess960: CHESS960_CONFORMANCE_COMPLETE,
} as const;

export const isVariantSupported = (
  variant: GameSetup["variant"] = "standard",
): variant is SupportedChessVariant => CHESS_VARIANT_SUPPORT[variant];

const ACTIVE_OUTCOME: GameOutcome = {
  status: "active",
  result: null,
  winner: null,
  termination: null,
};

const drawOutcome = (
  termination: FinishedGameOutcome["termination"],
): FinishedGameOutcome => ({
  status: "finished",
  result: "1/2-1/2",
  winner: null,
  termination,
});

export function detectGameOutcome(chess: Chess): GameOutcome {
  // Checkmate must win over generic draw/game-over predicates.
  if (chess.isCheckmate()) {
    const winner = oppositeColor(chess.turn());
    return {
      status: "finished",
      result: winner === "w" ? "1-0" : "0-1",
      winner,
      termination: "checkmate",
    };
  }

  if (chess.isStalemate()) return drawOutcome("stalemate");
  if (chess.isInsufficientMaterial()) {
    return drawOutcome("insufficient-material");
  }
  if (chess.isThreefoldRepetition()) {
    return drawOutcome("threefold-repetition");
  }
  if (chess.isDrawByFiftyMoves()) return drawOutcome("fifty-move");

  return ACTIVE_OUTCOME;
}

export function hasMatingMaterial(chess: Chess, color: ChessColor): boolean {
  const ownPieces = chess
    .board()
    .flat()
    .filter((piece) => piece?.color === color && piece.type !== "k");

  if (ownPieces.length === 0) return false;
  if (ownPieces.some((piece) => piece && "prq".includes(piece.type))) {
    return true;
  }

  // Two minor pieces can participate in a legal mating position. A lone minor
  // cannot mate a bare king, but may mate when the flagging side has material
  // that can block its own king.
  if (ownPieces.length >= 2) return true;

  const opponentHasNonKingPiece = chess
    .board()
    .flat()
    .some(
      (piece) =>
        piece !== null && piece.color !== color && piece.type !== "k",
    );

  return opponentHasNonKingPiece;
}

export function outcomeFromTimeout(
  chess: Chess,
  loser: ChessColor,
): FinishedGameOutcome {
  const winner = oppositeColor(loser);
  if (!hasMatingMaterial(chess, winner)) return drawOutcome("timeout");

  return {
    status: "finished",
    result: winner === "w" ? "1-0" : "0-1",
    winner,
    termination: "timeout",
  };
}

const parseFenCounters = (
  fen: string,
): { halfmoveClock: number; fullmoveNumber: number } => {
  const fields = fen.split(/\s+/u);
  return {
    halfmoveClock: Number(fields[4] ?? 0),
    fullmoveNumber: Number(fields[5] ?? 1),
  };
};

const verboseMoveToAppliedMove = (move: Move): AppliedMove => {
  const after = new Chess(move.after);
  const promotion = move.promotion as PromotionPiece | undefined;

  return {
    from: move.from,
    to: move.to,
    ...(promotion ? { promotion } : {}),
    color: move.color,
    piece: move.piece,
    ...(move.captured ? { captured: move.captured } : {}),
    san: move.san,
    lan: move.lan,
    uci: `${move.from}${move.to}${promotion ?? ""}`,
    before: move.before,
    after: move.after,
    isCapture: move.isCapture(),
    isPromotion: move.isPromotion(),
    isEnPassant: move.isEnPassant(),
    isKingsideCastle: move.isKingsideCastle(),
    isQueensideCastle: move.isQueensideCastle(),
    givesCheck: after.isCheck(),
    givesCheckmate: after.isCheckmate(),
  };
};

export function normalizeMove(move: MoveLike): MoveInput | string {
  if (typeof move !== "string") return move;

  const value = move.trim();
  const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/iu.exec(value);
  if (!uci) return value;

  const promotion = uci[3]?.toLowerCase() as PromotionPiece | undefined;
  return {
    from: uci[1]?.toLowerCase() as Square,
    to: uci[2]?.toLowerCase() as Square,
    ...(promotion ? { promotion } : {}),
  };
}

const validatedFen = (fen: string): string => {
  const result = validateFen(fen);
  if (!result.ok) {
    throw new ChessDomainError("INVALID_FEN", result.error ?? "Invalid FEN", {
      fen,
    });
  }
  return fen;
};

export class ChessRulesAdapter {
  readonly variant: SupportedChessVariant;
  readonly initialFen: string;
  private readonly chess: Chess;

  constructor(setup: GameSetup = {}) {
    const variant = setup.variant ?? "standard";
    if (!isVariantSupported(variant)) {
      throw new ChessDomainError(
        "UNSUPPORTED_VARIANT",
        "Chess960 is feature-flagged off until rules conformance is complete.",
        { variant },
      );
    }

    this.variant = variant;
    this.initialFen =
      variant === "from-fen" ? validatedFen((setup as FenGameSetup).fen) : DEFAULT_POSITION;

    try {
      this.chess = new Chess(this.initialFen);
    } catch (error) {
      throw new ChessDomainError(
        "INVALID_FEN",
        error instanceof Error ? error.message : "Invalid FEN",
        { fen: this.initialFen },
      );
    }
  }

  get fen(): string {
    return this.chess.fen();
  }

  get pgn(): string {
    return this.chess.pgn();
  }

  get turn(): ChessColor {
    return this.chess.turn();
  }

  timeoutOutcome(loser: ChessColor = this.chess.turn()): FinishedGameOutcome {
    return outcomeFromTimeout(this.chess, loser);
  }

  get history(): AppliedMove[] {
    return this.chess
      .history({ verbose: true })
      .map((move) => verboseMoveToAppliedMove(move));
  }

  status(): PositionState {
    const fen = this.chess.fen();
    const counters = parseFenCounters(fen);
    return {
      variant: this.variant,
      fen,
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      ...counters,
      inCheck: this.chess.isCheck(),
      legalMoveCount: this.chess.moves().length,
      outcome: detectGameOutcome(this.chess),
    };
  }

  legalMoves(square?: Square): AppliedMove[] {
    const moves = square
      ? this.chess.moves({ square, verbose: true })
      : this.chess.moves({ verbose: true });
    return moves.map((move) => verboseMoveToAppliedMove(move));
  }

  promotionOptions(from: Square, to: Square): PromotionPiece[] {
    const seen = new Set<PromotionPiece>();
    for (const move of this.chess.moves({ square: from, verbose: true })) {
      if (move.to !== to || !move.isPromotion() || !move.promotion) continue;
      const promotion = move.promotion as PromotionPiece;
      if (PROMOTION_PIECES.includes(promotion)) seen.add(promotion);
    }
    return PROMOTION_PIECES.filter((piece) => seen.has(piece));
  }

  requiresPromotion(from: Square, to: Square): boolean {
    return this.promotionOptions(from, to).length > 0;
  }

  applyMove(input: MoveLike): AppliedMove {
    const outcome = detectGameOutcome(this.chess);
    if (outcome.status === "finished") {
      throw new ChessDomainError("GAME_OVER", "A move cannot be made after the game ends.", {
        outcome,
      });
    }

    const normalized = normalizeMove(input);
    if (typeof normalized !== "string") {
      const promotions = this.promotionOptions(normalized.from, normalized.to);
      if (promotions.length > 0 && !normalized.promotion) {
        throw new ChessDomainError(
          "INVALID_PROMOTION",
          "A promotion piece is required for this move.",
          { move: normalized, options: promotions },
        );
      }
      if (
        normalized.promotion &&
        !PROMOTION_PIECES.includes(normalized.promotion)
      ) {
        throw new ChessDomainError("INVALID_PROMOTION", "Invalid promotion piece.", {
          move: normalized,
        });
      }
    }

    try {
      const move = this.chess.move(normalized, { strict: true });
      return verboseMoveToAppliedMove(move);
    } catch (error) {
      throw new ChessDomainError(
        "INVALID_MOVE",
        error instanceof Error ? error.message : "Illegal move",
        { input, fen: this.chess.fen() },
      );
    }
  }

  tryApplyMove(
    input: MoveLike,
  ): { ok: true; move: AppliedMove; state: PositionState } | { ok: false; error: ChessDomainError } {
    try {
      const move = this.applyMove(input);
      return { ok: true, move, state: this.status() };
    } catch (error) {
      if (error instanceof ChessDomainError) return { ok: false, error };
      throw error;
    }
  }

  undo(): AppliedMove | null {
    const move = this.chess.undo();
    return move ? verboseMoveToAppliedMove(move) : null;
  }

  clone(): ChessRulesAdapter {
    const cloned = new ChessRulesAdapter(
      this.variant === "standard"
        ? { variant: "standard" }
        : { variant: "from-fen", fen: this.initialFen },
    );
    for (const move of this.history) cloned.applyMove(move.uci);
    return cloned;
  }
}

export const createRulesAdapter = (setup: GameSetup = {}): ChessRulesAdapter =>
  new ChessRulesAdapter(setup);

export const createStandardGame = (): ChessRulesAdapter =>
  createRulesAdapter({ variant: "standard" });

export const createGameFromFen = (fen: string): ChessRulesAdapter =>
  createRulesAdapter({ variant: "from-fen", fen });

/** A concise alias for call sites that do not need to name the adapter. */
export const createGame = createRulesAdapter;

export function replayMoves(
  moves: readonly MoveLike[],
  initialFen = DEFAULT_POSITION,
): ReplayResult {
  const game = createRulesAdapter(
    initialFen === DEFAULT_POSITION
      ? { variant: "standard" }
      : { variant: "from-fen", fen: initialFen },
  );
  const applied: AppliedMove[] = [];

  for (const [index, move] of moves.entries()) {
    try {
      applied.push(game.applyMove(move));
    } catch (error) {
      throw new ChessDomainError(
        "REPLAY_FAILED",
        `Replay failed at ply ${index + 1}: ${
          error instanceof Error ? error.message : "illegal move"
        }`,
        { ply: index + 1, move, cause: error },
      );
    }
  }

  return {
    initialFen,
    finalFen: game.fen,
    pgn: game.pgn,
    moves: applied,
    state: game.status(),
  };
}

export function applyMoveToFen(
  fen: string,
  move: MoveLike,
): { move: AppliedMove; state: PositionState } {
  const game = createGameFromFen(fen);
  const applied = game.applyMove(move);
  return { move: applied, state: game.status() };
}

export function getPromotionOptions(
  fen: string,
  from: Square,
  to: Square,
): PromotionPiece[] {
  return createGameFromFen(fen).promotionOptions(from, to);
}

export const requiresPromotion = (
  fen: string,
  from: Square,
  to: Square,
): boolean => getPromotionOptions(fen, from, to).length > 0;

export const isPromotionPiece = (value: string): value is PromotionPiece =>
  PROMOTION_PIECES.includes(value as PromotionPiece);
