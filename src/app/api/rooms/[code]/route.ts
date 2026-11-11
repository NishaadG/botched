import { viewFor } from "@/lib/game/engine";
import { loadRoom, markSeen, onlineIn } from "@/lib/game/runner";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  const { code } = await ctx.params;
  const [room, session] = await Promise.all([loadRoom(code), getSession()]);
  if (!room) return Response.json({ error: "Room not found. Check the code." }, { status: 404 });
  let online: string[] | null = null;
  if (room.phase === "lobby") {
    if (session && room.players.some((p) => p.id === session.uid)) await markSeen(room.code, session.uid);
    online = await onlineIn(room);
  }
  return Response.json({ ...viewFor(room, session?.uid ?? null), online }, { headers: { "Cache-Control": "no-store" } });
}
