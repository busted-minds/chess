import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, logServerEvent, parseJson, requestIdFor } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { authenticateRequest, rejectUntrustedOrigin, sha256Hex } from "@/lib/server/security";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({
  name: z.string().trim().min(3).max(120), description: z.string().trim().max(1200), format: z.enum(["arena", "swiss", "private"]), visibility: z.enum(["public", "unlisted", "private"]), startsAt: z.string().datetime({ local: true }), baseMinutes: z.number().int().min(1).max(1440), incrementSeconds: z.number().int().min(0).max(600), maxPlayers: z.number().int().min(2).max(512), rounds: z.number().int().min(2).max(15), durationMinutes: z.number().int().min(20).max(480), rated: z.boolean(), allowHousePlayers: z.boolean(), allowLateJoin: z.boolean(),
});

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 72) || "tournament";
const ratingPool = (minutes: number) => minutes < 3 ? "bullet" : minutes < 10 ? "blitz" : minutes < 30 ? "rapid" : "classical";

export async function POST(request: NextRequest) {
  const requestId = requestIdFor(request);
  const rejected = rejectUntrustedOrigin(request, requestId);
  if (rejected) return rejected;
  const auth = await authenticateRequest(requestId);
  if ("response" in auth) return auth.response;
  if (auth.user.is_anonymous) return apiError(403, "FORBIDDEN", "Upgrade to a permanent account before creating a tournament.", { requestId });
  const limited = await consumeRateLimit({ request, actorId: auth.user.id, scope: "tournament_create", limit: 5, windowSeconds: 3600 });
  if (!limited.allowed) return apiError(429, "RATE_LIMITED", "Too many tournament creation attempts. Try again later.", { requestId, headers: { "Retry-After": String(limited.retryAfterSeconds ?? 3600) } });
  const parsed = await parseJson(request, schema, requestId);
  if (parsed.response) return parsed.response;
  const start = new Date(parsed.data.startsAt);
  const now = Date.now();
  if (!Number.isFinite(start.getTime()) || start.getTime() < now + 5 * 60_000 || start.getTime() > now + 366 * 24 * 60 * 60_000) return apiError(422, "VALIDATION_ERROR", "Choose a start time between five minutes and one year from now.", { requestId });
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !/^[a-zA-Z0-9._:-]{8,128}$/u.test(key)) return apiError(400, "BAD_REQUEST", "A valid idempotency key is required.", { requestId });
  const admin = getSupabaseAdminClient();
  if (!admin) return apiError(503, "NOT_CONFIGURED", "Tournament services are not configured yet.", { requestId });
  const creationKeyHash = await sha256Hex(`${auth.user.id}:${key}`);
  const { data: existing } = await admin.from("tournaments").select("slug").eq("organizer_id", auth.user.id).contains("rules", { creationKeyHash }).maybeSingle();
  if (existing?.slug) return apiSuccess({ slug: String(existing.slug), repeated: true }, { requestId });
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `${slugify(parsed.data.name)}-${suffix}`;
  const endsAt = parsed.data.format === "arena" ? new Date(start.getTime() + parsed.data.durationMinutes * 60_000).toISOString() : null;
  const rules = { creationKeyHash, pairingFormat: parsed.data.format, durationMinutes: parsed.data.format === "arena" ? parsed.data.durationMinutes : undefined };
  const { data, error } = await admin.from("tournaments").insert({ slug, name: parsed.data.name, description: parsed.data.description, tournament_type: parsed.data.format, visibility: parsed.data.visibility, status: "registration", organizer_id: auth.user.id, variant: "standard", rating_pool: ratingPool(parsed.data.baseMinutes), rated: parsed.data.rated, base_time_ms: parsed.data.baseMinutes * 60_000, increment_ms: parsed.data.incrementSeconds * 1000, starts_at: start.toISOString(), registration_closes_at: start.toISOString(), ends_at: endsAt, min_players: 2, max_players: parsed.data.maxPlayers, allow_late_join: parsed.data.allowLateJoin && parsed.data.format === "arena", allow_house_players: parsed.data.allowHousePlayers, total_rounds: parsed.data.format === "swiss" ? parsed.data.rounds : null, rules }).select("slug").single();
  if (error || !data) { logServerEvent("error", "tournament_create_failed", { requestId, userId: auth.user.id, code: error?.code }); return apiError(500, "INTERNAL_ERROR", "The tournament could not be created.", { requestId }); }
  logServerEvent("info", "tournament_created", { requestId, userId: auth.user.id, slug: data.slug, format: parsed.data.format });
  return apiSuccess({ slug: String(data.slug) }, { status: 201, requestId });
}
