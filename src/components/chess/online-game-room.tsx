"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChessboardOptions } from "react-chessboard";
import type { Square } from "chess.js";
import { Bot, Check, CircleAlert, ClockAlert, Flag, LoaderCircle, MessageCircle, RefreshCw, Send, Share2, Undo2, Wifi, WifiOff } from "lucide-react";
import { createGameFromFen, type ChessColor, type MoveInput, type PromotionPiece } from "@/lib/chess";
import {
  houseEngineAttestationFor,
  houseMoveContextSchema,
  stockfishSearchOptionsFor,
  type HouseEngineAttestation,
} from "@/lib/engine/house-move-context";
import { browserStockfishIdentity, StockfishClient } from "@/lib/engine/stockfish-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatClock } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";
import { usePreferences } from "@/components/providers/app-providers";
import { boardThemes, minimalPieces } from "@/components/chess/board-themes";

const Chessboard = dynamic(() => import("react-chessboard").then((module) => module.Chessboard), { ssr: false, loading: () => <div className="aspect-square animate-pulse rounded-2xl bg-[var(--surface-raised)]" /> });

type OnlineGame = {
  id: string;
  current_fen: string;
  initial_fen: string;
  status: "pending" | "active" | "completed" | "aborted";
  result: string;
  termination: string | null;
  active_color: "white" | "black";
  white_time_ms: number;
  black_time_ms: number;
  increment_ms: number;
  turn_started_at: string | null;
  version: number;
  move_count: number;
  bot_move_policy: "none" | "browser_legal" | "deterministic_server";
  rated: boolean;
};
type Participant = { color: "white" | "black"; participant_kind: "user" | "house"; user_id: string | null; house_player_id: string | null; display_name_snapshot?: string; rating_before?: number };
type MoveRow = { id?: string; ply: number; uci: string; san: string; created_at?: string };
type ChatRow = { id: string; body: string; author_name_snapshot?: string; created_at: string };
type Snapshot = { game: OnlineGame; participants: Participant[]; moves: MoveRow[]; chat: ChatRow[]; serverTime: string };

