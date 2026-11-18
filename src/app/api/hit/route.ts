import { isTestClient } from "@/lib/session";
import { clientIp, limited } from "@/lib/store";
import { cleanSource, isBot, recordVisit, referrerSource, visitorId } from "@/lib/visits";

/** Page-view beacon. Always answers 204 so it never shows up as an error in the browser. */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua) || (await isTestClient())) return done;
  const ip = clientIp(request);
  if (await limited(`hit:${ip}`, 120, 600)) return done;
  const body = (await request.json().catch(() => ({}))) as { source?: string; referrer?: string };
  const own = new URL(request.url).hostname;
  const source = cleanSource(body.source) || referrerSource(body.referrer, own);
  await recordVisit(visitorId(ip, ua), source);
  return done;
}
