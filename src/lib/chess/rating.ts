import { ChessDomainError } from "./types";

export const RATING_POOLS = ["bullet", "blitz", "rapid", "classical"] as const;
export type RatingPool = (typeof RATING_POOLS)[number];
export type EloScore = 0 | 0.5 | 1;

export type TimeControl = {
  initialMs: number;
  incrementMs: number;
};

export type PlayerRating = {
  rating: number;
  gamesPlayed: number;
  kFactor?: number;
};

export type EloPlayerResult = {
  before: number;
  after: number;
  change: number;
  expectedScore: number;
  score: EloScore;
  kFactor: number;
};

export type EloPairResult = {
  playerA: EloPlayerResult;
  playerB: EloPlayerResult;
};

const finite = (value: number, field: string): number => {
  if (!Number.isFinite(value)) {
    throw new ChessDomainError("INVALID_RATING", `${field} must be finite.`, {
      field,
      value,
    });
  }
  return value;
};

/**
 * Estimates a game's effective duration using forty increment-bearing moves.
 * Boundaries intentionally remain stable so persisted rating pools never drift.
 */
export function ratingPoolForTimeControl(control: TimeControl): RatingPool {
  const initialMs = finite(control.initialMs, "initialMs");
  const incrementMs = finite(control.incrementMs, "incrementMs");
  if (initialMs < 0 || incrementMs < 0) {
    throw new ChessDomainError(
      "INVALID_RATING",
      "Time-control values cannot be negative.",
      { control },
    );
  }

  const estimatedDurationMs = initialMs + 40 * incrementMs;
  if (estimatedDurationMs < 3 * 60_000) return "bullet";
  if (estimatedDurationMs < 10 * 60_000) return "blitz";
  if (estimatedDurationMs < 30 * 60_000) return "rapid";
  return "classical";
}

export const classifyRatingPool = ratingPoolForTimeControl;

export function expectedEloScore(rating: number, opponentRating: number): number {
  finite(rating, "rating");
  finite(opponentRating, "opponentRating");
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function defaultKFactor(player: PlayerRating): number {
  finite(player.rating, "rating");
  if (!Number.isInteger(player.gamesPlayed) || player.gamesPlayed < 0) {
    throw new ChessDomainError(
      "INVALID_RATING",
      "gamesPlayed must be a non-negative integer.",
      { gamesPlayed: player.gamesPlayed },
    );
  }

  if (player.gamesPlayed < 30) return 40;
  return player.rating >= 2400 ? 10 : 20;
}

const validateScore = (score: number): EloScore => {
  if (score !== 0 && score !== 0.5 && score !== 1) {
    throw new ChessDomainError(
      "INVALID_RATING",
      "Elo score must be 0, 0.5, or 1.",
      { score },
    );
  }
  return score;
};

const resolveKFactor = (player: PlayerRating): number => {
  const kFactor = player.kFactor ?? defaultKFactor(player);
  if (!Number.isFinite(kFactor) || kFactor <= 0) {
    throw new ChessDomainError(
      "INVALID_RATING",
      "kFactor must be a finite positive number.",
      { kFactor },
    );
  }
  return kFactor;
};

export function calculateEloChange(options: {
  rating: number;
  opponentRating: number;
  score: EloScore;
  kFactor: number;
}): number {
  const expected = expectedEloScore(options.rating, options.opponentRating);
  const score = validateScore(options.score);
  finite(options.kFactor, "kFactor");
  if (options.kFactor <= 0) {
    throw new ChessDomainError("INVALID_RATING", "kFactor must be positive.");
  }
  return Math.round(options.kFactor * (score - expected));
}

export function calculateEloPair(
  playerA: PlayerRating,
  playerB: PlayerRating,
  scoreA: EloScore,
  options: { ratingFloor?: number } = {},
): EloPairResult {
  finite(playerA.rating, "playerA.rating");
  finite(playerB.rating, "playerB.rating");
  const normalizedScoreA = validateScore(scoreA);
  const scoreB = (1 - normalizedScoreA) as EloScore;
  const expectedA = expectedEloScore(playerA.rating, playerB.rating);
  const expectedB = 1 - expectedA;
  const kA = resolveKFactor(playerA);
  const kB = resolveKFactor(playerB);
  let changeA = Math.round(kA * (normalizedScoreA - expectedA));
  let changeB =
    kA === kB ? -changeA : Math.round(kB * (scoreB - expectedB));
  const floor = options.ratingFloor ?? 100;

  if (!Number.isFinite(floor)) {
    throw new ChessDomainError("INVALID_RATING", "ratingFloor must be finite.");
  }

  const afterA = Math.max(floor, Math.round(playerA.rating + changeA));
  const afterB = Math.max(floor, Math.round(playerB.rating + changeB));
  // Report the effective delta if a configured floor clipped the calculation.
  changeA = afterA - playerA.rating;
  changeB = afterB - playerB.rating;

  return {
    playerA: {
      before: playerA.rating,
      after: afterA,
      change: changeA,
      expectedScore: expectedA,
      score: normalizedScoreA,
      kFactor: kA,
    },
    playerB: {
      before: playerB.rating,
      after: afterB,
      change: changeB,
      expectedScore: expectedB,
      score: scoreB,
      kFactor: kB,
    },
  };
}

export const calculateElo = calculateEloPair;
