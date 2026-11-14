import { GM_ID, LOUNGE_ID, TEST_LOUNGE_ID } from "@/lib/constants";
import { loadRoom, onlineIn, openRoom } from "@/lib/game/runner";
import { ensureLounge } from "@/lib/lounge";
import { sendOpenText } from "@/lib/nexconn-server";
import { getSession, isTestClient } from "@/lib/session";
import { kv, limited } from "@/lib/store";
import type { Room } from "@/lib/game/types";

/**
 * Quick match: everyone who presses "Find a game" lands in the same open lobby until it starts.
 * Real people only. The lobby starts itself once 3 are in (see the lobby screen).
 */
const OPEN_TTL = 15 * 60;
const MAX_IN_MATCH = 8;

const openKey = (test: boolean) => (test ? "match:open:test" : "match:open");

async function openMatch(test: boolean): Promise<Room | null> {
  const code = await kv.get<string>(openKey(test));
  const room = code ? await loadRoom(code) : null;
  if (!room || room.phase !== "lobby" || !room.matchmade) return null;
  if (room.players.length >= MAX_IN_MATCH) return null;
  return room;
}

export async function GET() {
  const room = await openMatch(await isTestClient());
  const waiting = room ? (await onlineIn(room)).length : 0;
  return Response.json({ waiting }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  if (await limited(`match:${session.uid}`, 20, 600)) {
    return Response.json({ error: "Slow down a little and try again soon." }, { status: 429 });
  }
  const test = await isTestClient();
  const existing = await openMatch(test);
  if (existing) return Response.json({ code: existing.code });

  // Only one request opens the next quick-match lobby; the others wait for it.
  if (!(await kv.lock(`match:opening:${test ? "t" : "p"}`, 10_000))) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const room = await openMatch(test);
      if (room) return Response.json({ code: room.code });
    }
    return Response.json({ error: "Try again in a second." }, { status: 409 });
  }
  try {
    const room = await openRoom({ id: session.uid, name: session.name }, { mode: "classic", test, matchmade: true });
    await kv.set(openKey(test), room.code, OPEN_TTL);
    // Let the lounge know a public game is forming.
    const lounge = test ? TEST_LOUNGE_ID : LOUNGE_ID;
    ensureLounge(lounge)
      .then(() =>
        sendOpenText(lounge, GM_ID, "A quick match of Who's the Bot is forming. Hop in!", { kind: "invite", code: room.code, players: 1 }),
      )
      .catch(() => {});
    return Response.json({ code: room.code });
  } catch (err) {
    console.error("[match] open failed", err);
    return Response.json({ error: "Could not open a match. Try again." }, { status: 502 });
  } finally {
    await kv.unlock(`match:opening:${test ? "t" : "p"}`);
  }
}
