import "server-only";
import { createOpenChannel } from "./nexconn-server";
import { kv } from "./store";

/** Makes sure the public lounge (a Nexconn open channel) exists. Re-created lazily if it ever expires. */
export async function ensureLounge(id: string) {
  if (await kv.get(`lounge:ready:${id}`)) return;
  try {
    await createOpenChannel(id);
  } catch (err) {
    // Already exists is fine; anything else is logged and the client will surface a connect error.
    console.warn("[lounge] create", err instanceof Error ? err.message : err);
  }
  await kv.set(`lounge:ready:${id}`, 1, 60 * 30);
}
