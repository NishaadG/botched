import { viewFor } from "@/lib/game/engine";
import { loadRoom } from "@/lib/game/runner";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  const { code } = await ctx.params;
  const [room, session] = await Promise.all([loadRoom(code), getSession()]);
  if (!room) return Response.json({ error: "Room not found. Check the code." }, { status: 404 });
  return Response.json(viewFor(room, session?.uid ?? null), { headers: { "Cache-Control": "no-store" } });
}
