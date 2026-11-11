import { after } from "next/server";
import { GM_ID } from "@/lib/constants";
import { addMessage } from "@/lib/game/engine";
import { allowGameMessage, codeFromChannel } from "@/lib/game/moderation";
import { loadRoom, mutate } from "@/lib/game/runner";
import { verifyWebhookSignature } from "@/lib/nexconn-server";
import { kv } from "@/lib/store";

interface MessageEvent {
  userId: string;
  channelId: string;
  channelType: number;
  messageType: string;
  content: string;
  messageId: string;
  time: number;
  os?: string;
}

interface Envelope {
  type: string;
  id: string;
  time: number;
  data?: MessageEvent[];
}

const textOf = (content: string) => {
  try {
    const c = JSON.parse(content) as { content?: unknown };
    return typeof c.content === "string" ? c.content : "";
  } catch {
    return "";
  }
};

/**
 * Nexconn webhooks (Console > Chat > Chat settings > Webhooks), signed with sha1(AppSecret + Nonce + Timestamp).
 * - group_channel:pre_messaging: enforces game rules before delivery (only living players, only while chatting).
 * - message:send: server-side copy of every game message, so the bot hears the room even if a client request drops.
 */
export async function POST(request: Request) {
  const h = request.headers;
  if (!verifyWebhookSignature(h.get("Nonce"), h.get("Timestamp"), h.get("Signature"))) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }
  const event = (await request.json().catch(() => null)) as Envelope | null;
  if (!event?.type) return Response.json({ ok: true });
  const msg = event.data?.[0];

  if (event.type === "group_channel:pre_messaging") {
    const code = msg ? codeFromChannel(msg.channelId) : null;
    if (!msg || !code) return Response.json({ pass: 1 });
    const room = await loadRoom(code);
    return Response.json(allowGameMessage(room, msg.userId) ? { pass: 1 } : { pass: 0, extra: "chat-closed" });
  }

  if (event.type === "message:send" && msg && msg.messageType === "RC:TxtMsg") {
    // Answer within Nexconn's 5 s window; do the work afterwards. Duplicate deliveries are deduped by message id.
    after(async () => {
      if (!(await kv.lock(`wh:${event.id}`, 10 * 60_000))) return;
      const code = codeFromChannel(msg.channelId);
      if (!code) {
        if (msg.userId !== GM_ID) await kv.incr("stats:loungeMessages");
        return;
      }
      if (msg.userId === GM_ID || msg.os === "Server") return;
      const text = textOf(msg.content).trim();
      if (!text) return;
      await mutate(code, (room, now) =>
        room.bots.some((b) => b.id === msg.userId) ? [] : addMessage(room, { id: msg.messageId, from: msg.userId, text, at: now }, now),
      ).catch(() => {});
    });
  }

  return Response.json({ ok: true });
}
