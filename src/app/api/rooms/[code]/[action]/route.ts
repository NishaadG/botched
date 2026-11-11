import { addMessage, castVote, GameError, join, leave, start, tick, tickDue, viewFor } from "@/lib/game/engine";
import { loadRoom, markSeen, mutate, newBots, onlineIn } from "@/lib/game/runner";
import { joinGroupChannel } from "@/lib/nexconn-server";
import { getSession } from "@/lib/session";

type Body = { id?: string; text?: string; targetId?: string };

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/[action]">) {
  const { code, action } = await ctx.params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Body;
  const me = { id: session.uid, name: session.name };

  try {
    let room;
    switch (action) {
      case "join":
        room = await mutate(code, (r, now) => join(r, me, now));
        await Promise.all([joinGroupChannel(room.channelId, [me.id]), markSeen(room.code, me.id)]);
        break;
      case "leave":
        room = await mutate(code, (r) => leave(r, me.id));
        break;
      case "start": {
        const current = await loadRoom(code);
        const online = current ? new Set(await onlineIn(current)) : new Set<string>();
        online.add(me.id);
        room = await mutate(code, (r, now) => {
          if (r.phase !== "lobby") return start(r, me.id, newBots(r.mode ?? "classic"), now);
          // Drop players whose lobby tab is gone; if the host left, whoever presses start becomes host.
          r.players = r.players.filter((p) => online.has(p.id));
          if (!online.has(r.hostId)) r.hostId = me.id;
          return start(r, me.id, newBots(r.mode ?? "classic"), now);
        });
        break;
      }
      case "message": {
        const text = String(body.text ?? "").trim();
        if (!text || !body.id) return Response.json({ error: "Empty message." }, { status: 400 });
        room = await mutate(code, (r, now) => addMessage(r, { id: String(body.id), from: me.id, text, at: now }, now));
        break;
      }
      case "vote":
        room = await mutate(code, (r, now) => castVote(r, me.id, String(body.targetId ?? ""), now));
        break;
      case "tick": {
        // Most ticks have nothing to do: answer from a single read without locking or writing.
        const current = await loadRoom(code);
        if (!current) return Response.json({ error: "Room not found." }, { status: 404 });
        room = tickDue(current, Date.now()) ? await mutate(code, (r, now) => tick(r, now)) : current;
        break;
      }
      default:
        return Response.json({ error: "Unknown action." }, { status: 404 });
    }
    return Response.json(viewFor(room, me.id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof GameError) return Response.json({ error: err.message }, { status: 409 });
    console.error(`[rooms/${action}]`, err);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
