import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createGameFromFen, createStandardGame, type ChessRulesAdapter } from "@/lib/chess/rules";

export type AuthoritativeGameRow = {
  id: string;
  variant: "standard" | "chess960" | "from_position";
  status: "pending" | "active" | "completed" | "aborted";
  rated: boolean;
  bot_move_policy: "none" | "browser_legal" | "deterministic_server";
  initial_fen: string;
  current_fen: string;
  pgn: string;
  active_color: "white" | "black";
  white_time_ms: number;
  black_time_ms: number;
  increment_ms: number;
  turn_started_at: string | null;
  version: number;
  move_count: number;
  result: "*" | "1-0" | "0-1" | "1/2-1/2";
  termination: string | null;
};

export type ParticipantRow = {
  color: "white" | "black";
  participant_kind: "user" | "house";
  user_id: string | null;
  house_player_id: string | null;
};

export type MoveRow = { ply: number; uci: string };

export type LoadedGame = {
  game: AuthoritativeGameRow;
  participants: ParticipantRow[];
  moves: MoveRow[];
};

export async function loadAuthoritativeGame(
  admin: SupabaseClient,
  gameId: string,
): Promise<{ data: LoadedGame | null; error: { code?: string; message: string } | null }> {
  const [gameResult, participantsResult, movesResult] = await Promise.all([
    admin
      .from("games")
      .select("id,variant,status,rated,bot_move_policy,initial_fen,current_fen,pgn,active_color,white_time_ms,black_time_ms,increment_ms,turn_started_at,version,move_count,result,termination")
      .eq("id", gameId)
      .maybeSingle(),
    admin
      .from("game_participants")
      .select("color,participant_kind,user_id,house_player_id")
      .eq("game_id", gameId),
    admin.from("game_moves").select("ply,uci").eq("game_id", gameId).order("ply"),
  ]);

  const error = gameResult.error ?? participantsResult.error ?? movesResult.error;
  if (error) return { data: null, error };
  if (!gameResult.data) return { data: null, error: null };

  return {
    data: {
      game: gameResult.data as AuthoritativeGameRow,
      participants: (participantsResult.data ?? []) as ParticipantRow[],
      moves: (movesResult.data ?? []) as MoveRow[],
    },
    error: null,
  };
}

export function replayAuthoritativeGame(loaded: LoadedGame): ChessRulesAdapter {
  if (loaded.game.variant === "chess960") {
    throw new Error("Chess960 server validation is not enabled yet.");
  }

  const chess =
    loaded.game.variant === "from_position" && loaded.game.initial_fen !== "start"
      ? createGameFromFen(loaded.game.initial_fen)
      : createStandardGame();

  for (const row of loaded.moves) chess.applyMove(row.uci);

  if (loaded.game.current_fen !== "start" && chess.fen !== loaded.game.current_fen) {
    throw new Error("The durable move list and current game position do not match.");
  }
  return chess;
}

export function participantForUser(loaded: LoadedGame, userId: string): ParticipantRow | null {
  return loaded.participants.find(
    (participant) => participant.participant_kind === "user" && participant.user_id === userId,
  ) ?? null;
}

export const databaseTermination = (termination: string | null): string | null => {
  if (!termination) return null;
  if (termination === "threefold-repetition") return "repetition";
  if (termination === "insufficient-material") return "insufficient_material";
  if (termination === "fifty-move") return "fifty_move";
  return termination;
};
