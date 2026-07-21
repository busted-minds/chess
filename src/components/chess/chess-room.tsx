"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChessboardOptions } from "react-chessboard";
import type { Square } from "chess.js";
import {
  Flag,
  FlipHorizontal2,
  Handshake,
  History,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  RotateCcw,
  Settings2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  chooseHeuristicMove,
  createGame,
  createGameFromFen,
  heuristicThinkTimeMs,
  recognizeOpening,
  type AppliedMove,
  type ChessColor,
  type ChessRulesAdapter,
  type HeuristicPersonalityId,
  type MoveInput,
  type PromotionPiece,
} from "@/lib/chess";
import { housePlayers } from "@/lib/data/content";
import { StockfishClient, type EngineLine } from "@/lib/engine/stockfish-client";
import { formatClock } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill, Surface } from "@/components/ui/surface";
import { usePreferences } from "@/components/providers/app-providers";
import { boardThemes, minimalPieces } from "@/components/chess/board-themes";

const Chessboard = dynamic(() => import("react-chessboard").then((module) => module.Chessboard), { ssr: false, loading: () => <div className="aspect-square animate-pulse rounded-2xl bg-[var(--surface-raised)]" /> });

export type ChessRoomMode = "local" | "ai" | "online" | "analysis";

type ChessRoomProps = {
  mode: ChessRoomMode;
  initialFen?: string;
  initialTimeMs?: number;
  incrementMs?: number;
  humanColor?: ChessColor;
  aiProfileId?: string;
  compact?: boolean;
};

type ClockPair = { w: number; b: number };
type PendingPromotion = { from: Square; to: Square };

const promotionSymbols: Record<PromotionPiece, string> = { q: "♛", r: "♜", b: "♝", n: "♞" };
const personalityByProfile: Record<string, HeuristicPersonalityId> = { "nova-knight": "strategist", "ember-rook": "attacker", "sage-bishop": "solid", "pixel-pawn": "balanced" };

function playTone(capture: boolean, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = capture ? 176 : 260;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Audio feedback is optional.
  }
}

function colorLabel(color: ChessColor) { return color === "w" ? "White" : "Black"; }

