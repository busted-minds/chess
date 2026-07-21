export type Club = {
  slug: string;
  name: string;
  initials: string;
  tagline: string;
  description: string;
  members: number;
  online: number;
  privacy: "Open" | "Request to join";
  focus: string;
  color: string;
  schedule: string;
  activity: Array<{ actor: string; text: string; when: string }>;
};

export const clubs: Club[] = [
  { slug: "endgame-atelier", name: "Endgame Atelier", initials: "EA", tagline: "Make the quiet moves count.", description: "A study-minded club for practical rook endings, conversion technique, and patient post-game review.", members: 18, online: 4, privacy: "Open", focus: "Endgames", color: "#a78bfa", schedule: "Study room · Wednesdays 19:00 UTC", activity: [{ actor: "QuietStorm", text: "shared a rook-and-pawn study", when: "18 min ago" }, { actor: "Sage Bishop", text: "annotated the critical triangulation", when: "1 hr ago" }] },
  { slug: "night-owls", name: "Night Owls", initials: "NO", tagline: "Good chess after dark.", description: "Short evening arenas, friendly rematches, and a home for players whose sharpest ideas arrive late.", members: 26, online: 7, privacy: "Open", focus: "Blitz & arenas", color: "#19c6ed", schedule: "After Hours Arena · Fridays 21:00 UTC", activity: [{ actor: "MiraTempo", text: "posted a 26-move Catalan win", when: "7 min ago" }, { actor: "Nova Knight", text: "joined Friday’s arena", when: "32 min ago" }] },
  { slug: "first-rank", name: "First Rank", initials: "1R", tagline: "Strong habits, no rating required.", description: "A welcoming launch club for first tournaments, opening fundamentals, and questions that deserve patient answers.", members: 14, online: 3, privacy: "Request to join", focus: "New players", color: "#ff7a1a", schedule: "Rookie clinic · Sundays 14:00 UTC", activity: [{ actor: "Pixel Pawn", text: "started a beginner Italian study", when: "24 min ago" }, { actor: "ForkInRoad", text: "answered a castling question", when: "2 hr ago" }] },
];
