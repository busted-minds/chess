import { Chess, type Move } from "chess.js";

import { tryRecognizeOpening } from "./openings";
import type { ChessRulesAdapter } from "./rules";
import type { MoveInput, MoveLike, PromotionPiece } from "./types";

export type HeuristicPersonalityId =
  | "balanced"
  | "tactician"
  | "attacker"
  | "strategist"
  | "solid";

export type HeuristicPersonality = {
  id: string;
  name: string;
  /** Preference weights are normalized to the 0..1 interval. */
  captureBias: number;
  checkBias: number;
  promotionBias: number;
  developmentBias: number;
  positionalBias: number;
  kingSafetyBias: number;
  riskTolerance: number;
  randomness: number;
  mistakeRate: number;
  preferredOpenings: readonly string[];
};

export type HeuristicCandidate = {
  move: MoveInput;
  uci: string;
  san: string;
  score: number;
  reasons: readonly string[];
};

export type HeuristicMoveChoice = HeuristicCandidate & {
  considered: number;
  selectedRank: number;
  personalityId: string;
};

export type HeuristicAiOptions = {
  /** Same position, seed, and options always produce the same answer. */
  seed?: string | number;
  /** 0 is deliberately fallible; 1 always selects the highest scored move. */
  strength?: number;
  personality?:
    | HeuristicPersonalityId
    | (Partial<Omit<HeuristicPersonality, "preferredOpenings">> & {
        preferredOpenings?: readonly string[];
      });
  moveHistory?: readonly MoveLike[];
};

const BASE_PERSONALITY: HeuristicPersonality = {
  id: "balanced",
  name: "Balanced",
  captureBias: 0.65,
  checkBias: 0.6,
  promotionBias: 0.9,
  developmentBias: 0.55,
  positionalBias: 0.55,
  kingSafetyBias: 0.65,
  riskTolerance: 0.45,
  randomness: 0.2,
  mistakeRate: 0.08,
  preferredOpenings: [],
};

export const HEURISTIC_PERSONALITIES: Readonly<
  Record<HeuristicPersonalityId, HeuristicPersonality>
> = {
  balanced: BASE_PERSONALITY,
  tactician: {
    ...BASE_PERSONALITY,
    id: "tactician",
    name: "Tactician",
    captureBias: 0.95,
    checkBias: 0.9,
    positionalBias: 0.3,
    riskTolerance: 0.72,
    randomness: 0.24,
  },
  attacker: {
    ...BASE_PERSONALITY,
    id: "attacker",
    name: "Attacker",
    captureBias: 0.8,
    checkBias: 1,
    kingSafetyBias: 0.35,
    riskTolerance: 0.9,
    randomness: 0.3,
    mistakeRate: 0.12,
  },
  strategist: {
    ...BASE_PERSONALITY,
    id: "strategist",
    name: "Strategist",
    captureBias: 0.5,
    checkBias: 0.45,
    developmentBias: 0.85,
    positionalBias: 0.95,
    kingSafetyBias: 0.75,
    riskTolerance: 0.25,
    randomness: 0.12,
    mistakeRate: 0.04,
  },
  solid: {
    ...BASE_PERSONALITY,
    id: "solid",
    name: "Solid",
    captureBias: 0.48,
    checkBias: 0.35,
    developmentBias: 0.7,
    positionalBias: 0.78,
    kingSafetyBias: 1,
    riskTolerance: 0.08,
    randomness: 0.08,
    mistakeRate: 0.025,
  },
};

const PIECE_VALUE = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20_000,
} as const;

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const normalizePersonality = (
  input: HeuristicAiOptions["personality"],
): HeuristicPersonality => {
  if (typeof input === "string") return HEURISTIC_PERSONALITIES[input] ?? BASE_PERSONALITY;
  if (!input) return BASE_PERSONALITY;

  const merged = { ...BASE_PERSONALITY, ...input };
  return {
    ...merged,
    captureBias: clamp01(merged.captureBias),
    checkBias: clamp01(merged.checkBias),
    promotionBias: clamp01(merged.promotionBias),
    developmentBias: clamp01(merged.developmentBias),
    positionalBias: clamp01(merged.positionalBias),
    kingSafetyBias: clamp01(merged.kingSafetyBias),
    riskTolerance: clamp01(merged.riskTolerance),
    randomness: clamp01(merged.randomness),
    mistakeRate: clamp01(merged.mistakeRate),
    preferredOpenings: merged.preferredOpenings ?? [],
  };
};

/** FNV-1a gives a small, platform-independent seed without runtime state. */
const hash32 = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const unitRandom = (value: string): number => hash32(value) / 0x1_0000_0000;

const uciForMove = (move: Move): string =>
  `${move.from}${move.to}${move.promotion ?? ""}`;

const inputForMove = (move: Move): MoveInput => ({
  from: move.from,
  to: move.to,
  ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
});

const rankOf = (square: string): number => Number(square[1] ?? 0);
const fileOf = (square: string): number => square.charCodeAt(0) - 96;

const centrality = (square: string): number => {
  const fileDistance = Math.abs(fileOf(square) - 4.5);
  const rankDistance = Math.abs(rankOf(square) - 4.5);
  return Math.max(0, 4 - fileDistance - rankDistance);
};

const startsUndeveloped = (move: Move): boolean => {
  if (move.piece !== "n" && move.piece !== "b") return false;
  const backRank = move.color === "w" ? "1" : "8";
  return move.from.endsWith(backRank);
};

