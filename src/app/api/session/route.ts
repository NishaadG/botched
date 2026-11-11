import { issueAccessToken } from "@/lib/nexconn-server";
import { cleanName, getSession, newUserId, saveSession } from "@/lib/session";
import { dayKey } from "@/lib/stats";
import { clientIp, kv, limited } from "@/lib/store";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ session: null });
  // Count returning players as active today.
  await kv.sadd(`day:visitors:${dayKey()}`, session.uid);
  return Response.json({
    session: { uid: session.uid, name: session.name, token: session.token },
    appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY,
  });
}

/** Creates a guest identity (or renames the current one) and issues a Nexconn access token. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = cleanName(body.name);
  if (name.length < 2) return Response.json({ error: "Pick a nickname with at least 2 characters." }, { status: 400 });

  const existing = await getSession();
  // New guest identities are real chat users, so cap how fast one address can create them.
  if (!existing && (await limited(`session:${clientIp(request)}`, 60, 600))) {
    return Response.json({ error: "Too many new players from this network. Try again in a few minutes." }, { status: 429 });
  }
  const uid = existing?.uid ?? newUserId();
  try {
    const token = existing && existing.name === name ? existing.token : await issueAccessToken(uid, name);
    const session = { uid, name, token, createdAt: existing?.createdAt ?? Date.now() };
    await saveSession(session);
    await Promise.all([
      kv.sadd("stats:visitors", uid),
      kv.sadd(`day:visitors:${dayKey()}`, uid),
      kv.set(`name:${uid}`, name),
    ]);
    return Response.json({ session: { uid, name, token }, appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY });
  } catch (err) {
    console.error("[session] token issue failed", err);
    return Response.json({ error: "Could not connect to the chat service. Try again in a moment." }, { status: 502 });
  }
}
