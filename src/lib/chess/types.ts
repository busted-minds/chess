import type {
  Color as ChessJsColor,
  PieceSymbol,
  Square,
} from "chess.js";

export type ChessColor = ChessJsColor;
export type { PieceSymbol, Square };

export type ChessVariant = "standard" | "from-fen" | "chess960";
export type SupportedChessVariant = Exclude<ChessVariant, "chess960">;

export type StandardGameSetup = {
  variant?: "standard";
};

export type FenGameSetup = {
  variant: "from-fen";
  fen: string;
};

export type Chess960GameSetup = {
  variant: "chess960";
  /** Reserved for the eventual conformance-tested Chess960 adapter. */
  position?: number;
  fen?: string;
};

export type GameSetup =
  | StandardGameSetup
  | FenGameSetup
  | Chess960GameSetup;

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

export type MoveInput = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};

export type MoveLike = MoveInput | string;

export type AppliedMove = MoveInput & {
  color: ChessColor;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  san: string;
  lan: string;
  uci: string;
  before: string;
  after: string;
  isCapture: boolean;
  isPromotion: boolean;
  isEnPassant: boolean;
  isKingsideCastle: boolean;
  isQueensideCastle: boolean;
  givesCheck: boolean;
  givesCheckmate: boolean;
};

export type GameResult = "1-0" | "0-1" | "1/2-1/2";

export type GameTermination =
  | "checkmate"
  | "stalemate"
  | "threefold-repetition"
  | "insufficient-material"
  | "fifty-move"
  | "timeout";

export type ActiveGameOutcome = {
  status: "active";
  result: null;
  winner: null;
  termination: null;
};

export type FinishedGameOutcome = {
  status: "finished";
  result: GameResult;
  winner: ChessColor | null;
  termination: GameTermination;
};

export type GameOutcome = ActiveGameOutcome | FinishedGameOutcome;

export type PositionState = {
  variant: SupportedChessVariant;
  fen: string;
  pgn: string;
  turn: ChessColor;
  fullmoveNumber: number;
  halfmoveClock: number;
  inCheck: boolean;
  legalMoveCount: number;
  outcome: GameOutcome;
};

export type ReplayResult = {
  initialFen: string;
  finalFen: string;
  pgn: string;
  moves: AppliedMove[];
  state: PositionState;
};

export type ChessDomainErrorCode =
  | "INVALID_FEN"
  | "INVALID_MOVE"
  | "INVALID_PROMOTION"
  | "GAME_OVER"
  | "REPLAY_FAILED"
  | "UNSUPPORTED_VARIANT"
  | "INVALID_CLOCK"
  | "INVALID_RATING";

export class ChessDomainError extends Error {
  readonly code: ChessDomainErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ChessDomainErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ChessDomainError";
    this.code = code;
    this.details = details;
  }
}

export const oppositeColor = (color: ChessColor): ChessColor =>
  color === "w" ? "b" : "w";

export const colorName = (color: ChessColor): "white" | "black" =>
  color === "w" ? "white" : "black";
