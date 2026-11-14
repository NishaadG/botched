import { createRoom } from "@/lib/game/engine";
import { loadRoom, mutate, newRoomCode, saveRoom } from "@/lib/game/runner";
import { createGroupChannel, sendGroupEvent, sendGroupText } from "@/lib/nexconn-server";
import { GM_ID } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { kv } from "@/lib/store";

/**
 * Starts (or joins) the rematch for a finished game. The first player to ask creates the new room;
 * everyone else gets the same code, and the old chat is told so their screens show a join button.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/rooms/[code]/rematch">) {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  const old = await loadRoom(code);
  if (!old || old.phase !== "over") return Response.json({ error: "That game isn't over yet." }, { status: 409 });
  if (!old.players.some((p) => p.id === session.uid)) return Response.json({ error: "You weren't in that game." }, { status: 403 });
  if (old.rematch) return Response.json({ code: old.rematch });

  // Only one player creates the room, even if several press the button at once.
  if (!(await kv.lock(`rematch:${old.code}`, 15_000))) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const again = await loadRoom(code);
      if (again?.rematch) return Response.json({ code: again.rematch });
    }
    return Response.json({ error: "Try again in a second." }, { status: 409 });
  }

  let next = newRoomCode();
  for (let i = 0; i < 5 && (await loadRoom(next)); i++) next = newRoomCode();
  const room = createRoom(next, { id: session.uid, name: session.name }, Date.now(), old.mode ?? "classic", old.variant);
  room.settings = { ...room.settings, ...old.settings };
  room.test = old.test;
  const title = `${room.mode === "reverse" ? "Who's the Human" : "Who's the Bot"} · ${next}`;
  await createGroupChannel(room.channelId, session.uid, title, [session.uid]);
  await saveRoom(room);
  await mutate(old.code, (r) => {
    r.rematch = next;
    r.version++;
    return [];
  });
  await sendGroupText(old.channelId, GM_ID, `${session.name} started a rematch. Tap "Join the rematch" to play again.`).catch(() => {});
  await sendGroupEvent(old.channelId, GM_ID, { kind: "rematch", code: next }).catch(() => {});
  return Response.json({ code: next });
}
