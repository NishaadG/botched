import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Guest identity: no sign-up, just a nickname. Stored in a signed, httpOnly cookie. */
export interface Session {
  uid: string;
  name: string;
  token: string;
  createdAt: number;
}

const COOKIE = "botched_session";
const SECRET = process.env.SESSION_SECRET || "dev-only-secret-change-me";

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value);
}

export async function saveSession(session: Session) {
  const store = await cookies();
  store.set(COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function newUserId() {
  return "p_" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase();
}

export function cleanName(input: unknown) {
  return String(input ?? "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim()
    .slice(0, 20);
}
