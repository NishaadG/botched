import { submitAnswer } from "../src/lib/game/engine";
import type { Room } from "../src/lib/game/types";

/** Everyone still in the game answers, which reveals the answers and opens the discussion. */
export function answerAll(room: Room, now: number) {
  for (const p of room.players.filter((x) => x.alive)) {
    if (room.phase !== "answer") break;
    submitAnswer(room, p.id, `answer from ${p.id}`, now, () => 0.5);
  }
}

export const chatLines = (room: Room) => room.transcript.filter((l) => l.kind !== "answer");
