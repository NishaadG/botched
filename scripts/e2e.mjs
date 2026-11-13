// End-to-end smoke test: N browser players play a full game of Who's the Bot over Nexconn.
// Usage: node scripts/e2e.mjs [baseUrl] [players]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const N = Number(process.argv[3] ?? 3);
const OUT = process.env.E2E_OUT ?? "e2e-shots";
mkdirSync(OUT, { recursive: true });
const NAMES = ["Asha", "Kabir", "Meera", "Dev", "Isha"].slice(0, N);
const LINES = [
  "honestly the last trip was pure chaos, we missed the train",
  "lol same, my sunday was just sleeping till 2",
  "wait who here actually likes pineapple pizza",
  "that sounds made up ngl",
  "ok which one of you is typing like a robot",
];

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const errors = [];
const players = [];
for (const name of NAMES) {
  // The second player is on a phone, the rest on laptops.
  const phone = name === NAMES[1];
  const ctx = await browser.newContext(
    phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } },
  );
  await ctx.addCookies([{ name: "botched_test", value: "1", url: BASE }]); // keep test games out of public stats
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name} console: ${m.text()}`);
    if (name === NAMES[0] && m.text().startsWith("[nc]")) console.log("  ", m.text());
  });
  players.push({ name, page });
}

const [host, ...guests] = players;
await host.page.goto(`${BASE}/play/whos-the-bot`);
await host.page.fill("#nick", host.name);
await host.page.click("text=Continue");
await host.page.waitForSelector("text=Create a room");
const code = await host.page.evaluate(async () => (await (await fetch("/api/rooms?fast=1", { method: "POST" })).json()).code);
console.log("room", code);
await host.page.goto(`${BASE}/r/${code}`);

for (const g of guests) {
  await g.page.goto(`${BASE}/r/${code}`);
  await g.page.fill("#nick", g.name);
  await g.page.click("text=Join the game");
}
await host.page.waitForFunction((n) => document.body.innerText.includes(`In the room (${n}/8)`), N, { timeout: 20000 });
await host.page.screenshot({ path: `${OUT}/1-lobby.png` });
await host.page.click("text=Start the game");

for (const p of players) await p.page.waitForSelector("text=Round 1", { timeout: 20000 });
console.log("game started");
await new Promise((r) => setTimeout(r, 2500));
for (const [i, p] of players.entries()) {
  await p.page.fill('input[aria-label="Message"]', LINES[i % LINES.length]);
  await p.page.click('button[aria-label="Send"]');
  await new Promise((r) => setTimeout(r, 1500));
}
await new Promise((r) => setTimeout(r, 9000));
await host.page.screenshot({ path: `${OUT}/2-chat.png` });
await guests[0].page.screenshot({ path: `${OUT}/2b-chat-guest.png` });

// Every round: wait for voting, everyone votes for the first option they see.
for (let round = 1; round <= 5; round++) {
  const over = await host.page.getByText("Who is the bot?").or(host.page.getByText("Game over")).first().waitFor({ timeout: 150000 }).then(
    async () => (await host.page.innerText("body")).includes("Game over"),
  );
  if (over) break;
  if (round === 1) {
    await host.page.screenshot({ path: `${OUT}/3-vote.png` });
    await guests[0].page.screenshot({ path: `${OUT}/3b-vote-phone.png` });
  }
  for (const p of players) {
    const btn = p.page.locator(".absolute.inset-x-0 button").first();
    if (await btn.count()) await btn.click().catch(() => {});
  }
  await host.page.getByText("was voted out").or(host.page.getByText("Tie vote")).first().waitFor({ timeout: 40000 }).catch(() => {});
  await host.page.screenshot({ path: `${OUT}/4-reveal-r${round}.png` });
  const text = await host.page.innerText("body");
  if (text.includes("Game over")) break;
  await host.page.waitForTimeout(5000);
  if ((await host.page.innerText("body")).includes("Game over")) break;
}
await host.page.waitForSelector("text=Game over", { timeout: 150000 });
await host.page.waitForTimeout(1500);
await host.page.screenshot({ path: `${OUT}/5-results.png`, fullPage: true });
writeFileSync(`${OUT}/5-results.txt`, await host.page.innerText("body"));
console.log("result:", (await host.page.innerText("h1")).trim());

// Post-game feedback from the host.
await host.page.click('button[aria-label="Really fun"]');
await host.page.fill('input[aria-label="Comment"]', "the bot's typos were way too convincing");
await host.page.click("text=Send");
await host.page.waitForSelector("text=Thanks!", { timeout: 10000 });
console.log("feedback sent");
// Rematch: one player starts it, the others see a join button and land in the same new room.
await guests[0].page.waitForSelector("text=Game over", { timeout: 30000 });
await guests[0].page.click("text=Play again");
await guests[0].page.waitForURL((u) => !u.pathname.endsWith(code), { timeout: 20000 });
const next = guests[0].page.url().split("/").pop();
await host.page.goto(`${BASE}/r/${code}`);
await host.page.waitForSelector("text=Join the rematch", { timeout: 20000 });
await host.page.click("text=Join the rematch");
await host.page.waitForURL(`**/r/${next}`, { timeout: 20000 });
await host.page.waitForFunction(() => document.body.innerText.includes("In the room (2/8)"), null, { timeout: 20000 });
console.log("rematch: both players in", next);
await host.page.goto(`${BASE}/stats`);
await host.page.waitForSelector("text=Live numbers", { timeout: 10000 });
await host.page.screenshot({ path: `${OUT}/6-stats.png`, fullPage: true });
// Test games are kept out of public stats, so their feedback only shows up when testing locally.
console.log("stats page loads");
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no browser errors");
await browser.close();
