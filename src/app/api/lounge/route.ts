import { GM_ID, LOUNGE_ID, TEST_LOUNGE_ID } from "@/lib/constants";
import { loadRoom } from "@/lib/game/runner";
import { createOpenChannel, sendOpenText } from "@/lib/nexconn-server";
import { getSession, isTestClient } from "@/lib/session";
import { kv } from "@/lib/store";

/** Makes sure the public lounge (a Nexconn open channel) exists. Re-created lazily if it ever expires. */
async function ensureLounge(id: string) {
  if (await kv.get(`lounge:ready:${id}`)) return;
  try {
    await createOpenChannel(id);
  } catch (err) {
    // Already exists is fine; anything else is logged and the client will surface a connect error.
    console.warn("[lounge] create", err instanceof Error ? err.message : err);
  }
  await kv.set(`lounge:ready:${id}`, 1, 60 * 30);
}

export async function GET() {
  const id = (await isTestClient()) ? TEST_LOUNGE_ID : LOUNGE_ID;
  await ensureLounge(id);
  return Response.json({ channelId: id });
}

/** Posts an invite for a room that is still in its lobby, so people in the lounge can jump in. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  const room = code ? await loadRoom(String(code).toUpperCase()) : null;
  if (!room) return Response.json({ error: "Room not found." }, { status: 404 });
  if (room.phase !== "lobby") return Response.json({ error: "That game has already started." }, { status: 409 });
  if (!room.players.some((p) => p.id === session.uid)) return Response.json({ error: "Join the room first." }, { status: 403 });
  if (!(await kv.lock(`lounge:promo:${room.code}`, 45_000))) {
    return Response.json({ error: "Already posted. Give it a minute." }, { status: 429 });
  }
  const id = room.test ? TEST_LOUNGE_ID : LOUNGE_ID;
  await ensureLounge(id);
  const n = room.players.length;
  await sendOpenText(id, GM_ID, `${session.name} is hosting Who's the Bot (${n}/8 in the lobby). Hop in!`, {
    kind: "invite",
    code: room.code,
    players: n,
  });
  return Response.json({ ok: true });
}
