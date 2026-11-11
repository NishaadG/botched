import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineLine } from "../src/lib/bot/offline";
import { PROMPTS } from "../src/lib/game/content";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const base = { promptIndex: 0, myAlias: "Mango Fox", others: ["Teal Otter", "Violet Owl"], said: [] as string[] };

test("answers the round's prompt from that prompt's pool, for every prompt", () => {
  for (let i = 0; i < PROMPTS.length; i++) {
    const { say, thought } = offlineLine({ ...base, promptIndex: i, trigger: "prompt" }, seq(0.5));
    assert.ok(say.length > 3, `prompt ${i} has an answer`);
    assert.ok(thought.length > 10);
  }
});

test("never repeats a line while unused ones remain", () => {
  const said: string[] = [];
  for (let i = 0; i < 4; i++) said.push(offlineLine({ ...base, trigger: "prompt", said }, seq(0)).say);
  assert.equal(new Set(said).size, 4);
});

test("when accused, it defends itself and never names itself", () => {
  const out = offlineLine(
    { ...base, trigger: "reply", last: { alias: "Teal Otter", text: "mango is 100% the bot" } },
    seq(0.9, 0.3, 0.2, 0.7),
  );
  assert.doesNotMatch(out.say, /\{|\}/);
  assert.doesNotMatch(out.say.toLowerCase(), /mango/);
  assert.match(out.thought, /accus|onto me|Pinned|Deflect/i);
});

test("reacts to the last speaker by name and fills every placeholder", () => {
  for (const r of [0.05, 0.3, 0.55, 0.8]) {
    const out = offlineLine({ ...base, trigger: "reply", last: { alias: "Violet Owl", text: "i love maggi" } }, seq(r));
    assert.doesNotMatch(out.say, /\{|\}/);
  }
});
