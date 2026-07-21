import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, requestIdFor } from "@/lib/server/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ gameId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = requestIdFor(request);
  const parsedId = z.uuid().safeParse((await context.params).gameId);
  if (!parsedId.success) {
    return apiError(400, "BAD_REQUEST", "The game ID is invalid.", { requestId });
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return apiError(503, "NOT_CONFIGURED", "Online games are unavailable until Supabase is configured.", {
      requestId,
    });
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id,share_id,variant,rules_version,visibility,status,rated,rating_pool,matchmaking_source,bot_move_policy,initial_fen,current_fen,pgn,result,termination,active_color,base_time_ms,white_time_ms,black_time_ms,increment_ms,turn_started_at,first_move_at,ended_at,version,move_count,rematch_of,created_at,updated_at")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (gameError) {
    return apiError(503, "DEPENDENCY_UNAVAILABLE", "The game could not be loaded.", { requestId });
  }
  if (!game) return apiError(404, "NOT_FOUND", "Game not found or not visible to you.", { requestId });

  const [participants, moves, offers, chat] = await Promise.all([
    supabase.from("game_participants").select("id,game_id,color,participant_kind,user_id,house_player_id,display_name_snapshot,avatar_url_snapshot,rating_snapshot,joined_at,last_connected_at,disconnected_at,is_ready").eq("game_id", parsedId.data).order("color"),
    supabase.from("game_moves").select("id,game_id,ply,resulting_version,actor_kind,actor_user_id,actor_house_player_id,color,uci,san,elapsed_ms,clock_after_ms,engine_profile,engine_version,engine_level,created_at").eq("game_id", parsedId.data).order("ply"),
    supabase.from("game_offers").select("id,game_id,offer_type,offered_by_color,offered_by_user_id,status,expires_at,created_at").eq("game_id", parsedId.data).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("game_chat_messages").select("id,game_id,author_kind,author_user_id,author_house_player_id,author_name_snapshot,body,created_at").eq("game_id", parsedId.data).eq("moderation_state", "visible").order("created_at", { ascending: false }).limit(100),
  ]);
  const relatedError = participants.error ?? moves.error ?? offers.error ?? chat.error;
  if (relatedError) {
    return apiError(503, "DEPENDENCY_UNAVAILABLE", "The complete game state could not be loaded.", {
      requestId,
    });
  }

  return apiSuccess(
    {
      game,
      participants: participants.data ?? [],
      moves: moves.data ?? [],
      offers: offers.data ?? [],
      chat: (chat.data ?? []).reverse(),
      serverTime: new Date().toISOString(),
    },
    { requestId },
  );
}
