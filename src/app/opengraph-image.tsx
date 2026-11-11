import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "Botched: one of your friends is a bot";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    kicker: "Who's the Bot",
    title: "One of your friends",
    accent: "is a bot.",
    sub: "A party game in your group chat. Find the AI before it outlasts you.",
  });
}
