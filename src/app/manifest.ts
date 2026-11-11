import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Botched: party games for group chats",
    short_name: "Botched",
    description: "Real-time party games for friends. One player in the chat is an AI. Find it.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0a14",
    theme_color: "#0b0a14",
    categories: ["games", "social", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Start a game", url: "/play/whos-the-bot", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Lounge", url: "/lounge", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
