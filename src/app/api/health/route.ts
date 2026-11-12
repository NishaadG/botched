import { kv } from "@/lib/store";

/** Which services are configured (never their values) and whether the store answers. */
export async function GET() {
  const has = (k: string) => Boolean(process.env[k]);
  const store: "upstash" | "memory" = has("UPSTASH_REDIS_REST_URL") && has("UPSTASH_REDIS_REST_TOKEN") ? "upstash" : "memory";
  let storeOk = false;
  try {
    await kv.set("health:ping", Date.now(), 60);
    storeOk = Boolean(await kv.get("health:ping"));
  } catch {
    storeOk = false;
  }
  return Response.json(
    {
      ok: storeOk && has("NEXCONN_APP_SECRET"),
      chat: has("NEXT_PUBLIC_NEXCONN_APP_KEY") && has("NEXCONN_APP_SECRET"),
      store,
      storeOk,
      llm: { groq: has("GROQ_API_KEY"), gemini: has("GEMINI_API_KEY") },
      region: process.env.VERCEL_REGION ?? "local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
