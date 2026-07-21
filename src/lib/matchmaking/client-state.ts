export type MatchmakingTicketStatus =
  | "queued"
  | "offered"
  | "matched"
  | "cancelled"
  | "expired";

export type MatchmakingSnapshot = {
  ticketId: string | null;
  status: MatchmakingTicketStatus | null;
  gameId: string | null;
};

const statuses = new Set<MatchmakingTicketStatus>([
  "queued",
  "offered",
  "matched",
  "cancelled",
  "expired",
]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringField = (
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    if (typeof record?.[key] === "string") return record[key];
  }
  return null;
};

/**
 * Normalizes both RPC responses and durable ticket rows. Supabase rows retain
 * snake_case while API helpers also expose top-level camelCase aliases.
 */
export function readMatchmakingSnapshot(
  value: unknown,
  expectedTicketId?: string | null,
): MatchmakingSnapshot {
  const root = asRecord(value);
  const data = asRecord(root?.data);
  const advanced = asRecord(root?.advanced) ?? asRecord(data?.advanced);
  const ticketsValue = root?.tickets ?? data?.tickets;
  const tickets = Array.isArray(ticketsValue)
    ? ticketsValue.map(asRecord).filter((ticket) => ticket !== null)
    : [];
  const ticket =
    tickets.find(
      (candidate) =>
        !expectedTicketId || stringField(candidate, "id", "ticketId", "ticket_id") === expectedTicketId,
    ) ?? null;

  const source = ticket ?? advanced ?? data ?? root;
  const statusValue = stringField(source, "status");
  const status =
    statusValue && statuses.has(statusValue as MatchmakingTicketStatus)
      ? (statusValue as MatchmakingTicketStatus)
      : null;

  return {
    ticketId:
      stringField(ticket, "id", "ticketId", "ticket_id") ??
      stringField(advanced, "ticketId", "ticket_id") ??
      stringField(data, "ticketId", "ticket_id") ??
      stringField(root, "ticketId", "ticket_id"),
    status,
    gameId:
      stringField(ticket, "matchedGameId", "matched_game_id", "gameId", "game_id") ??
      stringField(advanced, "gameId", "game_id", "matchedGameId", "matched_game_id") ??
      stringField(data, "gameId", "game_id", "matchedGameId", "matched_game_id") ??
      stringField(root, "gameId", "game_id", "matchedGameId", "matched_game_id"),
  };
}
