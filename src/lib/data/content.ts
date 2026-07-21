import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  Crown,
  Flame,
  Gauge,
  Globe2,
  GraduationCap,
  Handshake,
  History,
  Home,
  Medal,
  Puzzle,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

export const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/play", label: "Play", icon: Swords },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/watch", label: "Watch", icon: Radio },
  { href: "/community", label: "Community", icon: Users },
];

export const secondaryNavigation: NavigationItem[] = [
  { href: "/games", label: "Game archive", icon: History },
  { href: "/leaderboard", label: "Leaderboards", icon: Medal },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/puzzles", label: "Puzzles", icon: Puzzle },
];

export const playModes = [
  {
    id: "online",
    title: "Online",
    eyebrow: "Find a worthy rival",
    description: "Instant matchmaking with humans or a calibrated house player when the pool is quiet.",
    href: "/play/online",
    icon: Globe2,
    accent: "cyan",
    stat: "34 playing",
  },
  {
    id: "ai",
    title: "Vs AI",
    eyebrow: "Your pace. Your opponent.",
    description: "Choose a personality, set the strength, and play Stockfish entirely in your browser.",
    href: "/play/ai",
    icon: BrainCircuit,
    accent: "orange",
    stat: "Offline ready",
  },
  {
    id: "local",
    title: "Local",
    eyebrow: "One board, two minds",
    description: "Pass-and-play hotseat chess with custom clocks. No account and no connection needed.",
    href: "/play/local",
    icon: Handshake,
    accent: "violet",
    stat: "Zero setup",
  },
  {
    id: "invite",
    title: "Invite a friend",
    eyebrow: "Settle it privately",
    description: "Create a challenge link, choose the rules, and bring your own rivalry.",
    href: "/play/invite",
    icon: Sparkles,
    accent: "blue",
    stat: "Share a link",
  },
] as const;

export const housePlayers = [
  {
    id: "nova-knight",
    name: "Nova Knight",
    handle: "nova_knight",
    rating: 1624,
    country: "JP",
    title: "House Player",
    bio: "Patient in quiet positions, electric when the center opens.",
    opening: "Queen's Gambit",
    style: "Positional",
    color: "#19c6ed",
    level: 5,
  },
  {
    id: "ember-rook",
    name: "Ember Rook",
    handle: "ember_rook",
    rating: 1388,
    country: "IN",
    title: "House Player",
    bio: "Loves open files, active rooks, and one last tactical twist.",
    opening: "Scotch Game",
    style: "Tactical",
    color: "#ff7a1a",
    level: 4,
  },
  {
    id: "sage-bishop",
    name: "Sage Bishop",
    handle: "sage_bishop",
    rating: 1912,
    country: "GB",
    title: "House Player",
    bio: "A long-diagonal specialist who rarely rushes the attack.",
    opening: "Catalan Opening",
    style: "Technical",
    color: "#a78bfa",
    level: 7,
  },
  {
    id: "pixel-pawn",
    name: "Pixel Pawn",
    handle: "pixel_pawn",
    rating: 986,
    country: "BR",
    title: "House Player",
    bio: "Brave, curious, and still learning when not to grab a pawn.",
    opening: "Italian Game",
    style: "Adventurous",
    color: "#57d38c",
    level: 2,
  },
] as const;

export const leaderboard = [
  { rank: 1, name: "MiraTempo", rating: 2284, trend: 21, country: "JP", streak: 7 },
  { rank: 2, name: "Sage Bishop", rating: 2190, trend: 8, country: "GB", streak: 4, house: true },
  { rank: 3, name: "ForkInRoad", rating: 2148, trend: -4, country: "DE", streak: 2 },
  { rank: 4, name: "KnightShift", rating: 2096, trend: 15, country: "US", streak: 5 },
  { rank: 5, name: "QuietStorm", rating: 2051, trend: 6, country: "IN", streak: 3 },
] as const;

export const featuredGames = [
  { white: "MiraTempo", black: "Sage Bishop", whiteRating: 2284, blackRating: 2190, result: "1–0", opening: "Catalan · Open Variation", time: "3+2", move: "26. Rxd7!", viewers: 18 },
  { white: "Ember Rook", black: "KnightShift", whiteRating: 1882, blackRating: 2096, result: "½–½", opening: "Sicilian · Taimanov", time: "10+0", move: "41... Qe6", viewers: 9 },
  { white: "QuietStorm", black: "Nova Knight", whiteRating: 2051, blackRating: 1968, result: "0–1", opening: "Queen's Gambit Declined", time: "5+3", move: "33... Nf3+", viewers: 12 },
] as const;

export const launchTournaments = [
  { id: "after-hours", name: "After Hours Arena", format: "Arena", starts: "In 42 min", clock: "3+2", players: 12, cap: 24, prize: "Night Owl badge", color: "#19c6ed" },
  { id: "rookie-rumble", name: "Rookie Rumble", format: "Swiss · 5 rounds", starts: "Tomorrow · 20:00", clock: "10+0", players: 8, cap: 16, prize: "650 XP", color: "#ff7a1a" },
  { id: "sunday-classic", name: "Sunday Classic", format: "Swiss · 7 rounds", starts: "Sun · 16:00", clock: "15+10", players: 18, cap: 32, prize: "Founders trophy", color: "#a78bfa" },
] as const;

export const learningTracks = [
  { title: "Tactics that actually repeat", lessons: 12, progress: 42, level: "Beginner", icon: Flame, color: "orange" },
  { title: "Build an opening compass", lessons: 9, progress: 18, level: "Intermediate", icon: Gauge, color: "cyan" },
  { title: "Make every rook count", lessons: 7, progress: 0, level: "Intermediate", icon: Crown, color: "violet" },
  { title: "Tournament-ready decisions", lessons: 10, progress: 0, level: "Advanced", icon: ShieldCheck, color: "green" },
] as const;

export const platformStats = [
  { label: "Games today", value: "284", detail: "Humans + house pool" },
  { label: "Positions solved", value: "1.8k", detail: "Across daily training" },
  { label: "Live now", value: "34", detail: "Players and spectators" },
] as const;

export const dailyMission = {
  title: "The back-rank alarm",
  description: "Find the forcing line in three moves. The first move is a quiet one.",
  reward: "+80 XP",
  streak: 6,
};

export const values = [
  { icon: Bot, title: "Never wait on an empty room", body: "Our varied house-player pool makes every queue useful while preserving a clear human-only competitive view." },
  { icon: BrainCircuit, title: "Serious analysis, local compute", body: "Stockfish loads only when you need it and works inside your browser, keeping games fast and costs light." },
  { icon: Trophy, title: "A path beyond the next game", body: "Puzzles, openings, events, ratings, streaks, and lessons turn each move into visible progress." },
] as const;
