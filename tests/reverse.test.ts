import { test } from "node:test";
import assert from "node:assert/strict";
import { castVote, createRoom, join, start, tick, viewFor } from "../src/lib/game/engine";
import { humanScore, offlineLine } from "../src/lib/bot/offline";

const T0 = 1_000_000;
const AIS = [
  { id: "a1", personaId: "assistant" },
  { id: "a2", personaId: "analyst" },
  { id: "a3", personaId: "literal" },
];

function solo() {
  const room = createRoom("SOLOX", { id: "h0", name: "Asha" }, T0, "reverse");
  start(room, "h0", AIS, T0);
  return room;
}

test("a reverse game starts with one human and three AIs, and is closed to others", () => {
  const room = solo();
  assert.equal(room.players.length, 4);
  assert.equal(room.bots.length, 3);
  assert.equal(room.maxRounds, 3);
  const lobby = createRoom("SOLOY", { id: "h0", name: "Asha" }, T0, "reverse");
  assert.throws(() => join(lobby, { id: "h1", name: "Kabir" }, T0), /solo/);
});

test("the AIs win the moment they vote out the human", () => {
  const room = solo();
  tick(room, T0 + 91_000);
  for (const a of AIS) castVote(room, a.id, "h0", T0);
  castVote(room, "h0", "a1", T0);
  assert.equal(room.eliminations[0].playerId, "h0");
  tick(room, T0 + 200_000);
  assert.equal(room.phase, "over");
  assert.equal(room.winner, "bot");
});

test("the human wins by surviving every round, even after the AIs vote out one of their own", () => {
  const room = solo();
  let now = T0;
  for (let round = 1; room.phase !== "over" && round <= 3; round++) {
    now += 91_000;
    tick(room, now);
    const aliveAis = AIS.filter((a) => room.players.find((p) => p.id === a.id)?.alive);
    // The AIs gang up on one of their own; the human joins in.
    const target = aliveAis[0].id;
    for (const a of aliveAis) castVote(room, a.id, a.id === target ? aliveAis[1]?.id ?? "h0" : target, now);
    castVote(room, "h0", target, now);
    now += 40_000;
    tick(room, now);
  }
  assert.equal(room.phase, "over");
  assert.equal(room.winner, "humans");
  const view = viewFor(room, "h0");
  assert.equal(view.mode, "reverse");
  assert.equal(view.players.filter((p) => p.isBot).length, 3);
});

test("offline AIs answer like models and call out human tells", () => {
  const ctx = { mode: "reverse" as const, promptIndex: 2, myAlias: "Teal Otter", others: ["Mango Fox", "Gold Lion"], said: [] };
  const answer = offlineLine({ ...ctx, trigger: "prompt" }, () => 0.1);
  assert.match(answer.say, /^[A-Z]/);
  const accuse = offlineLine({ ...ctx, trigger: "reply", last: { alias: "Mango Fox", text: "lol bro same 😭" } }, () => 0.1);
  assert.match(accuse.say, /mango/i);
  assert.doesNotMatch(accuse.say, /\{|\}/);
});

test("the human detector scores slang and emoji above model-like text", () => {
  const human = humanScore(["lol bro same 😭", "nahhh thats crazy"]);
  const model = humanScore(["Based on aggregated data, the typical answer is rest.", "Acknowledged. Updating my analysis."]);
  assert.ok(human > model, `${human} > ${model}`);
});