export function OnlineGameRoom({ gameId }: { gameId: string }) {
  const { coordinates, boardTheme, pieceSet } = usePreferences();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clock, setClock] = useState({ white: 0, black: 0 });
  const [chatDraft, setChatDraft] = useState("");
  const [premove, setPremove] = useState<MoveInput[]>([]);
  const [copied, setCopied] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const serverOffsetRef = useRef(0);
  const botVersionRef = useRef<number | null>(null);
  const botThinkingVersionRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
      const body = await response.json() as { data?: Snapshot; error?: string } & Partial<Snapshot>;
      if (!response.ok) throw new Error(body.error ?? "The game could not be loaded.");
      const data = (body.data ?? body) as Snapshot;
      serverOffsetRef.current = Date.parse(data.serverTime) - Date.now();
      setSnapshot(data);
      setClock({ white: data.game.white_time_ms, black: data.game.black_time_ms });
      setError(null);
      return data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The game could not be loaded.");
      return null;
    } finally { setLoading(false); }
  }, [gameId]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setConnection("offline")); return; }
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const channel = supabase.channel(`game:${gameId}`, { config: { presence: { key: crypto.randomUUID() } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_moves", filter: `game_id=eq.${gameId}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_chat_messages", filter: `game_id=eq.${gameId}` }, () => void load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") { setConnection("live"); void channel.track({ role: "spectator", at: new Date().toISOString() }); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("offline");
      });
    const online = () => { setConnection("connecting"); void load(); };
    const offline = () => setConnection("offline");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); void supabase.removeChannel(channel); };
  }, [gameId, load]);

  useEffect(() => {
    if (!snapshot || snapshot.game.status !== "active") return;
    const interval = window.setInterval(() => {
      const game = snapshot.game;
      if (!game.turn_started_at) { setClock({ white: game.white_time_ms, black: game.black_time_ms }); return; }
      const now = Date.now() + serverOffsetRef.current;
      const elapsed = Math.max(0, now - Date.parse(game.turn_started_at));
      setClock({ white: game.active_color === "white" ? Math.max(0, game.white_time_ms - elapsed) : game.white_time_ms, black: game.active_color === "black" ? Math.max(0, game.black_time_ms - elapsed) : game.black_time_ms });
    }, 100);
    return () => window.clearInterval(interval);
  }, [snapshot]);

  const me = snapshot?.participants.find((participant) => participant.user_id === userId) ?? null;
  const activeParticipant = snapshot?.participants.find((participant) => participant.color === snapshot.game.active_color) ?? null;
  const myColor = me?.color === "white" ? "w" : me?.color === "black" ? "b" : null;
  const turnColor: ChessColor = snapshot?.game.active_color === "black" ? "b" : "w";
  const isMyTurn = Boolean(myColor && myColor === turnColor);
  const activeClock = snapshot ? clock[snapshot.game.active_color] : null;
  const canClaimTimeout = Boolean(
    me &&
    snapshot?.game.status === "active" &&
    activeParticipant &&
    activeParticipant.color !== me.color &&
    activeClock !== null &&
    activeClock <= 0,
  );

  const submitMove = useCallback(async (
    move: MoveInput,
    engine?: HouseEngineAttestation,
    options: { reloadOnFailure?: boolean } = {},
  ) => {
    if (!snapshot || submittingRef.current) return false;
    submittingRef.current = true;
    setSubmitting(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const response = await fetch(`/api/games/${gameId}/move`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ move, expectedVersion: snapshot.game.version, idempotencyKey, ...(engine ? { engine } : {}) }) });
      const body = await response.json() as { error?: string; code?: string };
      if (!response.ok) throw new Error(body.error ?? "The move was rejected.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The move was rejected.");
      if (options.reloadOnFailure !== false) await load();
      return false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [gameId, load, snapshot]);

  useEffect(() => {
    if (!snapshot || !userId || snapshot.game.status !== "active" || snapshot.game.rated || activeParticipant?.participant_kind !== "house" || !me || snapshot.game.bot_move_policy !== "browser_legal" || botVersionRef.current === snapshot.game.version) return;
    const claimedVersion = snapshot.game.version;
    botVersionRef.current = claimedVersion;
    let cancelled = false;
    let completed = false;
    let engine: StockfishClient | null = null;
    const run = async () => {
      await Promise.resolve();
      setBotThinking(true);
      botThinkingVersionRef.current = claimedVersion;
      try {
        const response = await fetch(`/api/games/${gameId}/house-move-context`, { cache: "no-store" });
        const body = await response.json() as { data?: unknown; error?: string };
        if (!response.ok) throw new Error(body.error ?? "The house-player assignment could not be loaded.");
        const context = houseMoveContextSchema.parse(body.data);
        if (
          context.expected_version !== claimedVersion ||
          context.house_player_id !== activeParticipant.house_player_id
        ) {
          throw new Error("The house-player assignment changed. Reload the latest game state.");
        }
        if (
          context.engine_profile !== browserStockfishIdentity.profileId ||
          context.engine_version !== browserStockfishIdentity.version
        ) {
          throw new Error("This house-player assignment requires a different browser engine build.");
        }
        if (cancelled) return;

        engine = new StockfishClient();
        const uci = await engine.bestMove(
          snapshot.game.current_fen,
          stockfishSearchOptionsFor(context),
        );
        if (!uci || !/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(uci)) {
          throw new Error("The house-player engine did not produce a legal move.");
        }
        if (cancelled) return;

        completed = await submitMove(
          {
            from: uci.slice(0, 2) as Square,
            to: uci.slice(2, 4) as Square,
            ...(uci[4] ? { promotion: uci[4] as PromotionPiece } : {}),
          },
          houseEngineAttestationFor(context),
          { reloadOnFailure: false },
        );
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "The house-player move could not be computed.");
        }
      } finally {
        engine?.destroy();
        if (!completed && botVersionRef.current === claimedVersion) botVersionRef.current = null;
        if (botThinkingVersionRef.current === claimedVersion) {
          botThinkingVersionRef.current = null;
          setBotThinking(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      engine?.destroy();
      if (botVersionRef.current === claimedVersion) botVersionRef.current = null;
    };
  }, [activeParticipant, gameId, me, snapshot, submitMove, userId]);

  useEffect(() => {
    if (!snapshot || !isMyTurn || !premove.length || submitting) return;
    const [next, ...rest] = premove;
    if (!next) return;
    const position = createGameFromFen(snapshot.game.current_fen);
    if (position.tryApplyMove(next).ok) queueMicrotask(() => void submitMove(next).then((ok) => setPremove(ok ? rest : [])));
    else queueMicrotask(() => setPremove([]));
  }, [isMyTurn, premove, snapshot, submitMove, submitting]);

  if (loading) return <div className="grid min-h-[520px] place-items-center"><div className="text-center"><LoaderCircle size={30} className="mx-auto animate-spin text-[var(--accent)]" /><p className="mt-3 text-sm text-[var(--text-muted)]">Loading durable game state…</p></div></div>;
  if (!snapshot) return <Surface className="mx-auto max-w-lg p-8 text-center"><CircleAlert size={30} className="mx-auto text-orange-300" /><h2 className="mt-4 text-2xl font-bold">This board is unavailable.</h2><p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p><div className="mt-6 flex justify-center gap-2"><Button onClick={() => void load()}><RefreshCw size={16} />Retry</Button><ButtonLink href="/play" variant="secondary">Back to play</ButtonLink></div></Surface>;

  const rules = createGameFromFen(snapshot.game.current_fen);
  const legalTargets = selected ? rules.legalMoves(selected).map((move) => move.to) : [];
  const lastMove = snapshot.moves.at(-1)?.uci;
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) { squareStyles[lastMove.slice(0, 2)] = { background: "rgba(255,221,87,.28)" }; squareStyles[lastMove.slice(2, 4)] = { background: "rgba(255,221,87,.38)" }; }
  if (selected) squareStyles[selected] = { background: "rgba(25,198,237,.32)" };
  for (const target of legalTargets) squareStyles[target] = { backgroundImage: "radial-gradient(circle,rgba(4,20,33,.34) 0 17%,transparent 19%)" };
  const orientation = myColor === "b" ? "black" : "white";
  const boardOptions: ChessboardOptions = {
    id: `online-${gameId}`, position: snapshot.game.current_fen, boardOrientation: orientation, squareStyles, showNotation: coordinates, animationDurationInMs: 170,
    ...(pieceSet === "minimal" ? { pieces: minimalPieces } : {}),
    lightSquareStyle: { background: boardThemes[boardTheme].light }, darkSquareStyle: { background: boardThemes[boardTheme].dark }, boardStyle: { borderRadius: "14px", overflow: "hidden", boxShadow: "0 24px 65px rgba(0,0,0,.28)" },
    arrows: premove.map((move) => ({ startSquare: move.from, endSquare: move.to, color: "rgba(167,139,250,.74)" })),
    canDragPiece: ({ piece }) => Boolean(myColor && piece.pieceType.startsWith(myColor) && snapshot.game.status === "active"),
    onPieceDrop: ({ sourceSquare, targetSquare }) => { if (!targetSquare || !myColor) return false; const move = { from: sourceSquare as Square, to: targetSquare as Square }; if (!isMyTurn) { setPremove((current) => [...current, move].slice(0, 3)); return false; } const promotions = rules.promotionOptions(move.from, move.to); if (promotions.length) { setPromotion(move); return false; } void submitMove(move); return true; },
    onSquareClick: ({ square, piece }) => { const target = square as Square; if (selected && selected !== target) { if (!isMyTurn) setPremove((current) => [...current, { from: selected, to: target }].slice(0, 3)); else void submitMove({ from: selected, to: target }); setSelected(null); return; } if (piece && myColor && piece.pieceType.startsWith(myColor)) setSelected(target); else setSelected(null); },
  };
  const topColor = orientation === "white" ? "black" : "white";
  const bottomColor = orientation === "white" ? "white" : "black";

  async function action(actionName: string) {
    if (!snapshot) return;
    const response = await fetch(`/api/games/${gameId}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, expectedVersion: snapshot.game.version, idempotencyKey: crypto.randomUUID() }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) setError(actionName === "claim_timeout" && response.status === 409
      ? "The server clock has not expired yet. The durable clock, not this display, decides the result."
      : (body.error ?? "The action could not be completed."));
    await load();
  }
  async function sendChat() { const message = chatDraft.trim(); if (!message) return; setChatDraft(""); const response = await fetch(`/api/games/${gameId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, idempotencyKey: crypto.randomUUID() }) }); if (!response.ok) setError("The message could not be sent."); await load(); }
  async function copyLink() { await navigator.clipboard.writeText(location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,760px)_360px] xl:items-start xl:justify-center"><div className="mx-auto w-full max-w-[760px]"><OnlinePlayer participant={snapshot.participants.find((item) => item.color === topColor)} color={topColor} time={clock[topColor]} active={snapshot.game.active_color === topColor && snapshot.game.status === "active"} botThinking={botThinking && activeParticipant?.color === topColor} /><div className="relative my-2"><Chessboard options={boardOptions} />{snapshot.game.status !== "active" && <div className="absolute inset-0 grid place-items-center rounded-[14px] bg-[#06111f]/70 backdrop-blur-sm"><div className="rounded-2xl border border-white/15 bg-[#0b1b2b] p-6 text-center"><p className="text-3xl font-black">{snapshot.game.result}</p><p className="mt-2 text-sm capitalize text-[#9eb0c0]">{snapshot.game.termination?.replaceAll("_", " ") ?? snapshot.game.status}</p><ButtonLink href={`/analysis?fen=${encodeURIComponent(snapshot.game.current_fen)}`} className="mt-5">Analyze game</ButtonLink></div></div>}</div><OnlinePlayer participant={snapshot.participants.find((item) => item.color === bottomColor)} color={bottomColor} time={clock[bottomColor]} active={snapshot.game.active_color === bottomColor && snapshot.game.status === "active"} botThinking={botThinking && activeParticipant?.color === bottomColor} />{canClaimTimeout && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/7 p-3"><div className="flex items-center gap-2 text-xs leading-5 text-orange-100"><ClockAlert size={17} className="shrink-0 text-orange-300" /><span>Opponent clock shows zero. The server will verify the authoritative clock.</span></div><Button size="sm" onClick={() => void action("claim_timeout")}><Flag size={15} />Claim win on time</Button></div>}<div className="mt-3 flex items-center justify-between"><Pill className={connection === "live" ? "text-emerald-300" : "text-orange-300"}>{connection === "live" ? <Wifi size={12} /> : <WifiOff size={12} />}{connection === "live" ? "Live · durable" : "Reconnecting"}</Pill><div className="flex gap-1"><button onClick={() => void copyLink()} className="icon-button" aria-label="Copy game link">{copied ? <Check size={16} /> : <Share2 size={16} />}</button><button onClick={() => void load()} className="icon-button" aria-label="Reload game state"><RefreshCw size={16} /></button></div></div>{error && <p className="mt-3 rounded-xl border border-orange-400/15 bg-orange-400/6 p-3 text-xs text-orange-200">{error}</p>}</div><Surface className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><p className="text-sm font-bold">Live room</p><p className="text-[10px] text-[var(--text-faint)]">v{snapshot.game.version} · {snapshot.game.rated ? "Rated" : "Casual"}</p></div><Pill>{myColor ? `You are ${myColor === "w" ? "White" : "Black"}` : "Spectating"}</Pill></div><div className="max-h-64 min-h-56 overflow-auto p-4"><MoveGrid moves={snapshot.moves} /></div><div className="border-t border-[var(--border)] p-4"><div className="mb-3 max-h-40 space-y-2 overflow-auto">{snapshot.chat.map((item) => <div key={item.id} className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"><p className="text-[10px] font-bold text-[var(--accent)]">{item.author_name_snapshot ?? "Player"}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.body}</p></div>)}</div>{me && <div className="flex gap-2"><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void sendChat()} maxLength={500} placeholder="Good game…" aria-label="Game chat message" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs outline-none focus:border-[var(--accent-muted)]" /><Button onClick={() => void sendChat()} size="sm" aria-label="Send message"><Send size={15} /></Button></div>}</div>{me && snapshot.game.status === "active" && <div className="grid grid-cols-3 border-t border-[var(--border)] p-3"><GameAction icon={MessageCircle} label="Offer draw" onClick={() => void action("offer_draw")} /><GameAction icon={Undo2} label="Takeback" onClick={() => void action("request_takeback")} /><GameAction icon={Flag} label="Resign" danger onClick={() => window.confirm("Resign this game?") && void action("resign")} /></div>}</Surface>{promotion && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="text-xl font-bold">Choose promotion</h2><div className="mt-5 grid grid-cols-4 gap-3">{(["q", "r", "b", "n"] as PromotionPiece[]).map((piece) => <button key={piece} onClick={() => { void submitMove({ ...promotion, promotion: piece }); setPromotion(null); }} className="grid aspect-square place-items-center rounded-xl bg-[var(--surface-soft)] text-4xl">{{ q: "♛", r: "♜", b: "♝", n: "♞" }[piece]}</button>)}</div></div></div>}</div>;
}

