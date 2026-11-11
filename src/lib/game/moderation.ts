import { GM_ID } from "../constants";
import type { Room } from "./types";

/** Room code for a game channel id, or null for any other channel. */
export function codeFromChannel(channelId: string) {
  const m = /^wtb_([A-Z]{4,6})$/.exec(channelId);
  return m ? m[1] : null;
}

/**
 * Whether a message from `userId` may be delivered in a game channel right now.
 * Runs inside Nexconn's pre-messaging webhook, so the rules hold even against a modified client.
 */
export function allowGameMessage(room: Room | null, userId: string) {
  if (!room) return true; // Unknown room: don't interfere.
  if (userId === GM_ID || userId === room.bot?.id) return true;
  const p = room.players.find((x) => x.id === userId);
  return Boolean(p && p.alive && room.phase === "chat");
}
