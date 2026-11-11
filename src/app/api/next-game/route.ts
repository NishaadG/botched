import { getSession } from "@/lib/session";
import { getNextGameVotes, NEXT_GAMES } from "@/lib/stats";
import { kv } from "@/lib/store";

export async function GET() {
  const session = await getSession();
  return Response.json(await getNextGameVotes(session?.uid));
}

/** One vote per guest for which game we build next. Changing your vote moves it. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  const { game } = (await request.json().catch(() => ({}))) as { game?: string };
  if (!NEXT_GAMES.some((g) => g.id === game)) return Response.json({ error: "Unknown game." }, { status: 400 });
  const prev = await kv.get<string>(`nextvote:${session.uid}`);
  if (prev !== game) {
    if (prev) await kv.zincr("votes:next", prev, -1);
    await kv.zincr("votes:next", game!, 1);
    await kv.set(`nextvote:${session.uid}`, game);
  }
  return Response.json(await getNextGameVotes(session.uid));
}
