import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3210";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/play", "/play/whos-the-bot", "/how-to-play", "/lounge", "/leaderboard", "/stats"].map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "/stats" || path === "/leaderboard" ? "hourly" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
