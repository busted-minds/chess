export type EngineLine = {
  depth: number;
  multipv: number;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
};

export type EngineSearchOptions = {
  depth?: number;
  moveTimeMs?: number;
  skillLevel?: number;
  elo?: number;
  multiPv?: number;
  onLine?: (line: EngineLine) => void;
};

const enginePath = "/stockfish/stockfish-18-lite-single.js";

export const browserStockfishIdentity = Object.freeze({
  profileId: "stockfish-lite",
  version: "18-lite-wasm",
});

function parseInfo(message: string): EngineLine | null {
  if (!message.startsWith("info ") || !message.includes(" pv ")) return null;
  const depth = Number(/\bdepth (\d+)/u.exec(message)?.[1] ?? 0);
  const multipv = Number(/\bmultipv (\d+)/u.exec(message)?.[1] ?? 1);
  const cp = /\bscore cp (-?\d+)/u.exec(message)?.[1];
  const mate = /\bscore mate (-?\d+)/u.exec(message)?.[1];
  const pvText = message.split(" pv ")[1];
  if (!pvText) return null;
  return {
    depth,
    multipv,
    scoreCp: cp === undefined ? null : Number(cp),
    mate: mate === undefined ? null : Number(mate),
    pv: pvText.trim().split(/\s+/u),
  };
}

export class StockfishClient {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private pending: { resolve: (move: string | null) => void; reject: (error: Error) => void; timeout: number } | null = null;
  private onLine: ((line: EngineLine) => void) | null = null;

  async initialize() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      try {
        this.worker = new Worker(enginePath);
        this.worker.addEventListener("message", this.handleMessage);
        this.worker.addEventListener("error", (event) => reject(new Error(event.message || "Stockfish failed to load")), { once: true });
        this.worker.postMessage("uci");
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Stockfish is unavailable"));
      }
    });
    return this.readyPromise;
  }

  private handleMessage = (event: MessageEvent) => {
    const message = String(event.data ?? "");
    if (message === "uciok") {
      this.worker?.postMessage("isready");
      return;
    }
    if (message === "readyok") {
      this.resolveReady?.();
      this.resolveReady = null;
      return;
    }
    const line = parseInfo(message);
    if (line) this.onLine?.(line);
    if (!message.startsWith("bestmove ") || !this.pending) return;
    const move = message.split(/\s+/u)[1];
    const pending = this.pending;
    this.pending = null;
    window.clearTimeout(pending.timeout);
    pending.resolve(move && move !== "(none)" ? move : null);
  };

  async bestMove(fen: string, options: EngineSearchOptions = {}) {
    await this.initialize();
    if (!this.worker) throw new Error("Stockfish worker is unavailable");
    this.stop();
    const skillLevel = Math.max(0, Math.min(20, Math.round(options.skillLevel ?? 12)));
    this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
    if (options.elo) {
      this.worker.postMessage("setoption name UCI_LimitStrength value true");
      this.worker.postMessage(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(options.elo)))}`);
    } else {
      this.worker.postMessage("setoption name UCI_LimitStrength value false");
    }
    this.worker.postMessage(`setoption name MultiPV value ${Math.max(1, Math.min(4, options.multiPv ?? 1))}`);
    this.worker.postMessage(`position fen ${fen}`);
    this.onLine = options.onLine ?? null;

    return new Promise<string | null>((resolve, reject) => {
      const timeoutMs = Math.max(8_000, (options.moveTimeMs ?? 800) + 5_000);
      const timeout = window.setTimeout(() => {
        this.pending = null;
        this.worker?.postMessage("stop");
        reject(new Error("Stockfish search timed out"));
      }, timeoutMs);
      this.pending = { resolve, reject, timeout };
      this.worker?.postMessage(options.moveTimeMs ? `go movetime ${Math.max(80, options.moveTimeMs)}` : `go depth ${Math.max(1, Math.min(24, options.depth ?? 12))}`);
    });
  }

  stop() {
    this.worker?.postMessage("stop");
    if (this.pending) {
      window.clearTimeout(this.pending.timeout);
      this.pending.resolve(null);
      this.pending = null;
    }
    this.onLine = null;
  }

  destroy() {
    this.stop();
    this.worker?.removeEventListener("message", this.handleMessage);
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }
}
