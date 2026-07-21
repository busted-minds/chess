import { describe, expect, it } from "vitest";
import { readMatchmakingSnapshot } from "./client-state";

describe("readMatchmakingSnapshot", () => {
  it("reads the initial queued RPC response", () => {
    expect(
      readMatchmakingSnapshot({ status: "queued", ticket_id: "ticket-a" }),
    ).toEqual({ ticketId: "ticket-a", status: "queued", gameId: null });
  });

  it("selects the requested durable ticket and its matched game", () => {
    expect(
      readMatchmakingSnapshot(
        {
          tickets: [
            { id: "ticket-old", status: "matched", matched_game_id: "game-old" },
            { id: "ticket-new", status: "matched", matched_game_id: "game-new" },
          ],
        },
        "ticket-new",
      ),
    ).toEqual({ ticketId: "ticket-new", status: "matched", gameId: "game-new" });
  });

  it("uses an advanced RPC result when a refreshed row is unavailable", () => {
    expect(
      readMatchmakingSnapshot({
        tickets: [],
        advanced: { status: "matched", ticket_id: "ticket-a", game_id: "game-a" },
      }),
    ).toEqual({ ticketId: "ticket-a", status: "matched", gameId: "game-a" });
  });

  it("preserves terminal ticket status without inventing a game", () => {
    expect(
      readMatchmakingSnapshot({ tickets: [{ id: "ticket-a", status: "expired" }] }, "ticket-a"),
    ).toEqual({ ticketId: "ticket-a", status: "expired", gameId: null });
  });
});
