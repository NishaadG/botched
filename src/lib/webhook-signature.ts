import { createHash, timingSafeEqual } from "node:crypto";

/** Nexconn webhook signature: lowercase hex sha1(AppSecret + Nonce + Timestamp). Rejects requests older than `maxAgeMs`. */
export function checkWebhookSignature(
  secret: string | undefined,
  nonce: string | null,
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
  maxAgeMs = 5 * 60_000,
) {
  if (!secret || !nonce || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAgeMs) return false;
  const expected = Buffer.from(createHash("sha1").update(secret + nonce + timestamp).digest("hex"));
  const given = Buffer.from(signature.toLowerCase());
  return expected.length === given.length && timingSafeEqual(expected, given);
}