const scoreMove = (
  move: Move,
  personality: HeuristicPersonality,
  strength: number,
  seedMaterial: string,
): HeuristicCandidate => {
  const after = new Chess(move.after);
  const reasons: string[] = [];
  let score = 0;

  if (after.isCheckmate()) {
    score += 1_000_000;
    reasons.push("checkmate");
  } else if (after.isCheck()) {
    score += 85 + 115 * personality.checkBias;
    reasons.push("check");
  }

  if (move.isCapture() && move.captured) {
    const capturedValue = PIECE_VALUE[move.captured];
    score += capturedValue * (0.45 + personality.captureBias);
    reasons.push("capture");
  }

  if (move.isPromotion() && move.promotion) {
    score +=
      (PIECE_VALUE[move.promotion] - PIECE_VALUE.p) *
      (0.75 + personality.promotionBias);
    reasons.push("promotion");
  }

  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    score += 150 * personality.kingSafetyBias;
    reasons.push("king safety");
  } else if (move.piece === "k") {
    score -= 45 * personality.kingSafetyBias;
  }

  if (startsUndeveloped(move)) {
    score += 85 * personality.developmentBias;
    reasons.push("development");
  }

  const centerGain = centrality(move.to) - centrality(move.from);
  score += centerGain * 24 * personality.positionalBias;
  if (centerGain >= 1.5) reasons.push("central control");

  if (move.piece === "p") {
    const advance =
      move.color === "w"
        ? rankOf(move.to) - rankOf(move.from)
        : rankOf(move.from) - rankOf(move.to);
    score += advance * 8 * personality.developmentBias;
  }

  // Limit the opponent's legal choices as a cheap positional proxy.
  score -= after.moves().length * 0.7 * personality.positionalBias;

  const opponent = after.turn();
  if (!after.isCheckmate() && after.isAttacked(move.to, opponent)) {
    const hangingPenalty =
      PIECE_VALUE[move.piece] * (1.1 - personality.riskTolerance) * 0.75;
    score -= hangingPenalty;
    reasons.push("risk");
  }

  // Seeded noise is deliberately small at high strength and never overrules mate.
  const uci = uciForMove(move);
  const noise = (unitRandom(`${seedMaterial}|${uci}|noise`) - 0.5) * 180;
  score += noise * personality.randomness * (1 - strength);

  return {
    move: inputForMove(move),
    uci,
    san: move.san,
    score: Math.round(score * 1000) / 1000,
    reasons,
  };
};

const fenFromPosition = (position: string | Chess | ChessRulesAdapter): string => {
  if (typeof position === "string") return position;
  if (position instanceof Chess) return position.fen();
  return position.fen;
};

export function chooseHeuristicMove(
  position: string | Chess | ChessRulesAdapter,
  options: HeuristicAiOptions = {},
): HeuristicMoveChoice | null {
  const fen = fenFromPosition(position);
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const strength = clamp01(options.strength ?? 0.65);
  const personality = normalizePersonality(options.personality);
  const seed = String(options.seed ?? "busted-minds-fallback-v1");
  const seedMaterial = `${seed}|${fen}|${personality.id}|${strength}`;
  const candidates = legalMoves
    .map((move) => {
      const candidate = scoreMove(move, personality, strength, seedMaterial);
      if (!options.moveHistory || personality.preferredOpenings.length === 0) {
        return candidate;
      }

      const opening = tryRecognizeOpening([...options.moveHistory, candidate.uci]);
      const preferred =
        opening &&
        personality.preferredOpenings.some((preference) => {
          const normalizedPreference = preference.toLocaleLowerCase();
          return (
            opening.eco.toLocaleLowerCase() === normalizedPreference ||
            opening.fullName.toLocaleLowerCase().includes(normalizedPreference)
          );
        });

      return preferred
        ? {
            ...candidate,
            score: candidate.score + 100,
            reasons: [...candidate.reasons, "opening preference"],
          }
        : candidate;
    })
    .sort((candidateA, candidateB) =>
      candidateB.score === candidateA.score
        ? candidateA.uci.localeCompare(candidateB.uci)
        : candidateB.score - candidateA.score,
    );

  let selectedRank = 0;
  const mistakeChance = personality.mistakeRate * (1.25 - strength);
  const mistakeRoll = unitRandom(`${seedMaterial}|mistake`);
  if (strength < 1 && candidates.length > 1 && mistakeRoll < mistakeChance) {
    const maxRank = Math.min(
      candidates.length - 1,
      Math.max(1, Math.ceil((1 - strength) * 6)),
    );
    selectedRank =
      1 + Math.floor(unitRandom(`${seedMaterial}|rank`) * maxRank);
  }

  const selected = candidates[selectedRank] ?? candidates[0];
  if (!selected) return null;
  return {
    ...selected,
    considered: candidates.length,
    selectedRank,
    personalityId: personality.id,
  };
}

export const selectHeuristicMove = chooseHeuristicMove;

export function heuristicThinkTimeMs(options: {
  seed: string | number;
  positionKey: string;
  minMs?: number;
  maxMs?: number;
  timeRemainingMs?: number;
}): number {
  const minMs = Math.max(0, Math.trunc(options.minMs ?? 250));
  const maxMs = Math.max(minMs, Math.trunc(options.maxMs ?? 1_400));
  const roll = unitRandom(`${options.seed}|${options.positionKey}|think`);
  const sampled = Math.round(minMs + (maxMs - minMs) * roll ** 1.5);
  if (options.timeRemainingMs === undefined) return sampled;
  // A fallback bot never intentionally spends more than 8% of its clock here.
  return Math.min(sampled, Math.max(0, Math.trunc(options.timeRemainingMs * 0.08)));
}