export function ChessRoom({ mode, initialFen, initialTimeMs = 10 * 60_000, incrementMs = 0, humanColor = "w", aiProfileId = "nova-knight", compact = false }: ChessRoomProps) {
  const createInitial = useCallback(() => initialFen ? createGameFromFen(initialFen) : createGame(), [initialFen]);
  const [game, setGame] = useState<ChessRulesAdapter>(() => createInitial());
  const gameRef = useRef<ChessRulesAdapter>(game);
  const engineRef = useRef<StockfishClient | null>(null);
  const thinkingRef = useRef(false);
  const premoveRef = useRef<MoveInput[]>([]);
  const [premoves, setPremoves] = useState<MoveInput[]>([]);
  const clockRef = useRef<ClockPair>({ w: initialTimeMs, b: initialTimeMs });
  const turnStartedRef = useRef<number | null>(null);
  const initiallyStarted = mode === "ai" && humanColor === "b";
  const { coordinates, sound, boardTheme, pieceSet, updateSetting } = usePreferences();
  const [fen, setFen] = useState(game.fen);
  const [moves, setMoves] = useState<AppliedMove[]>(game.history);
  const [orientation, setOrientation] = useState<ChessColor>(mode === "ai" ? humanColor : "w");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);
  const [clockDisplay, setClockDisplay] = useState<ClockPair>(() => ({ w: initialTimeMs, b: initialTimeMs }));
  const [started, setStarted] = useState(initiallyStarted);
  const [resultOverride, setResultOverride] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Game ready. White to move.");
  const [engineState, setEngineState] = useState<"idle" | "loading" | "thinking" | "fallback">("idle");
  const [evaluation, setEvaluation] = useState<EngineLine | null>(null);
  const [analysisLines, setAnalysisLines] = useState<Record<number, EngineLine>>({});
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fenDraft, setFenDraft] = useState(game.fen);
  const [difficulty, setDifficulty] = useState(5);
  const [confirmMoves, setConfirmMoves] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<MoveInput | null>(null);
  const [zen, setZen] = useState(false);

  const aiProfile = housePlayers.find((player) => player.id === aiProfileId) ?? housePlayers[0];
  const aiColor: ChessColor = humanColor === "w" ? "b" : "w";
  const outcome = game.status().outcome;
  const gameEnded = resultOverride !== null || outcome.status === "finished";
  const opening = recognizeOpening(moves.map((move) => move.uci));

  useEffect(() => {
    if (initiallyStarted && turnStartedRef.current === null) turnStartedRef.current = Date.now();
  }, [initiallyStarted]);

  const refresh = useCallback((move?: AppliedMove) => {
    const current = gameRef.current;
    if (!current) return;
    setFen(current.fen);
    setMoves([...current.history]);
    if (move) {
      setLastMove({ from: move.from, to: move.to });
      setAnnouncement(`${colorLabel(move.color)} played ${move.san}${move.givesCheckmate ? ", checkmate" : move.givesCheck ? ", check" : ""}.`);
      playTone(move.isCapture, sound);
    }
  }, [sound]);

  const settleClock = useCallback((mover: ChessColor) => {
    const now = Date.now();
    const elapsed = turnStartedRef.current === null ? 0 : Math.max(0, now - turnStartedRef.current);
    const next = { ...clockRef.current };
    next[mover] = Math.max(0, next[mover] - elapsed) + incrementMs;
    clockRef.current = next;
    setClockDisplay(next);
    turnStartedRef.current = now;
    setStarted(true);
  }, [incrementMs]);

  const applyNow = useCallback((input: MoveInput, options: { skipConfirmation?: boolean } = {}) => {
    const current = gameRef.current;
    if (!current || gameEnded) return false;
    if (confirmMoves && !options.skipConfirmation && mode !== "analysis") {
      setPendingConfirmation(input);
      return false;
    }
    const mover = current.turn;
    const applied = current.tryApplyMove(input);
    if (!applied.ok) {
      setAnnouncement("That move is not legal in this position.");
      return false;
    }
    settleClock(mover);
    setHint(null);
    setSelectedSquare(null);
    refresh(applied.move);
    return true;
  }, [confirmMoves, gameEnded, mode, refresh, settleClock]);

  const requestMove = useCallback((from: Square, to: Square) => {
    const current = gameRef.current;
    if (!current || gameEnded) return false;
    if (mode === "ai" && current.turn !== humanColor) {
      const queued = [...premoveRef.current, { from, to }].slice(0, 3);
      premoveRef.current = queued;
      setPremoves(queued);
      setAnnouncement(`Premove queued from ${from} to ${to}.`);
      return false;
    }
    const options = current.promotionOptions(from, to);
    if (options.length) {
      setPromotion({ from, to });
      return false;
    }
    return applyNow({ from, to });
  }, [applyNow, gameEnded, humanColor, mode]);

  useEffect(() => {
    if (!started || gameEnded) return;
    const interval = window.setInterval(() => {
      const current = gameRef.current;
      if (!current || turnStartedRef.current === null) return;
      const active = current.turn;
      const elapsed = Date.now() - turnStartedRef.current;
      const display = { ...clockRef.current, [active]: Math.max(0, clockRef.current[active] - elapsed) };
      setClockDisplay(display);
      if (display[active] <= 0) {
        turnStartedRef.current = null;
        setResultOverride(`${colorLabel(active)} lost on time`);
        setAnnouncement(`${colorLabel(active)} lost on time. Game over.`);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [gameEnded, started]);

  useEffect(() => {
    if (mode !== "local") return;
    let cancelled = false;
    try {
      const saved = localStorage.getItem("bm-chess-local-v1");
      if (!saved) return;
      const data = JSON.parse(saved) as { moves?: string[]; clocks?: ClockPair };
      const restored = createInitial();
      for (const move of data.moves ?? []) {
        const result = restored.tryApplyMove(move);
        if (!result.ok) throw result.error;
      }
      queueMicrotask(() => {
        if (cancelled) return;
        gameRef.current = restored;
        setGame(restored);
        if (data.clocks) { clockRef.current = data.clocks; setClockDisplay(data.clocks); }
        refresh();
        setAnnouncement("Your local game was restored.");
      });
    } catch {
      localStorage.removeItem("bm-chess-local-v1");
    }
    return () => { cancelled = true; };
    // Restore exactly once for a local room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "local") return;
    localStorage.setItem("bm-chess-local-v1", JSON.stringify({ moves: moves.map((move) => move.uci), clocks: clockRef.current }));
  }, [mode, moves]);

  useEffect(() => {
    if (mode !== "ai" || gameEnded || game.turn !== aiColor || thinkingRef.current) return;
    let cancelled = false;
    thinkingRef.current = true;
    const positionFen = game.fen;
    const run = async () => {
      let uci: string | null = null;
      if (difficulty >= 3) {
        try {
          setEngineState("loading");
          engineRef.current ??= new StockfishClient();
          setEngineState("thinking");
          uci = await engineRef.current.bestMove(positionFen, {
            moveTimeMs: 180 + difficulty * 105,
            skillLevel: Math.min(20, difficulty * 2),
            elo: 1200 + difficulty * 170,
            onLine: (line) => line.multipv === 1 && setEvaluation(line),
          });
        } catch {
          setEngineState("fallback");
        }
      }
      if (!uci) {
        const choice = chooseHeuristicMove(positionFen, { seed: `${aiProfile.id}-${moves.length}`, strength: difficulty / 10, personality: personalityByProfile[aiProfile.id] ?? "balanced", moveHistory: moves.map((move) => move.uci) });
        uci = choice?.uci ?? null;
        setEngineState("fallback");
      }
      if (!uci || cancelled || gameRef.current?.fen !== positionFen) return;
      const delay = heuristicThinkTimeMs({ seed: aiProfile.id, positionKey: positionFen, minMs: 220, maxMs: 1050, timeRemainingMs: clockRef.current[aiColor] });
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      if (cancelled || !gameRef.current || gameRef.current.fen !== positionFen) return;
      const aiInput = { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, ...(uci[4] ? { promotion: uci[4] as PromotionPiece } : {}) };
      const mover = gameRef.current.turn;
      const result = gameRef.current.tryApplyMove(aiInput);
      if (result.ok) {
        settleClock(mover);
        const nextPremove = premoveRef.current.shift();
        setPremoves([...premoveRef.current]);
        if (nextPremove && gameRef.current.turn === humanColor) {
          const premove = gameRef.current.tryApplyMove(nextPremove);
          if (premove.ok) {
            settleClock(humanColor);
            refresh(premove.move);
          } else {
            premoveRef.current = [];
            setPremoves([]);
            refresh(result.move);
            setAnnouncement("The position changed, so your premove was cancelled.");
          }
        } else refresh(result.move);
      }
      setEngineState("idle");
    };
    run().finally(() => { thinkingRef.current = false; });
    return () => { cancelled = true; };
  }, [aiColor, aiProfile.id, difficulty, game, gameEnded, humanColor, mode, moves, refresh, settleClock]);

  useEffect(() => {
    if (mode !== "analysis" || gameEnded) return;
    let cancelled = false;
    const analyzedFen = fen;
    queueMicrotask(() => {
      if (cancelled) return;
      setAnalysisLines({});
      setEngineState("loading");
    });
    engineRef.current ??= new StockfishClient();
    engineRef.current.bestMove(analyzedFen, {
      depth: 14,
      multiPv: 3,
      onLine: (line) => {
        if (cancelled || line.depth < 5) return;
        setAnalysisLines((current) => ({ ...current, [line.multipv]: line }));
        if (line.multipv === 1) setEvaluation(line);
      },
    }).catch(() => setEngineState("fallback")).finally(() => {
      if (!cancelled) setEngineState("idle");
    });
    return () => {
      cancelled = true;
      engineRef.current?.stop();
    };
  }, [fen, gameEnded, mode]);

  useEffect(() => () => engineRef.current?.destroy(), []);

  const legalTargets = useMemo(() => selectedSquare ? createGameFromFen(fen).legalMoves(selectedSquare).map((move) => move.to) : [], [fen, selectedSquare]);
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) { styles[lastMove.from] = { background: "rgba(255, 221, 87, .28)" }; styles[lastMove.to] = { background: "rgba(255, 221, 87, .38)" }; }
    if (selectedSquare) styles[selectedSquare] = { background: "rgba(25,198,237,.32)" };
    for (const target of legalTargets) styles[target] = { ...(styles[target] ?? {}), backgroundImage: "radial-gradient(circle, rgba(4,20,33,.34) 0 17%, transparent 19%)" };
    return styles;
  }, [lastMove, legalTargets, selectedSquare]);

  const arrows = [
    ...(hint ? [{ startSquare: hint.from, endSquare: hint.to, color: "rgba(255,122,26,.82)" }] : []),
    ...premoves.map((move) => ({ startSquare: move.from, endSquare: move.to, color: "rgba(167,139,250,.74)" })),
  ];

  const boardOptions: ChessboardOptions = {
    id: `bm-${mode}-board`, position: fen, boardOrientation: orientation === "w" ? "white" : "black", showNotation: coordinates,
    animationDurationInMs: 185, arrows, squareStyles,
    ...(pieceSet === "minimal" ? { pieces: minimalPieces } : {}),
    lightSquareStyle: { background: boardThemes[boardTheme].light }, darkSquareStyle: { background: boardThemes[boardTheme].dark },
    boardStyle: { borderRadius: "14px", boxShadow: "0 24px 65px rgba(0,0,0,.28)", overflow: "hidden" },
    canDragPiece: ({ piece }) => {
      if (gameEnded) return false;
      const color = piece.pieceType.startsWith("w") ? "w" : "b";
      if (mode === "ai") return color === humanColor;
      return color === game.turn;
    },
    onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && requestMove(sourceSquare as Square, targetSquare as Square)),
    onSquareClick: ({ square, piece }) => {
      const clicked = square as Square;
      if (selectedSquare && selectedSquare !== clicked) { requestMove(selectedSquare, clicked); return; }
      if (!piece) { setSelectedSquare(null); return; }
      const color = piece.pieceType.startsWith("w") ? "w" : "b";
      if ((mode === "ai" && color === humanColor) || (mode !== "ai" && color === game.turn)) setSelectedSquare(clicked);
    },
    onSquareRightClick: () => setHint(null),
  };

  const undo = () => {
    if (mode === "online") return;
    game.undo();
    if (mode === "ai" && game.history.length) game.undo();
    premoveRef.current = [];
    setPremoves([]);
    setResultOverride(null);
    setHint(null);
    turnStartedRef.current = game.history.length ? Date.now() : null;
    refresh();
    setAnnouncement("Move taken back.");
  };

  const reset = () => {
    engineRef.current?.stop();
    const replacement = createInitial();
    gameRef.current = replacement;
    setGame(replacement);
    clockRef.current = { w: initialTimeMs, b: initialTimeMs };
    setClockDisplay({ ...clockRef.current });
    turnStartedRef.current = mode === "ai" && humanColor === "b" ? Date.now() : null;
    setStarted(turnStartedRef.current !== null);
    setResultOverride(null); setLastMove(null); setHint(null); setEvaluation(null); setSelectedSquare(null); setMoves([]); setFen(replacement.fen);
    premoveRef.current = []; setPremoves([]);
    if (mode === "local") localStorage.removeItem("bm-chess-local-v1");
    setAnnouncement("New game. White to move.");
  };

  const loadFen = () => {
    try {
      const replacement = createGameFromFen(fenDraft.trim());
      gameRef.current = replacement;
      setGame(replacement);
      setFen(replacement.fen); setMoves([]); setLastMove(null); setResultOverride(null); setHint(null); setSelectedSquare(null); setSettingsOpen(false);
      turnStartedRef.current = null; setStarted(false);
      setAnnouncement(`Custom position loaded. ${colorLabel(replacement.turn)} to move.`);
    } catch {
      setAnnouncement("That FEN is not valid. Check all six fields and try again.");
    }
  };

  const requestHint = async () => {
    const fallback = chooseHeuristicMove(game, { seed: `hint-${game.fen}`, strength: .95, personality: "strategist" });
    setHint(fallback ? { from: fallback.move.from, to: fallback.move.to } : null);
    setAnnouncement(fallback ? `Hint: consider ${fallback.san}.` : "There is no legal move in this position.");
  };

  const resultText = resultOverride ?? (outcome.status === "finished" ? `${outcome.result} · ${outcome.termination.replaceAll("-", " ")}` : null);
  const evaluationText = evaluation ? (evaluation.mate !== null ? `M${evaluation.mate}` : `${((evaluation.scoreCp ?? 0) / 100).toFixed(1)}`) : "—";

  return (
    <div className={zen ? "fixed inset-0 z-[70] overflow-auto bg-[var(--page)] p-3 sm:p-6" : ""}>
      <div className={`grid gap-4 ${compact ? "xl:grid-cols-[minmax(0,720px)_330px]" : "xl:grid-cols-[minmax(0,760px)_360px]"} xl:items-start xl:justify-center`}>
        <div className="mx-auto w-full max-w-[760px]">
          <PlayerBar color={orientation === "w" ? "b" : "w"} name={mode === "ai" && aiColor === (orientation === "w" ? "b" : "w") ? aiProfile.name : mode === "local" ? "Player 2" : "Opponent"} rating={mode === "ai" ? aiProfile.rating : null} time={clockDisplay[orientation === "w" ? "b" : "w"]} active={game.turn === (orientation === "w" ? "b" : "w") && !gameEnded} engine={mode === "ai" && aiColor === (orientation === "w" ? "b" : "w") ? engineState : undefined} />
          <div className="relative my-2"><Chessboard options={boardOptions} />{mode === "analysis" && <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-[#06111f]/85 px-2 py-1 font-mono text-xs font-black text-white shadow-lg backdrop-blur">{evaluationText}</div>}{resultText && <div className="absolute inset-0 grid place-items-center rounded-[14px] bg-[#06111f]/72 p-5 backdrop-blur-sm"><div className="max-w-sm rounded-[1.5rem] border border-white/15 bg-[#0b1b2b] p-6 text-center shadow-2xl"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-3xl">♚</div><p className="mt-4 text-2xl font-bold capitalize">{resultText}</p><p className="mt-2 text-sm text-[#9eb0c0]">{moves.length} moves · {opening?.fullName ?? "Unclassified opening"}</p><div className="mt-5 flex justify-center gap-2"><Button onClick={reset}><RotateCcw size={16} />Rematch</Button><ButtonLink href="/analysis" variant="secondary">Analyze</ButtonLink></div></div></div>}</div>
          <PlayerBar color={orientation} name={mode === "local" ? "Player 1" : "You"} rating={mode === "online" ? 1248 : null} time={clockDisplay[orientation]} active={game.turn === orientation && !gameEnded} engine={mode === "ai" && aiColor === orientation ? engineState : undefined} />
          <div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-1"><Control icon={FlipHorizontal2} label="Flip board" onClick={() => setOrientation((current) => current === "w" ? "b" : "w")} /><Control icon={Undo2} label="Take back" onClick={undo} disabled={!moves.length || mode === "online"} /><Control icon={Lightbulb} label="Hint" onClick={requestHint} /><Control icon={sound ? Volume2 : VolumeX} label={sound ? "Mute sounds" : "Enable sounds"} onClick={() => updateSetting("sound", !sound)} /></div><div className="flex items-center gap-1"><Control icon={Settings2} label="Game settings" onClick={() => setSettingsOpen(true)} /><Control icon={zen ? X : Maximize2} label={zen ? "Exit zen mode" : "Zen mode"} onClick={() => setZen((value) => !value)} /></div></div>
        </div>

        {!zen && <Surface className="overflow-hidden">
          <div className="flex items-center border-b border-[var(--border)]"><Tab icon={History} label="Moves" active /><Tab icon={MessageCircle} label={mode === "local" ? "Notes" : "Chat"} /><span className="ml-auto pr-4 font-mono text-xs font-bold text-[var(--accent)]">{evaluationText}</span></div>
          <div className="min-h-72 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">{opening?.name ?? "Opening"}</p><p className="mt-1 text-xs text-[var(--text-faint)]">{opening?.variation ?? (moves.length ? "Position outside the curated book" : "Moves will identify the line")}</p></div>{premoves.length > 0 && <Pill className="text-violet-300">{premoves.length} premove{premoves.length > 1 ? "s" : ""}</Pill>}</div>{mode === "analysis" && Object.keys(analysisLines).length > 0 && <div className="mt-4 space-y-2">{Object.values(analysisLines).sort((a, b) => a.multipv - b.multipv).map((line) => <div key={line.multipv} className="grid grid-cols-[28px_50px_1fr] gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs"><span className="text-[var(--text-faint)]">#{line.multipv}</span><span className="font-mono font-bold text-[var(--accent)]">{line.mate !== null ? `M${line.mate}` : ((line.scoreCp ?? 0) / 100).toFixed(1)}</span><span className="truncate font-mono text-[var(--text-muted)]">{line.pv.slice(0, 6).join(" ")}</span></div>)}</div>}<MoveList moves={moves} /></div>
          <div className="border-t border-[var(--border)] p-4"><div className="grid grid-cols-3 gap-2"><Action icon={Handshake} label="Offer draw" onClick={() => window.confirm("Agree to a draw and end this game?") && setResultOverride("Draw by agreement")} /><Action icon={Flag} label="Resign" onClick={() => window.confirm("Resign this game?") && setResultOverride(`${colorLabel(game.turn)} resigned`)} danger /><Action icon={RotateCcw} label="Rematch" onClick={reset} /></div><div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-faint)]"><span>{mode === "online" ? "Durable state · connected" : "Saved on this device"}</span><span>v{moves.length + 1}</span></div></div>
        </Surface>}
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>
      {promotion && <Modal title="Choose promotion" onClose={() => setPromotion(null)}><div className="grid grid-cols-4 gap-3">{(["q", "r", "b", "n"] as PromotionPiece[]).map((piece) => <button key={piece} onClick={() => { applyNow({ ...promotion, promotion: piece }); setPromotion(null); }} className="grid aspect-square place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] text-5xl transition hover:border-[var(--accent-muted)] hover:bg-[var(--accent-soft)]" aria-label={`Promote to ${piece}`}>{promotionSymbols[piece]}</button>)}</div></Modal>}
      {pendingConfirmation && <Modal title="Confirm move" onClose={() => setPendingConfirmation(null)}><p className="text-sm text-[var(--text-muted)]">Move from <strong className="text-[var(--text)]">{pendingConfirmation.from}</strong> to <strong className="text-[var(--text)]">{pendingConfirmation.to}</strong>?</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPendingConfirmation(null)}>Cancel</Button><Button onClick={() => { applyNow(pendingConfirmation, { skipConfirmation: true }); setPendingConfirmation(null); }}>Make move</Button></div></Modal>}
      {settingsOpen && <Modal title="Game settings" onClose={() => setSettingsOpen(false)} wide><div className="space-y-5"><label className="block"><span className="text-xs font-bold">Difficulty</span><div className="mt-2 flex items-center gap-3"><input type="range" min="1" max="10" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} className="w-full accent-cyan-400" /><span className="w-7 text-right font-mono text-sm font-bold">{difficulty}</span></div></label><label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-bold">Confirm moves</span><span className="text-xs text-[var(--text-muted)]">Useful on small screens</span></span><input type="checkbox" className="toggle" checked={confirmMoves} onChange={(event) => setConfirmMoves(event.target.checked)} /></label><div><label htmlFor="fen" className="text-xs font-bold">Load a FEN position</label><textarea id="fen" value={fenDraft} onChange={(event) => setFenDraft(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 font-mono text-xs leading-5 outline-none focus:border-[var(--accent-muted)]" /><div className="mt-2 flex justify-between"><span className="text-[10px] text-[var(--text-faint)]">Standard and legal custom positions supported.</span><Button size="sm" variant="secondary" onClick={loadFen}>Load position</Button></div></div><div className="rounded-xl border border-violet-400/15 bg-violet-400/6 p-3 text-xs leading-5 text-[var(--text-muted)]"><strong className="text-violet-300">Chess960 preview:</strong> the setup editor is preserved behind a feature flag until complete X-FEN castling conformance is available.</div></div></Modal>}
    </div>
  );
}

