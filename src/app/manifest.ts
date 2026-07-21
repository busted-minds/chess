import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Busted Minds Chess",
    short_name: "BM Chess",
    description: "Play, train, analyze, and compete wherever you are.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#06111f",
    theme_color: "#06111f",
    orientation: "any",
    categories: ["games", "education", "sports"],
    icons: [{ src: "/brand/chess-icon.png", sizes: "any", type: "image/png", purpose: "maskable" }],
    shortcuts: [
      { name: "Play online", short_name: "Online", url: "/play/online" },
      { name: "Play the computer", short_name: "Vs AI", url: "/play/ai" },
      { name: "Local hotseat", short_name: "Local", url: "/play/local" },
      { name: "Daily puzzle", short_name: "Puzzle", url: "/puzzles" },
    ],
  };
}
