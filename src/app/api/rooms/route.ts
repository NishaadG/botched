import { createRoom } from "@/lib/game/engine";
import { loadRoom, newRoomCode, saveRoom } from "@/lib/game/runner";
import { createGroupChannel } from "@/lib/nexconn-server";
import { getSession, isTestClient } from "@/lib/session";
import { limited } from "@/lib/store";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  if (await limited(`rooms:${session.uid}`, 15, 600)) {
    return Response.json({ error: "You've opened a lot of rooms. Take a breather and try again soon." }, { status: 429 });
  }

  let code = newRoomCode();
  for (let i = 0; i < 5 && (await loadRoom(code)); i++) code = newRoomCode();

  const mode = new URL(request.url).searchParams.get("mode") === "reverse" ? "reverse" : "classic";
  const room = createRoom(code, { id: session.uid, name: session.name }, Date.now(), mode);
  // Short timers for automated end-to-end tests: always in development, in production only when explicitly allowed.
  const fastAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_FAST_ROOMS === "1";
  if (fastAllowed && new URL(request.url).searchParams.get("fast") === "1") {
    room.settings = { chatSeconds: 25, voteSeconds: 15, revealSeconds: 4 };
  }
  if (await isTestClient()) room.test = true;
  try {
    await createGroupChannel(room.channelId, session.uid, `${mode === "reverse" ? "Who's the Human" : "Who's the Bot"} · ${code}`, [session.uid]);
  } catch (err) {
    console.error("[rooms] group create failed", err);
    return Response.json({ error: "Could not open a chat room. Try again." }, { status: 502 });
  }
  await saveRoom(room);
  return Response.json({ code });
}
