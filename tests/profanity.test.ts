import { test } from "node:test";
import assert from "node:assert/strict";
import { hasProfanity, maskProfanity } from "../src/lib/profanity";

test("masks swears as whole words, case-insensitively, and leaves normal words alone", () => {
  assert.equal(maskProfanity("what the FUCK bro"), "what the F*** bro");
  assert.equal(maskProfanity("this is shit"), "this is s***");
  assert.equal(maskProfanity("class assignment, scunthorpe, dickens"), "class assignment, scunthorpe, dickens");
  assert.equal(hasProfanity("hello there"), false);
  assert.equal(hasProfanity("chutiya"), true);
});
