import { Chess, DEFAULT_POSITION } from "chess.js";

import {
  CURATED_OPENINGS,
  type OpeningDefinition,
} from "../data/openings";
import { createRulesAdapter } from "./rules";
import type { MoveLike } from "./types";

export type OpeningMatch = OpeningDefinition & {
  /** Number of half-moves in the matched definition. */
  ply: number;
  fullName: string;
};

export type OpeningContinuation = {
  move: string;
  openings: readonly OpeningDefinition[];
};

const openingName = (opening: OpeningDefinition): string =>
  opening.variation ? `${opening.name}: ${opening.variation}` : opening.name;

export const toUciMove = (move: {
  from: string;
  to: string;
  promotion?: string;
}): string => `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();

export function normalizeOpeningHistory(
  moves: readonly MoveLike[],
  initialFen = DEFAULT_POSITION,
): string[] {
  const game = createRulesAdapter(
    initialFen === DEFAULT_POSITION
      ? { variant: "standard" }
      : { variant: "from-fen", fen: initialFen },
  );

  return moves.map((move) => game.applyMove(move).uci);
}

export function recognizeOpening(
  moves: readonly MoveLike[],
  options: {
    initialFen?: string;
    openings?: readonly OpeningDefinition[];
  } = {},
): OpeningMatch | null {
  const initialFen = options.initialFen ?? DEFAULT_POSITION;
  // ECO recognition describes play from the orthodox initial position.
  if (initialFen !== DEFAULT_POSITION) return null;

  const uciMoves = normalizeOpeningHistory(moves, initialFen);
  let best: OpeningDefinition | null = null;

  for (const opening of options.openings ?? CURATED_OPENINGS) {
    if (opening.moves.length > uciMoves.length) continue;
    const matches = opening.moves.every((move, index) => uciMoves[index] === move);
    if (matches && (!best || opening.moves.length > best.moves.length)) best = opening;
  }

  return best
    ? {
        ...best,
        ply: best.moves.length,
        fullName: openingName(best),
      }
    : null;
}

export function tryRecognizeOpening(
  moves: readonly MoveLike[],
  options: Parameters<typeof recognizeOpening>[1] = {},
): OpeningMatch | null {
  try {
    return recognizeOpening(moves, options);
  } catch {
    return null;
  }
}

export function recognizeOpeningFromPgn(pgn: string): OpeningMatch | null {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: false });
    if (chess.getHeaders().FEN && chess.getHeaders().FEN !== DEFAULT_POSITION) {
      return null;
    }
    const uci = chess
      .history({ verbose: true })
      .map((move) => toUciMove(move));
    return recognizeOpening(uci);
  } catch {
    return null;
  }
}

export function openingContinuations(
  moves: readonly MoveLike[],
  openings: readonly OpeningDefinition[] = CURATED_OPENINGS,
): OpeningContinuation[] {
  const history = normalizeOpeningHistory(moves);
  const grouped = new Map<string, OpeningDefinition[]>();

  for (const opening of openings) {
    if (opening.moves.length <= history.length) continue;
    if (!history.every((move, index) => opening.moves[index] === move)) continue;
    const next = opening.moves[history.length];
    if (!next) continue;
    grouped.set(next, [...(grouped.get(next) ?? []), opening]);
  }

  return [...grouped.entries()]
    .sort(([moveA], [moveB]) => moveA.localeCompare(moveB))
    .map(([move, matchingOpenings]) => ({ move, openings: matchingOpenings }));
}

export const getOpeningName = (
  moves: readonly MoveLike[],
): string | null => recognizeOpening(moves)?.fullName ?? null;
