import { test } from "node:test";
import assert from "node:assert/strict";
import { addMessage, castVote, createRoom, join, start, tick, tickDue, viewFor } from "../src/lib/game/engine";

const T0 = 1_000_000;
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

function setup(humans = 3) {
  const room = createRoom("ABCDE", { id: "h0", name: "Asha" }, T0);
  for (let i = 1; i < humans; i++) join(room, { id: `h${i}`, name: `P${i}` }, T0);
  start(room, "h0", [{ id: "bot1", personaId: "chill" }], T0, seq(0.3, 0.7, 0.1));
  return room;
}

test("only the host can start, and only with enough players", () => {
  const room = createRoom("ABCDE", { id: "h0", name: "Asha" }, T0);
  assert.throws(() => start(room, "h0", [{ id: "b", personaId: "chill" }], T0), /at least 2/);
  join(room, { id: "h1", name: "Kabir" }, T0);
  assert.throws(() => start(room, "h1", [{ id: "b", personaId: "chill" }], T0), /host/);
  start(room, "h0", [{ id: "b", personaId: "chill" }], T0);
  assert.equal(room.phase, "chat");
  assert.equal(room.players.length, 3);
});

test("every player, bot included, gets a unique alias", () => {
  const room = setup(4);
  const aliases = room.players.map((p) => p.alias);
  assert.equal(new Set(aliases).size, aliases.length);
  assert.ok(aliases.every(Boolean));
});

test("players cannot see who the bot is or real names during the game", () => {
  const room = setup(3);
  const v = viewFor(room, "h1");
  assert.ok(v.players.every((p) => p.isBot === null));
  assert.ok(v.players.filter((p) => p.id !== "h1").every((p) => p.name === null));
  assert.equal(v.botThoughts.length, 0);
});

test("chat only counts during the chat phase and dedupes by message id", () => {
  const room = setup(3);
  addMessage(room, { id: "m1", from: "h1", text: "hi", at: T0 }, T0);
  addMessage(room, { id: "m1", from: "h1", text: "hi", at: T0 }, T0);
  assert.equal(room.transcript.length, 1);
  tick(room, T0 + 91_000);
  assert.equal(room.phase, "vote");
  addMessage(room, { id: "m2", from: "h1", text: "late", at: T0 }, T0);
  assert.equal(room.transcript.length, 1);
});

test("voting out the bot ends the game with a human win", () => {
  const room = setup(3);
  tick(room, T0 + 91_000);
  for (const id of ["h0", "h1", "h2"]) castVote(room, id, "bot1", T0 + 92_000);
  castVote(room, "bot1", "h0", T0 + 93_000);
  assert.equal(room.phase, "reveal");
  assert.equal(room.eliminations[0].wasBot, true);
  tick(room, T0 + 200_000);
  assert.equal(room.phase, "over");
  assert.equal(room.winner, "humans");
  assert.equal(viewFor(room, "h0").players.find((p) => p.id === "bot1")?.isBot, true);
});

test("a tie eliminates nobody and the next round starts", () => {
  const room = setup(3);
  tick(room, T0 + 91_000);
  castVote(room, "h0", "h1", T0);
  castVote(room, "h1", "h2", T0);
  castVote(room, "h2", "bot1", T0);
  castVote(room, "bot1", "h0", T0);
  assert.equal(room.eliminations[0].playerId, null);
  tick(room, T0 + 200_000);
  assert.equal(room.phase, "chat");
  assert.equal(room.round, 2);
});

test("the bot wins when only one human is left with it", () => {
  const room = setup(2);
  tick(room, T0 + 91_000);
  castVote(room, "h0", "h1", T0);
  castVote(room, "bot1", "h1", T0);
  castVote(room, "h1", "bot1", T0);
  assert.equal(room.eliminations[0].playerId, "h1");
  tick(room, T0 + 200_000);
  assert.equal(room.winner, "bot");
});

test("you cannot vote for yourself or for someone already out", () => {
  const room = setup(3);
  tick(room, T0 + 91_000);
  assert.throws(() => castVote(room, "h0", "h0", T0), /someone else/);
});

test("the bot's planned message is delivered only after its typing delay", () => {
  const room = setup(3);
  room.bots[0].plan = { text: "lol same", typingAt: T0 + 2000, dueAt: T0 + 5000, typingSent: false, reason: "reply" };
  assert.deepEqual(tick(room, T0 + 1000), []);
  assert.deepEqual(tick(room, T0 + 2500), [{ type: "botTyping", botId: "bot1" }]);
  assert.deepEqual(tick(room, T0 + 5100), [{ type: "botSay", botId: "bot1", text: "lol same" }]);
  assert.equal(room.bots[0].plan, null);
});

test("ticks are only due when a timer ran out or the bot has something to deliver", () => {
  const room = setup(3);
  assert.equal(tickDue(room, T0 + 1000), false);
  room.bots[0].plan = { text: "hm", typingAt: T0 + 2000, dueAt: T0 + 5000, typingSent: false, reason: "reply" };
  assert.equal(tickDue(room, T0 + 1500), false);
  assert.equal(tickDue(room, T0 + 2500), true);
  tick(room, T0 + 2500);
  assert.equal(tickDue(room, T0 + 3000), false);
  assert.equal(tickDue(room, T0 + 5100), true);
  tick(room, T0 + 5100);
  assert.equal(tickDue(room, T0 + 91_000), true, "chat phase ended");
  const lobby = createRoom("QWERT", { id: "a", name: "A" }, T0);
  assert.equal(tickDue(lobby, T0 + 10_000_000), false, "lobbies never tick");
});

test("a silent chat gets one nudge from an AI, and not again until it goes quiet again", () => {
  const room = setup(3);
  assert.deepEqual(tick(room, T0 + 10_000), []);
  const first = tick(room, T0 + 19_000);
  assert.deepEqual(first, [{ type: "planBot", trigger: "nudge", botId: "bot1" }]);
  assert.deepEqual(tick(room, T0 + 25_000), [], "no second nudge right away");
  addMessage(room, { id: "m1", from: "h1", text: "ok fine", at: T0 + 30_000 }, T0 + 30_000);
  assert.deepEqual(tick(room, T0 + 40_000), [], "someone spoke recently");
  assert.equal(tick(room, T0 + 49_000).length, 1, "quiet again, nudge again");
  assert.deepEqual(tick(room, T0 + 85_000), [], "too close to the vote");
});
