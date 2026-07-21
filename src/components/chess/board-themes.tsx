import type { PieceRenderObject } from "react-chessboard";
import type { BoardTheme } from "@/components/providers/app-providers";

export const boardThemes: Record<BoardTheme, { light: string; dark: string; selected: string }> = {
  ocean: { light: "#c8dbe0", dark: "#3c7385", selected: "rgba(255,221,87,.36)" },
  walnut: { light: "#e2c69f", dark: "#8b5e3c", selected: "rgba(84,224,179,.38)" },
  colorblind: { light: "#f0d9b5", dark: "#3d6fa1", selected: "rgba(255,122,26,.48)" },
};

const symbols: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

export const minimalPieces = Object.fromEntries(Object.entries(symbols).map(([piece, symbol]) => [piece, () => <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: "clamp(1.5rem, 7vw, 4.6rem)", lineHeight: 1, color: piece.startsWith("w") ? "#f8fafc" : "#101923", textShadow: piece.startsWith("w") ? "0 2px 2px rgba(0,0,0,.65)" : "0 1px 1px rgba(255,255,255,.3)" }}>{symbol}</span>])) as PieceRenderObject;
