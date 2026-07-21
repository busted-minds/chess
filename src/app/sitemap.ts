import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const paths = ["", "/play", "/learn", "/puzzles", "/openings", "/tournaments", "/leaderboard", "/watch", "/community", "/features", "/how-to-play", "/faq", "/contact", "/privacy", "/terms", "/guidelines", "/changelog"];
  return paths.map((path, index) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: index < 9 ? "daily" : "monthly", priority: path === "" ? 1 : index < 9 ? 0.8 : 0.5 }));
}
