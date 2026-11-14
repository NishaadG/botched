// One player plays a solo mode ("Who's the Human") start to finish.
// Usage: node scripts/solo-e2e.mjs [baseUrl] [variant]
//   variant: classic | blitz | crowd | hard | interrogation | oneclick (the landing page's "Play solo now" flow)
//   Run the server with ALLOW_FAST_ROOMS=1 for short rounds (not used by "oneclick").
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const VARIANT = process.argv[3] ?? "classic";
const OUT = process.env.E2E_OUT ?? "e2e-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: "botched_test", value: "1", url: BASE }]); // keep test games out of public stats
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("crash", async () => console.log("CRASH at", new Date().toISOString()));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
const shot = (name) => page.screenshot({ path: `${OUT}/solo-${VARIANT}-${name}.png` });

if (VARIANT === "oneclick") {
  await page.goto(`${BASE}/play/whos-the-bot?solo=1`);
  await page.fill("#nick", "Solo");
  await page.click("text=Play solo vs 3 AIs");
  await page.waitForURL(/\/r\/[A-Z]+$/, { timeout: 20000 });
} else {
  await page.goto(`${BASE}/play/whos-the-bot`);
  await page.fill("#nick", "Solo");
  await page.click("text=Continue");
  await page.waitForSelector("text=Room for friends");
  await shot("0-start");
  const code = await page.evaluate(
    async (v) => (await (await fetch(`/api/rooms?mode=reverse&variant=${v}&fast=1`, { method: "POST" })).json()).code,
    VARIANT,
  );
  await page.goto(`${BASE}/r/${code}`);
}
const code = page.url().split("/").pop();
await page.waitForSelector("text=AI took your job");
await shot("1-lobby");
await page.locator("main button.btn-brand").first().click();
console.log("solo", VARIANT, code, "started");

const robotic = [
  "Processing. The optimal answer is rest, at 94 percent confidence.",
  "Acknowledged. I classify Sundays as low-priority maintenance windows.",
  "Statistically, that response is consistent with a language model.",
  "Negative. I do not experience preferences. I report averages.",
];

if (VARIANT === "interrogation") {
  // The detective opens; answer every question it asks until the verdict.
  const box = page.locator('input[aria-label="Message"]');
  await box.waitFor({ state: "visible", timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    // Wait for the detective's next question (the newest line isn't ours).
    await page
      .waitForFunction(() => {
        const items = [...document.querySelectorAll("main section li")];
        const last = items.at(-1);
        return last && !last.textContent.includes("(you)") && !last.textContent.startsWith(">>");
      }, null, { timeout: 45000 })
      .catch(() => {});
    if (!(await box.isEnabled().catch(() => false))) break;
    await box.fill(robotic[i % robotic.length]);
    await page.locator("form button").click().catch(() => {});
    if (i === 1) await shot("2-questioning");
  }
} else {
  for (let round = 1; round <= 6; round++) {
    const answer = page.locator('input[aria-label="Your answer"]:enabled');
    const ready = await answer.or(page.getByText("Game over")).first().waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
    if (!ready || (await page.innerText("body")).toLowerCase().includes("game over")) break;
    if (await answer.count()) {
      await answer.fill(robotic[round % robotic.length]);
      await page.locator("form button").click();
      if (round === 1) await shot("2-answer-locked");
    }
    const box = page.locator('input[aria-label="Message"]:enabled');
    await box.waitFor({ timeout: 60000 }).catch(() => {});
    if (round === 1) {
      await page.waitForTimeout(4000);
      await shot("3-answers-revealed");
    }
    if (await box.count()) {
      await box.fill(robotic[(round + 1) % robotic.length]);
      await page.locator("form button").click().catch(() => {});
    }
    const over = await page.getByText("Who is the human?").or(page.getByText("Game over")).first().waitFor({ timeout: 120000 })
      .then(async () => (await page.innerText("body")).toLowerCase().includes("game over"));
    if (over) break;
    if (round === 1) await shot("4-vote");
    await page.locator(".absolute.inset-x-0 button").first().click().catch(() => {});
    await page.getByText("Scanning voted-out player").or(page.getByText("Nobody leaves")).first().waitFor({ timeout: 60000 }).catch(() => {});
  }
}
await page.waitForSelector("text=Game over", { timeout: 200000 }).catch(async (e) => {
  await shot("fail");
  console.log("BODY:", (await page.innerText("body")).slice(0, 1500));
  console.log(errors.join(" | "));
  throw e;
});
await page.waitForTimeout(1500);
await shot("5-results");
console.log("result:", (await page.innerText("h1")).trim());
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no browser errors");
await browser.close();
