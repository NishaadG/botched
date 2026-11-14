import { connection } from "next/server";
import { loadRoom } from "@/lib/game/runner";
import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "A game of Who's the Bot";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const room = await loadRoom(code.toUpperCase());
  const humans = room?.players.filter((p) => !p.isBot).length ?? 0;

  if (room?.phase === "over" && room.variant === "interrogation") {
    return room.winner === "humans"
      ? ogCard({ kicker: "Interrogation", title: "Filed as", accent: "a machine.", sub: "An AI detective questioned a human and never noticed. AI took your job. Time to take its." })
      : ogCard({ kicker: "Interrogation", title: "Caught being", accent: "human.", sub: "An AI detective saw through the act. Could you pass?", tone: "hot" });
  }
  if (room?.phase === "over" && room.mode === "reverse") {
    const n = room.players.filter((p) => p.isBot).length;
    return room.winner === "humans"
      ? ogCard({ kicker: "Who's the Human", title: "A human fooled", accent: `${n} AIs.`, sub: "AI took your job. Time to take its. Could you pass as a bot?" })
      : ogCard({ kicker: "Who's the Human", title: `${n} AIs found`, accent: "the human.", sub: "AI took your job. Time to take its. Could you pass as a bot?", tone: "hot" });
  }
  if (room?.phase === "over") {
    const bot = room.players.find((p) => p.isBot);
    return room.winner === "humans"
      ? ogCard({
          kicker: `Room ${room.code}`,
          title: `${humans} humans caught`,
          accent: `the bot in round ${room.round}.`,
          sub: `It was hiding as ${bot?.alias ?? "one of them"}. Think you could spot it?`,
        })
      : ogCard({
          kicker: `Room ${room.code}`,
          title: "The bot fooled",
          accent: `${humans} humans.`,
          sub: `It played as ${bot?.alias ?? "one of them"} and nobody caught it. Could you?`,
          tone: "hot",
        });
  }
  return ogCard({
    kicker: room ? `Room ${room.code}` : "Who's the Bot",
    title: "Join my game.",
    accent: "One of us is a bot.",
    sub: room ? `${humans} in the lobby. Tap to join with just a nickname.` : "A party game in your group chat.",
  });
}
