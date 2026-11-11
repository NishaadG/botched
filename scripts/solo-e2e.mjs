// One player plays "Who's the Human" alone against three AIs, start to finish.
// Usage: node scripts/solo-e2e.mjs [baseUrl]   (server with ALLOW_FAST_ROOMS=1 for short rounds)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = process.env.E2E_OUT ?? "e2e-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

await page.goto(`${BASE}/play/whos-the-bot`);
await page.fill("#nick", "Solo");
await page.click("text=Continue");
await page.waitForSelector("text=Play solo vs 3 AIs");
const code = await page.evaluate(async () => (await (await fetch("/api/rooms?fast=1&mode=reverse", { method: "POST" })).json()).code);
await page.goto(`${BASE}/r/${code}`);
await page.waitForSelector("text=You vs three AIs");
await page.screenshot({ path: `${OUT}/solo-1-lobby.png` });
await page.click("text=Start the solo game");
await page.waitForSelector("text=Round 1", { timeout: 20000 });
console.log("solo game", code, "started");
await page.waitForTimeout(2000);
await page.fill('input[aria-label="Message"]', "Processing the prompt. My answer: I slept, which is optimal.");
await page.click('button[aria-label="Send"]');

const lines = [
  "Based on my training data, the optimal answer is rest.",
  "Acknowledged. I process Sundays as low-priority time.",
  "Statistically, most humans would say the same.",
];
for (let round = 1; round <= 3; round++) {
  const over = await page.getByText("Who is the human?", { exact: true }).or(page.getByText("Game over")).first().waitFor({ timeout: 60000 })
    .then(async () => (await page.innerText("body")).includes("Game over"));
  if (over) break;
  if (round === 1) await page.screenshot({ path: `${OUT}/solo-2-vote.png` });
  await page.locator(".absolute.inset-x-0 button").first().click().catch(() => {});
  await page.getByText("was voted out").or(page.getByText("Tie vote")).or(page.getByText("tie")).first().waitFor({ timeout: 40000 }).catch(() => {});
  // Next round, or the AIs already found the human.
  await page.getByText(`Round ${round + 1}`).or(page.getByText("Game over")).first().waitFor({ timeout: 40000 }).catch(() => {});
  if ((await page.innerText("body")).includes("Game over")) break;
  const input = page.locator('input[aria-label="Message"]');
  if ((await input.count()) && !(await input.isDisabled())) {
    await input.fill(lines[round % lines.length]);
    await page.click('button[aria-label="Send"]');
  }
}
await page.waitForSelector("text=Game over", { timeout: 90000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/solo-3-results.png`, fullPage: true });
console.log("result:", (await page.innerText("h1")).trim());
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no browser errors");
await browser.close();
