"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { ChessRoom } from "@/components/chess/chess-room";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";
import { readMatchmakingSnapshot } from "@/lib/matchmaking/client-state";

type SearchState = "idle" | "searching" | "offline-offer" | "offline-game" | "error";

const timeControls = [
  { value: "1+0", label: "Bullet" },
  { value: "3+2", label: "Blitz" },
  { value: "10+0", label: "Rapid" },
  { value: "15+10", label: "Classical" },
];

const pollDelayMs = 1_800;
const retryDelayMs = 3_500;

function requestMatchmakingCancellation(ticketId: string) {
  return fetch("/api/matchmaking", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticketId, idempotencyKey: crypto.randomUUID() }),
    keepalive: true,
  });
}

export function OnlineMatchmaker() {
  const router = useRouter();
  const [state, setState] = useState<SearchState>("idle");
  const [clock, setClock] = useState("10+0");
  const [color, setColor] = useState("random");
  const [rated, setRated] = useState(false);
  const [allowHousePlayers, setAllowHousePlayers] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const ticketRef = useRef<string | null>(null);
  const searchTokenRef = useRef(0);

  function clearPollTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(
    () => () => {
      searchTokenRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const ticketId = ticketRef.current;
      ticketRef.current = null;
      if (ticketId) void requestMatchmakingCancellation(ticketId).catch(() => undefined);
    },
    [],
  );

  function openMatchedGame(gameId: string) {
    searchTokenRef.current += 1;
    clearPollTimer();
    ticketRef.current = null;
    router.push(`/game/${gameId}`);
  }

  function schedulePoll(ticketId: string, searchToken: number, delay = pollDelayMs) {
    clearPollTimer();
    timerRef.current = window.setTimeout(
      () => void pollTicket(ticketId, searchToken),
      delay,
    );
  }

  async function pollTicket(ticketId: string, searchToken: number) {
    if (searchTokenRef.current !== searchToken || ticketRef.current !== ticketId) return;

    try {
      const response = await fetch("/api/matchmaking", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId, idempotencyKey: crypto.randomUUID() }),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (searchTokenRef.current !== searchToken || ticketRef.current !== ticketId) return;

      if (!response.ok) {
        if (response.status === 401) {
          ticketRef.current = null;
          setState("error");
          setMessage("Your session ended while searching. Sign in again to start a new search.");
          return;
        }
        setMessage("The connection dropped, but your server queue is still durable. Retrying…");
        schedulePoll(ticketId, searchToken, retryDelayMs);
        return;
      }

      const snapshot = readMatchmakingSnapshot(body, ticketId);
      if (snapshot.status === "matched" && snapshot.gameId) {
        openMatchedGame(snapshot.gameId);
        return;
      }
      if (snapshot.status === "cancelled" || snapshot.status === "expired") {
        ticketRef.current = null;
        setState("idle");
        setMessage(
          snapshot.status === "expired"
            ? "That search expired. Start another whenever you’re ready."
            : "Search cancelled.",
        );
        return;
      }
      if (snapshot.status !== "queued" && snapshot.status !== "offered") {
        setMessage("We could not confirm the ticket yet. Retrying its durable state…");
      } else {
        setMessage(null);
      }
      schedulePoll(ticketId, searchToken);
    } catch {
      if (searchTokenRef.current !== searchToken || ticketRef.current !== ticketId) return;
      setMessage("You appear offline. Your existing server queue will be checked again when possible.");
      schedulePoll(ticketId, searchToken, retryDelayMs);
    }
  }

  async function findGame() {
    const searchToken = searchTokenRef.current + 1;
    searchTokenRef.current = searchToken;
    clearPollTimer();
    ticketRef.current = null;
    setState("searching");
    setMessage(null);
    const [minutes, increment] = clock.split("+").map(Number);

    try {
      const response = await fetch("/api/matchmaking", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          variant: "standard",
          baseTimeMs: (minutes ?? 10) * 60_000,
          incrementMs: (increment ?? 0) * 1_000,
          colorPreference: color,
          rated,
          allowHousePlayers: !rated && allowHousePlayers,
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      const snapshot = readMatchmakingSnapshot(body);

      if (searchTokenRef.current !== searchToken) {
        if (snapshot.ticketId) void requestMatchmakingCancellation(snapshot.ticketId).catch(() => undefined);
        return;
      }
      if (snapshot.gameId) {
        openMatchedGame(snapshot.gameId);
        return;
      }
      if (!response.ok) {
        const error = body as { error?: string; code?: string };
        if (response.status === 503) {
          setState("offline-offer");
          setMessage(
            "Online matchmaking is unavailable, so no server game was started. Offline practice is available instead.",
          );
          return;
        }
        setState("error");
        setMessage(error.error ?? "Matchmaking could not be started.");
        return;
      }
      if (!snapshot.ticketId) {
        setState("error");
        setMessage("The server did not return a durable matchmaking ticket. Please try again.");
        return;
      }

      ticketRef.current = snapshot.ticketId;
      schedulePoll(snapshot.ticketId, searchToken);
    } catch {
      if (searchTokenRef.current !== searchToken) return;
      setState("offline-offer");
      setMessage(
        "The service could not be reached, so a server queue could not be confirmed. Offline practice will not sync or affect ratings.",
      );
    }
  }

  async function cancelSearch() {
    searchTokenRef.current += 1;
    clearPollTimer();
    const ticketId = ticketRef.current;
    ticketRef.current = null;
    setState("idle");
    setMessage(ticketId ? "Cancelling your server ticket…" : null);
    if (!ticketId) return;
    try {
      const response = await requestMatchmakingCancellation(ticketId);
      const body: unknown = await response.json().catch(() => ({}));
      const snapshot = readMatchmakingSnapshot(body, ticketId);
      if (snapshot.status === "matched" && snapshot.gameId) {
        openMatchedGame(snapshot.gameId);
        return;
      }
      setMessage(response.ok ? "Search cancelled." : "The ticket will expire automatically if cancellation could not be confirmed.");
    } catch {
      setMessage("You appear offline. The unconfirmed ticket will expire automatically.");
    }
  }

  if (state === "offline-game") {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/15 bg-violet-400/6 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <WifiOff size={17} className="text-violet-300" />
            <span>
              <strong>Offline practice against Nova.</strong> Local AI · not saved · unrated.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
            <X size={15} />Leave practice
          </Button>
        </div>
        <ChessRoom
          mode="ai"
          aiProfileId="nova-knight"
          humanColor={color === "black" ? "b" : "w"}
          initialTimeMs={Number(clock.split("+")[0]) * 60_000}
          incrementMs={Number(clock.split("+")[1]) * 1_000}
        />
      </div>
    );
  }

  const unavailable = state === "offline-offer";
  const heading =
    state === "searching"
      ? "Looking for your match…"
      : unavailable
        ? "Online play isn’t reachable."
        : state === "error"
          ? "Search couldn’t start."
          : "Match on the things that matter.";
  const description =
    state === "searching"
      ? allowHousePlayers && !rated
        ? "We’re checking compatible players. After the configured wait, the server may seat a clearly labeled House Player in this durable game."
        : "We’re checking compatible human players near your clock and rating. You can cancel without penalty."
      : unavailable
        ? "No durable online game was confirmed. You can retry the service or start an explicitly local practice game."
        : state === "error"
          ? "Review the message below, then retry or sign in if your account is required."
          : "Choose a clock, color preference, and competitive setting. The server validates every online move.";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Surface className="relative overflow-hidden p-7 sm:p-9">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <Pill>
            {unavailable ? (
              <WifiOff size={13} className="text-orange-300" />
            ) : (
              <Globe2 size={13} className="text-emerald-400" />
            )}
            {unavailable ? "Offline option" : "Durable matchmaking"}
          </Pill>
          <h2 className="mt-5 text-3xl font-bold tracking-[-.045em] sm:text-4xl">{heading}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
          {message && (
            <div className="mt-5 rounded-xl border border-orange-400/15 bg-orange-400/7 px-4 py-3 text-xs text-orange-200">
              {message}
            </div>
          )}

          {state === "idle" && (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <Select
                  label="Clock"
                  value={clock}
                  onChange={setClock}
                  options={timeControls.map((item) => ({
                    value: item.value,
                    label: `${item.label} · ${item.value}`,
                  }))}
                />
                <Select
                  label="Color"
                  value={color}
                  onChange={setColor}
                  options={[
                    { value: "random", label: "Random" },
                    { value: "white", label: "White" },
                    { value: "black", label: "Black" },
                  ]}
                />
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--text-muted)]">Game type</span>
                  <button
                    onClick={() => setRated((value) => !value)}
                    className={`flex h-11 items-center justify-between rounded-xl border px-3 text-sm font-bold ${
                      rated
                        ? "border-cyan-300/30 bg-cyan-400/8 text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface-soft)]"
                    }`}
                  >
                    {rated ? "Rated" : "Casual"}<ShieldCheck size={15} />
                  </button>
                </label>
              </div>
              {!rated && (
                <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <span>
                    <span className="block text-sm font-bold">Allow a House Player fallback</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      The server uses its configured wait and always labels the opponent.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle"
                    checked={allowHousePlayers}
                    onChange={(event) => setAllowHousePlayers(event.target.checked)}
                  />
                </label>
              )}
            </>
          )}

          {state === "searching" && (
            <div className="mt-8 flex items-center gap-4">
              <span className="relative grid size-14 place-items-center rounded-full border border-cyan-300/20 bg-cyan-400/8">
                <LoaderCircle size={24} className="animate-spin text-[var(--accent)]" />
              </span>
              <div>
                <p className="text-sm font-bold">Searching · {clock} · {color}</p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">Polling your durable server ticket</p>
              </div>
            </div>
          )}

          {unavailable && (
            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-violet-400/15 bg-violet-400/6 p-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-violet-400/12 text-2xl text-violet-300">♞</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Nova offline practice</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Runs in this browser · no online opponent · no saved result</p>
              </div>
              <Pill className="text-violet-300">Local AI</Pill>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {state === "idle" && (
              <Button onClick={() => void findGame()} size="lg">
                <Search size={18} />Find opponent
              </Button>
            )}
            {state === "searching" && (
              <Button onClick={() => void cancelSearch()} variant="secondary">
                Cancel search
              </Button>
            )}
            {unavailable && (
              <>
                <Button onClick={() => void findGame()}>
                  <Search size={17} />Retry online
                </Button>
                {!rated && (
                  <Button variant="secondary" onClick={() => setState("offline-game")}>
                    <Sparkles size={17} />Start offline practice
                  </Button>
                )}
              </>
            )}
            {state === "error" && (
              <>
                <Button onClick={() => void findGame()}>
                  <Search size={17} />Try again
                </Button>
                <ButtonLink href="/auth" variant="secondary">Sign in</ButtonLink>
              </>
            )}
          </div>
        </div>
      </Surface>

      <div className="space-y-5">
        <Surface className="p-5">
          <h3 className="font-bold">Pool snapshot</h3>
          <div className="mt-5 space-y-4">
            <PoolRow icon={Users} label="Players searching" value="8" />
            <PoolRow icon={Clock3} label="Typical pairing" value="&lt; 12s" />
            <PoolRow icon={Bot} label="House pool" value="4 ready" />
          </div>
        </Surface>
        <Surface className="p-5">
          <h3 className="font-bold">Fair-play boundary</h3>
          <ul className="mt-4 space-y-3">
            {[
              "Every move checked server-side",
              "Ratings applied atomically once",
              "House games labeled and separated",
              "Reconnect from durable state",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-5 text-[var(--text-muted)]">
                <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />{item}
              </li>
            ))}
          </ul>
        </Surface>
        {rated && (
          <Surface className="border-orange-400/15 bg-orange-400/6 p-5">
            <p className="text-sm font-bold text-orange-200">Permanent account required</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              Rated queues are human-only at launch. Sign in to protect your rating and competitive history.
            </p>
            <ButtonLink href="/auth" variant="ghost" size="sm" className="mt-3 px-0 text-orange-200">Sign in</ButtonLink>
          </Surface>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold text-[var(--text-muted)]">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 pr-9 text-sm font-bold outline-none focus:border-[var(--accent-muted)]"
        >
          {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-[var(--text-faint)]" />
      </span>
    </label>
  );
}

function PoolRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--accent)]">
        <Icon size={16} />
      </span>
      <span className="flex-1 text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
}
