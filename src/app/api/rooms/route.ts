import { isSoloVariant } from "@/lib/game/modes";
import { openRoom } from "@/lib/game/runner";
import { getSession, isTestClient } from "@/lib/session";
import { limited } from "@/lib/store";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Choose a nickname first." }, { status: 401 });
  if (await limited(`rooms:${session.uid}`, 15, 600)) {
    return Response.json({ error: "You've opened a lot of rooms. Take a breather and try again soon." }, { status: 429 });
  }
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode") === "reverse" ? "reverse" : "classic";
  const variant = params.get("variant");
  try {
    const room = await openRoom(
      { id: session.uid, name: session.name },
      {
        mode,
        variant: mode === "reverse" && isSoloVariant(variant) ? variant : undefined,
        fast: params.get("fast") === "1",
        test: await isTestClient(),
      },
    );
    return Response.json({ code: room.code });
  } catch (err) {
    console.error("[rooms] group create failed", err);
    return Response.json({ error: "Could not open a chat room. Try again." }, { status: 502 });
  }
}