function PlayerBar({ color, name, rating, time, active, engine }: { color: ChessColor; name: string; rating: number | null; time: number; active: boolean; engine?: "idle" | "loading" | "thinking" | "fallback" }) {
  return <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${active ? "border-cyan-300/25 bg-cyan-400/7" : "border-[var(--border)] bg-[var(--surface)]"}`}><span className={`grid size-10 place-items-center rounded-xl text-2xl ${color === "w" ? "bg-slate-100 text-slate-800" : "bg-slate-800 text-slate-100"}`}>{color === "w" ? "♔" : "♚"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{name} {rating && <span className="ml-1 text-xs font-medium text-[var(--text-faint)]">{rating}</span>}</p><p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-faint)]">{engine && engine !== "idle" ? <><LoaderCircle size={10} className="animate-spin" />{engine === "fallback" ? "Heuristic fallback" : "Thinking"}</> : active ? "Your move" : "Waiting"}</p></div><span className={`rounded-xl px-3 py-1.5 font-mono text-lg font-black tabular-nums ${active ? "bg-[var(--accent)] text-[#031421]" : "bg-[var(--surface-soft)]"}`}>{formatClock(time)}</span></div>;
}

function MoveList({ moves }: { moves: AppliedMove[] }) {
  if (!moves.length) return <div className="grid min-h-52 place-items-center text-center"><div><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-soft)] text-2xl">♟</div><p className="mt-3 text-sm font-bold">Every game starts somewhere.</p><p className="mt-1 text-xs text-[var(--text-faint)]">Make the first move.</p></div></div>;
  const rows: { number: number; white?: AppliedMove; black?: AppliedMove }[] = [];
  moves.forEach((move, index) => { const rowIndex = Math.floor(index / 2); rows[rowIndex] ??= { number: rowIndex + 1 }; if (move.color === "w") rows[rowIndex].white = move; else rows[rowIndex].black = move; });
  return <div className="mt-5 max-h-[340px] overflow-auto pr-1"><div className="grid grid-cols-[34px_1fr_1fr] gap-y-1 text-sm">{rows.map((row) => <div key={row.number} className="contents"><span className="py-2 text-xs text-[var(--text-faint)]">{row.number}.</span><button className="rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-[var(--surface-hover)]">{row.white?.san ?? ""}</button><button className="rounded-lg px-2 py-1.5 text-left font-semibold hover:bg-[var(--surface-hover)]">{row.black?.san ?? ""}</button></div>)}</div></div>;
}

function Control({ icon: Icon, label, onClick, disabled }: { icon: typeof Settings2; label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="icon-button disabled:opacity-30" aria-label={label} title={label}><Icon size={17} /></button>; }
function Action({ icon: Icon, label, onClick, danger }: { icon: typeof Flag; label: string; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-[10px] font-bold transition ${danger ? "text-red-300 hover:bg-red-400/10" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}><Icon size={17} />{label}</button>; }
function Tab({ icon: Icon, label, active }: { icon: typeof History; label: string; active?: boolean }) { return <button className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold ${active ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--text-faint)]"}`}><Icon size={14} />{label}</button>; }
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div role="dialog" aria-modal="true" aria-labelledby={`modal-${title.replaceAll(" ", "-")}`} className={`w-full ${wide ? "max-w-lg" : "max-w-sm"} rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl`}><div className="mb-5 flex items-center justify-between"><h2 id={`modal-${title.replaceAll(" ", "-")}`} className="text-xl font-bold">{title}</h2><button onClick={onClose} className="icon-button" aria-label="Close dialog"><X size={18} /></button></div>{children}</div></div>; }
