import { addMessage, castVote, GameError, join, leave, start, tick, viewFor } from "@/lib/game/engine";
import { mutate, newBot } from "@/lib/game/runner";
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
        await joinGroupChannel(room.channelId, [me.id]);
        break;
      case "leave":
        room = await mutate(code, (r) => leave(r, me.id));
        break;
      case "start":
        room = await mutate(code, (r, now) => start(r, me.id, newBot(), now));
        break;
      case "message": {
        const text = String(body.text ?? "").trim();
        if (!text || !body.id) return Response.json({ error: "Empty message." }, { status: 400 });
        room = await mutate(code, (r, now) => addMessage(r, { id: String(body.id), from: me.id, text, at: now }, now));
        break;
      }
      case "vote":
        room = await mutate(code, (r, now) => castVote(r, me.id, String(body.targetId ?? ""), now));
        break;
      case "tick":
        room = await mutate(code, (r, now) => tick(r, now));
        break;
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
