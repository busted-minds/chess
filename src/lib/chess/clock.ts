import {
  ChessDomainError,
  oppositeColor,
  type ChessColor,
} from "./types";

export type TimestampInput = Date | string | number;

export type ClockState = {
  whiteTimeMs: number;
  blackTimeMs: number;
  incrementMs: number;
  activeColor: ChessColor;
  /** Null means that the clock has not started or is paused. */
  turnStartedAt: string | null;
};

export type ClockDatabaseFields = {
  white_time_ms: number;
  black_time_ms: number;
  increment_ms: number;
  active_color: ChessColor;
  turn_started_at: string | null;
};

export type ClockProjection = {
  at: string;
  elapsedMs: number;
  whiteTimeMs: number;
  blackTimeMs: number;
  timedOut: boolean;
  loser: ChessColor | null;
  winner: ChessColor | null;
};

export type ClockTransition = ClockProjection & {
  clock: ClockState;
  mover: ChessColor;
  incrementAppliedMs: number;
};

const finiteNonNegativeInteger = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new ChessDomainError(
      "INVALID_CLOCK",
      `${field} must be a finite, non-negative number.`,
      { field, value },
    );
  }
  return Math.trunc(value);
};

const timestampMilliseconds = (input: TimestampInput, field: string): number => {
  const value =
    input instanceof Date
      ? input.getTime()
      : typeof input === "number"
        ? input
        : Date.parse(input);

  if (!Number.isFinite(value)) {
    throw new ChessDomainError("INVALID_CLOCK", `${field} is not a valid timestamp.`, {
      field,
      input,
    });
  }
  return Math.trunc(value);
};

const normalizedClock = (clock: ClockState): ClockState => {
  if (clock.activeColor !== "w" && clock.activeColor !== "b") {
    throw new ChessDomainError("INVALID_CLOCK", "activeColor must be 'w' or 'b'.", {
      activeColor: clock.activeColor,
    });
  }

  if (clock.turnStartedAt !== null) {
    timestampMilliseconds(clock.turnStartedAt, "turnStartedAt");
  }

  return {
    whiteTimeMs: finiteNonNegativeInteger(clock.whiteTimeMs, "whiteTimeMs"),
    blackTimeMs: finiteNonNegativeInteger(clock.blackTimeMs, "blackTimeMs"),
    incrementMs: finiteNonNegativeInteger(clock.incrementMs, "incrementMs"),
    activeColor: clock.activeColor,
    turnStartedAt: clock.turnStartedAt,
  };
};

const isoTimestamp = (input: TimestampInput): string =>
  new Date(timestampMilliseconds(input, "serverNow")).toISOString();

export function createClock(options: {
  initialTimeMs: number;
  incrementMs?: number;
  activeColor?: ChessColor;
  startedAt?: TimestampInput | null;
}): ClockState {
  const startedAt = options.startedAt ?? null;
  return normalizedClock({
    whiteTimeMs: options.initialTimeMs,
    blackTimeMs: options.initialTimeMs,
    incrementMs: options.incrementMs ?? 0,
    activeColor: options.activeColor ?? "w",
    turnStartedAt: startedAt === null ? null : isoTimestamp(startedAt),
  });
}

export function projectClock(
  inputClock: ClockState,
  serverNow: TimestampInput,
): ClockProjection {
  const clock = normalizedClock(inputClock);
  const nowMs = timestampMilliseconds(serverNow, "serverNow");
  const startedMs =
    clock.turnStartedAt === null
      ? nowMs
      : timestampMilliseconds(clock.turnStartedAt, "turnStartedAt");
  // A small clock skew must never add time to a player.
  const elapsedMs = clock.turnStartedAt === null ? 0 : Math.max(0, nowMs - startedMs);
  const activeTime =
    clock.activeColor === "w" ? clock.whiteTimeMs : clock.blackTimeMs;
  const remaining = Math.max(0, activeTime - elapsedMs);
  const timedOut = remaining === 0;
  const loser = timedOut ? clock.activeColor : null;

  return {
    at: new Date(nowMs).toISOString(),
    elapsedMs,
    whiteTimeMs: clock.activeColor === "w" ? remaining : clock.whiteTimeMs,
    blackTimeMs: clock.activeColor === "b" ? remaining : clock.blackTimeMs,
    timedOut,
    loser,
    winner: loser ? oppositeColor(loser) : null,
  };
}

/**
 * Computes the one authoritative write made after a legal move. The caller
 * supplies its trusted server timestamp; no wall clock is read internally.
 */
export function transitionClockAfterMove(
  inputClock: ClockState,
  serverNow: TimestampInput,
  options: { applyIncrement?: boolean } = {},
): ClockTransition {
  const clock = normalizedClock(inputClock);
  const projection = projectClock(clock, serverNow);
  const mover = clock.activeColor;

  if (projection.timedOut) {
    return {
      ...projection,
      mover,
      incrementAppliedMs: 0,
      clock: {
        ...clock,
        whiteTimeMs: projection.whiteTimeMs,
        blackTimeMs: projection.blackTimeMs,
        turnStartedAt: null,
      },
    };
  }

  const incrementAppliedMs =
    options.applyIncrement === false ? 0 : clock.incrementMs;
  const nextColor = oppositeColor(mover);
  const whiteTimeMs =
    mover === "w"
      ? projection.whiteTimeMs + incrementAppliedMs
      : projection.whiteTimeMs;
  const blackTimeMs =
    mover === "b"
      ? projection.blackTimeMs + incrementAppliedMs
      : projection.blackTimeMs;

  return {
    ...projection,
    whiteTimeMs,
    blackTimeMs,
    mover,
    incrementAppliedMs,
    clock: {
      whiteTimeMs,
      blackTimeMs,
      incrementMs: clock.incrementMs,
      activeColor: nextColor,
      turnStartedAt: projection.at,
    },
  };
}

/** Alias named for server mutation code. */
export const calculateClockTransition = transitionClockAfterMove;

export function startClock(
  inputClock: ClockState,
  serverNow: TimestampInput,
): ClockState {
  const clock = normalizedClock(inputClock);
  return { ...clock, turnStartedAt: isoTimestamp(serverNow) };
}

export function pauseClock(
  inputClock: ClockState,
  serverNow: TimestampInput,
): { clock: ClockState; projection: ClockProjection } {
  const clock = normalizedClock(inputClock);
  const projection = projectClock(clock, serverNow);
  return {
    projection,
    clock: {
      ...clock,
      whiteTimeMs: projection.whiteTimeMs,
      blackTimeMs: projection.blackTimeMs,
      turnStartedAt: null,
    },
  };
}

export const clockFromDatabase = (row: ClockDatabaseFields): ClockState => ({
  whiteTimeMs: row.white_time_ms,
  blackTimeMs: row.black_time_ms,
  incrementMs: row.increment_ms,
  activeColor: row.active_color,
  turnStartedAt: row.turn_started_at,
});

export const clockToDatabase = (clock: ClockState): ClockDatabaseFields => ({
  white_time_ms: clock.whiteTimeMs,
  black_time_ms: clock.blackTimeMs,
  increment_ms: clock.incrementMs,
  active_color: clock.activeColor,
  turn_started_at: clock.turnStartedAt,
});
