import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { checkWebhookSignature } from "../src/lib/webhook-signature";
import { allowGameMessage, codeFromChannel } from "../src/lib/game/moderation";
import { castVote, createRoom, join, start, tick } from "../src/lib/game/engine";
import { answerAll } from "./helpers";

const sign = (secret: string, nonce: string, ts: string) => createHash("sha1").update(secret + nonce + ts).digest("hex");

test("webhook signature: valid, tampered, stale and missing", () => {
  const now = 1_700_000_000_000;
  const ts = String(now);
  assert.equal(checkWebhookSignature("s3cret", "abc", ts, sign("s3cret", "abc", ts), now), true);
  assert.equal(checkWebhookSignature("s3cret", "abc", ts, sign("s3cret", "abc", ts).toUpperCase(), now), true);
  assert.equal(checkWebhookSignature("s3cret", "abd", ts, sign("s3cret", "abc", ts), now), false);
  assert.equal(checkWebhookSignature("s3cret", "abc", ts, sign("s3cret", "abc", ts), now + 10 * 60_000), false);
  assert.equal(checkWebhookSignature(undefined, "abc", ts, sign("", "abc", ts), now), false);
  assert.equal(checkWebhookSignature("s3cret", null, ts, "x", now), false);
});

test("only game channels map to a room code", () => {
  assert.equal(codeFromChannel("wtb_ABCDE"), "ABCDE");
  assert.equal(codeFromChannel("botched_lounge"), null);
  assert.equal(codeFromChannel("wtb_abcde"), null);
});

test("pre-messaging lets living players talk only during the chat phase", () => {
  const T0 = 1_000_000;
  const room = createRoom("ABCDE", { id: "h0", name: "Asha" }, T0);
  join(room, { id: "h1", name: "Kabir" }, T0);
  join(room, { id: "h2", name: "Meera" }, T0);
  assert.equal(allowGameMessage(room, "h0"), false, "no chat in the lobby");
  start(room, "h0", [{ id: "bot1", personaId: "chill" }], T0);
  assert.equal(allowGameMessage(room, "h1"), false, "no chat while answering privately");
  answerAll(room, T0);
  assert.equal(allowGameMessage(room, "h1"), true);
  assert.equal(allowGameMessage(room, "stranger"), false);
  assert.equal(allowGameMessage(room, "gm_botched"), true);
  tick(room, T0 + 91_000);
  assert.equal(room.phase, "vote");
  assert.equal(allowGameMessage(room, "h1"), false, "chat is locked while voting");
  assert.equal(allowGameMessage(room, "bot1"), true, "server-side senders are never blocked");
  castVote(room, "h0", "h2", T0);
  castVote(room, "h1", "h2", T0);
  castVote(room, "bot1", "h2", T0);
  castVote(room, "h2", "h0", T0);
  tick(room, T0 + 200_000);
  answerAll(room, T0 + 200_000);
  assert.equal(room.phase, "chat");
  assert.equal(allowGameMessage(room, "h2"), false, "eliminated players can't chat");
  assert.equal(allowGameMessage(room, "h0"), true);
});
