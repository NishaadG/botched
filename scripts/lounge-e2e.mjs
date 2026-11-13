// Two players meet in the lounge (a Nexconn open channel), chat, and one hosts a game that the other joins from the invite.
// Usage: node scripts/lounge-e2e.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = process.env.E2E_OUT ?? "e2e-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const errors = [];
const open = async (name, viewport) => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "botched_test", value: "1", url: BASE }]); // keep test visits out of public stats
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`${BASE}/lounge`);
  await page.fill("#nick", name);
  await page.click("text=Enter the lounge");
  await page.waitForSelector("text=recently active");
  await page.waitForFunction(() => !document.querySelector('input[aria-label="Lounge message"]')?.disabled, null, { timeout: 20000 });
  return page;
};
const a = await open("Asha", { width: 1280, height: 800 });
const b = await open("Kabir", { width: 390, height: 844 });
const stamp = Date.now().toString(36).slice(-4);
const say = async (page, text) => {
  await page.fill('input[aria-label="Lounge message"]', text);
  await page.click('button[aria-label="Send"]');
};
await say(a, `anyone up for a game? ${stamp}`);
await b.waitForSelector(`text=anyone up for a game? ${stamp}`, { timeout: 15000 });
console.log("Kabir received Asha's message");
await say(b, `yes! ${stamp}`);
await a.waitForSelector(`text=yes! ${stamp}`, { timeout: 15000 });
console.log("Asha received Kabir's reply");
await a.click("text=Host & post a game");
await a.waitForURL(/\/r\/[A-Z]+$/, { timeout: 20000 });
const code = a.url().split("/").pop();
console.log("Asha hosting", code);
await b.waitForSelector(`text=Join ${code}`, { timeout: 15000 });
await b.screenshot({ path: `${OUT}/lounge-invite.png` });
await b.click(`text=Join ${code}`);
await a.waitForFunction(() => document.body.innerText.includes("In the room (2/8)"), null, { timeout: 20000 });
console.log("Kabir joined from the lounge invite");
await a.screenshot({ path: `${OUT}/lounge-lobby.png` });
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no browser errors");
await browser.close();
