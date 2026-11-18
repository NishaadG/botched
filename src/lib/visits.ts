import "server-only";
import { createHash, createHmac } from "node:crypto";
import { dayKey } from "./stats";
import { kv } from "./store";

/**
 * Anonymous visit counting, no cookie. A visitor is a one-way hash of network address + browser,
 * keyed with a secret that changes every UTC day, so the same person can't be linked across days
 * and the raw address is never stored.
 */

const SECRET = process.env.SESSION_SECRET || "dev-only-secret-change-me";

/** "reel1", "yt-2", "instagram.com". Anything else is dropped. */
export function cleanSource(raw: unknown) {
  if (typeof raw !== "string") return "";
  const s = raw.trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9][a-z0-9._-]*$/.test(s) ? s : "";
}

/** Referrer URL → a short site name, e.g. "l.instagram.com" → "instagram.com". Own pages count as nothing. */
export function referrerSource(referrer: unknown, ownHost: string) {
  if (typeof referrer !== "string" || !referrer) return "";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (!host || host === ownHost) return "";
    const parts = host.replace(/^(www|m|l|lm|out)\./, "").split(".");
    // Keep the registrable-ish tail: youtube.com, t.co, google.co.in.
    const tail = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts.slice(-3) : parts.slice(-2);
    return cleanSource(tail.join("."));
  } catch {
    return "";
  }
}

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|embedly|vercel|curl|wget|python|node-fetch|playwright/i;

export function isBot(ua: string) {
  return !ua || BOTS.test(ua);
}

export function visitorId(ip: string, ua: string, day = dayKey()) {
  const key = createHmac("sha256", SECRET).update(`visit:${day}`).digest();
  return createHash("sha256").update(key).update(`${ip}|${ua}`).digest("base64url").slice(0, 22);
}

/** Records one page view. Returns whether this was the visitor's first page today. */
export async function recordVisit(id: string, source: string) {
  const day = dayKey();
  const [fresh] = await Promise.all([kv.sadd(`day:site:${day}`, id), kv.incr("stats:pageviews"), kv.incr(`day:pageviews:${day}`)]);
  if (fresh) {
    await Promise.all([kv.incr("stats:sitevisits"), kv.zincr("src:visits", source || "direct", 1)]);
  }
  return fresh === 1;
}

export async function getSources(n = 8) {
  const [visits, players] = await Promise.all([kv.ztop("src:visits", n), kv.ztop("src:players", 50)]);
  const p = Object.fromEntries(players.map((r) => [r.member, r.score]));
  return visits.map((r) => ({ source: r.member, visits: r.score, players: p[r.member] ?? 0 }));
}