function OnlinePlayer({ participant, color, time, active, botThinking }: { participant?: Participant; color: "white" | "black"; time: number; active: boolean; botThinking?: boolean }) { return <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${active ? "border-cyan-300/25 bg-cyan-400/7" : "border-[var(--border)] bg-[var(--surface)]"}`}><span className={`grid size-10 place-items-center rounded-xl text-2xl ${color === "white" ? "bg-slate-100 text-slate-800" : "bg-slate-800 text-slate-100"}`}>{color === "white" ? "♔" : "♚"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{participant?.display_name_snapshot ?? (participant?.participant_kind === "house" ? "House Player" : "Waiting for player")}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-faint)]">{participant?.participant_kind === "house" ? <><Bot size={10} />House Player</> : participant?.rating_before ? `${participant.rating_before} rated` : active ? "To move" : "Connected"}{botThinking && <><LoaderCircle size={10} className="ml-1 animate-spin" />thinking</>}</p></div><span className={`rounded-xl px-3 py-1.5 font-mono text-lg font-black ${active ? "bg-[var(--accent)] text-[#031421]" : "bg-[var(--surface-soft)]"}`}>{formatClock(time)}</span></div>; }
function MoveGrid({ moves }: { moves: MoveRow[] }) { if (!moves.length) return <div className="grid min-h-44 place-items-center text-center"><div><p className="text-3xl">♟</p><p className="mt-2 text-xs text-[var(--text-faint)]">Waiting for the first move</p></div></div>; const rows: { number: number; white?: MoveRow; black?: MoveRow }[] = []; for (const move of moves) { const index = Math.floor((move.ply - 1) / 2); rows[index] ??= { number: index + 1 }; if (move.ply % 2) rows[index].white = move; else rows[index].black = move; } return <div className="grid grid-cols-[30px_1fr_1fr] gap-y-1 text-sm">{rows.map((row) => <div className="contents" key={row.number}><span className="py-1.5 text-xs text-[var(--text-faint)]">{row.number}.</span><span className="rounded-lg px-2 py-1.5 font-semibold">{row.white?.san}</span><span className="rounded-lg px-2 py-1.5 font-semibold">{row.black?.san}</span></div>)}</div>; }
function GameAction({ icon: Icon, label, onClick, danger }: { icon: typeof Flag; label: string; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-xl p-2 text-[10px] font-bold ${danger ? "text-red-300 hover:bg-red-400/10" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}><Icon size={16} />{label}</button>; }
