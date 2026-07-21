/** A deliberately compact launch book. Moves are UCI so matching is locale-free. */
export type OpeningDefinition = {
  eco: string;
  name: string;
  variation?: string;
  moves: readonly string[];
  aliases?: readonly string[];
};

export const CURATED_OPENINGS: readonly OpeningDefinition[] = [
  { eco: "A00", name: "Van't Kruijs Opening", moves: ["e2e3"] },
  { eco: "A01", name: "Nimzo-Larsen Attack", moves: ["b2b3"] },
  { eco: "A02", name: "Bird Opening", moves: ["f2f4"] },
  { eco: "A04", name: "Réti Opening", moves: ["g1f3"] },
  { eco: "A10", name: "English Opening", moves: ["c2c4"] },
  {
    eco: "A20",
    name: "English Opening",
    variation: "King's English",
    moves: ["c2c4", "e7e5"],
  },
  {
    eco: "A30",
    name: "English Opening",
    variation: "Symmetrical",
    moves: ["c2c4", "c7c5"],
  },
  { eco: "A40", name: "Queen's Pawn Game", moves: ["d2d4"] },
  {
    eco: "A45",
    name: "Trompowsky Attack",
    moves: ["d2d4", "g8f6", "c1g5"],
  },
  { eco: "B00", name: "King's Pawn Opening", moves: ["e2e4"] },
  {
    eco: "B01",
    name: "Scandinavian Defense",
    moves: ["e2e4", "d7d5"],
  },
  {
    eco: "B07",
    name: "Pirc Defense",
    moves: ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6"],
  },
  {
    eco: "B10",
    name: "Caro-Kann Defense",
    moves: ["e2e4", "c7c6"],
  },
  {
    eco: "B12",
    name: "Caro-Kann Defense",
    variation: "Advance",
    moves: ["e2e4", "c7c6", "d2d4", "d7d5", "e4e5"],
  },
  { eco: "B20", name: "Sicilian Defense", moves: ["e2e4", "c7c5"] },
  {
    eco: "B22",
    name: "Sicilian Defense",
    variation: "Alapin",
    moves: ["e2e4", "c7c5", "c2c3"],
  },
  {
    eco: "B23",
    name: "Sicilian Defense",
    variation: "Closed",
    moves: ["e2e4", "c7c5", "b1c3"],
  },
  {
    eco: "B30",
    name: "Sicilian Defense",
    variation: "Rossolimo",
    moves: ["e2e4", "c7c5", "g1f3", "b8c6", "f1b5"],
  },
  {
    eco: "B90",
    name: "Sicilian Defense",
    variation: "Najdorf",
    moves: [
      "e2e4",
      "c7c5",
      "g1f3",
      "d7d6",
      "d2d4",
      "c5d4",
      "f3d4",
      "g8f6",
      "b1c3",
      "a7a6",
    ],
  },
  { eco: "C00", name: "French Defense", moves: ["e2e4", "e7e6"] },
  {
    eco: "C02",
    name: "French Defense",
    variation: "Advance",
    moves: ["e2e4", "e7e6", "d2d4", "d7d5", "e4e5"],
  },
  { eco: "C20", name: "Open Game", moves: ["e2e4", "e7e5"] },
  {
    eco: "C42",
    name: "Petrov's Defense",
    moves: ["e2e4", "e7e5", "g1f3", "g8f6"],
    aliases: ["Russian Game"],
  },
  {
    eco: "C44",
    name: "Scotch Game",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4"],
  },
  {
    eco: "C50",
    name: "Italian Game",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
  },
  {
    eco: "C54",
    name: "Italian Game",
    variation: "Giuoco Piano",
    moves: [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
      "f1c4",
      "f8c5",
      "c2c3",
      "g8f6",
      "d2d4",
    ],
  },
  {
    eco: "C60",
    name: "Ruy López",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"],
    aliases: ["Spanish Opening"],
  },
  {
    eco: "C65",
    name: "Ruy López",
    variation: "Berlin Defense",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6"],
  },
  { eco: "D00", name: "Closed Game", moves: ["d2d4", "d7d5"] },
  {
    eco: "D02",
    name: "London System",
    moves: ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"],
  },
  { eco: "D06", name: "Queen's Gambit", moves: ["d2d4", "d7d5", "c2c4"] },
  {
    eco: "D10",
    name: "Slav Defense",
    moves: ["d2d4", "d7d5", "c2c4", "c7c6"],
  },
  {
    eco: "D20",
    name: "Queen's Gambit Accepted",
    moves: ["d2d4", "d7d5", "c2c4", "d5c4"],
  },
  {
    eco: "D30",
    name: "Queen's Gambit Declined",
    moves: ["d2d4", "d7d5", "c2c4", "e7e6"],
  },
  {
    eco: "E00",
    name: "Catalan Opening",
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g2g3"],
  },
  {
    eco: "E20",
    name: "Nimzo-Indian Defense",
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"],
  },
  {
    eco: "E60",
    name: "King's Indian Defense",
    moves: [
      "d2d4",
      "g8f6",
      "c2c4",
      "g7g6",
      "b1c3",
      "f8g7",
      "e2e4",
      "d7d6",
    ],
  },
] as const;

export const OPENINGS = CURATED_OPENINGS;
