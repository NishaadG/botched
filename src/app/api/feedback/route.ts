import { loadRoom } from "@/lib/game/runner";
import { getSession } from "@/lib/session";
import type { Feedback } from "@/lib/stats";
import { kv } from "@/lib/store";

/** One rating (and optional comment) per player per finished game. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { code?: string; rating?: number; text?: string };
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "Pick a rating." }, { status: 400 });
  const code = String(body.code ?? "").toUpperCase();
  const room = await loadRoom(code);
  if (!room || room.phase !== "over" || !room.players.some((p) => p.id === session.uid)) {
    return Response.json({ error: "You can rate a game after playing it." }, { status: 403 });
  }
  if (!(await kv.lock(`feedback:${code}:${session.uid}`, 7 * 86_400_000))) {
    return Response.json({ error: "Thanks, we already have your rating." }, { status: 409 });
  }
  const text = String(body.text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
  const entry: Feedback = { name: session.name, rating, text, code, at: Date.now() };
  await kv.lpush("feedback", entry, 500);
  return Response.json({ ok: true });
}
