import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Minimal signed client for the Nexconn Platform Chat API (v4).
 * Signature = sha1(AppSecret + Nonce + Timestamp), with primary/backup domain failover.
 */

const APP_KEY = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "";
const APP_SECRET = process.env.NEXCONN_APP_SECRET ?? "";
const DOMAINS = [process.env.NEXCONN_PRIMARY_API_DOMAIN, process.env.NEXCONN_SECONDARY_API_DOMAIN].filter(
  (d): d is string => Boolean(d),
);

export class NexconnError extends Error {
  constructor(
    public code: number,
    message: string,
    public path: string,
  ) {
    super(`Nexconn ${path} failed (${code}): ${message}`);
  }
}

type ApiResponse<T> = { code: number; result?: T; errorMessage?: string };

async function call<T = unknown>(path: string, body: unknown): Promise<T | undefined> {
  if (!APP_KEY || !APP_SECRET || DOMAINS.length === 0) {
    throw new NexconnError(-1, "Nexconn credentials are not configured", path);
  }
  const nonce = randomBytes(8).toString("hex");
  const timestamp = String(Date.now());
  const signature = createHash("sha1").update(APP_SECRET + nonce + timestamp).digest("hex");
  let lastError: unknown;
  for (const base of DOMAINS) {
    try {
      const res = await fetch(base + path, {
        method: "POST",
        headers: {
          "App-Key": APP_KEY,
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      const json = (await res.json()) as ApiResponse<T>;
      if (json.code !== 0) throw new NexconnError(json.code, json.errorMessage ?? `HTTP ${res.status}`, path);
      return json.result;
    } catch (err) {
      // An API-level error is final; only network failures fall through to the backup domain.
      if (err instanceof NexconnError) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function issueAccessToken(userId: string, name: string, avatarUrl?: string) {
  const result = await call<{ userId: string; accessToken: string }>("/v4/auth/access-token/issue", {
    userId,
    name,
    ...(avatarUrl ? { avatarUrl } : {}),
  });
  if (!result?.accessToken) throw new NexconnError(-2, "No access token returned", "/v4/auth/access-token/issue");
  return result.accessToken;
}

export function createGroupChannel(channelId: string, owner: string, name: string, userIds: string[]) {
  return call("/v4/group-channel/create", { channelId, owner, name, userIds });
}

export function joinGroupChannel(channelId: string, userIds: string[]) {
  return call("/v4/group-channel/join", { channelId, userIds });
}

export function dismissGroupChannel(channelId: string, owner: string) {
  return call("/v4/group-channel/dismiss", { channelId, owner });
}

export const TEXT_MESSAGE = "RC:TxtMsg";
/** Persisted game event (phase changes, votes, reveals). Registered on the client as well. */
export const GAME_EVENT_MESSAGE = "BT:Game";
/** Transient "someone is typing" signal, works in group channels unlike the built-in typing status. */
export const TYPING_MESSAGE = "BT:Typing";

export function sendGroupText(channelId: string, fromUserId: string, text: string) {
  return call<{ messageIds: { messageId: string }[] }>("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [channelId],
    messageType: TEXT_MESSAGE,
    content: JSON.stringify({ content: text }),
    isEchoToSender: 0,
  });
}

export function sendGroupEvent(channelId: string, fromUserId: string, event: Record<string, unknown>, persist = true) {
  return call("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [channelId],
    messageType: persist ? GAME_EVENT_MESSAGE : TYPING_MESSAGE,
    content: JSON.stringify(event),
    shouldPersist: persist ? 1 : 0,
    disablePush: true,
    disableUpdateLastMsg: !persist,
  });
}

export function createOpenChannel(channelId: string) {
  return call("/v4/open-channel/create", { channelId, destroyType: 0, ttlMinutes: 10080 });
}

export function sendOpenText(channelId: string, fromUserId: string, text: string, extra?: Record<string, unknown>) {
  return call("/v4/open-channel/message/send", {
    fromUserId,
    toChannelIds: [channelId],
    messageType: TEXT_MESSAGE,
    content: JSON.stringify({ content: text, user: { id: fromUserId, name: "Game Master" }, extra: extra ? JSON.stringify(extra) : undefined }),
    shouldPersist: 1,
  });
}

/** Verifies the signature Nexconn puts on webhook deliveries. */
export function verifyWebhookSignature(nonce: string | null, timestamp: string | null, signature: string | null) {
  if (!nonce || !timestamp || !signature || !APP_SECRET) return false;
  const expected = createHash("sha1").update(APP_SECRET + nonce + timestamp).digest("hex");
  return expected === signature.toLowerCase();
}
