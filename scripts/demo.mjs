// Records a demo of a real game: 4 browsers play over Nexconn, the host's screen (desktop) and one guest (phone) are recorded.
// Captions are overlaid on the recordings; add the voice-over in any editor afterwards.
// Usage: node scripts/demo.mjs [baseUrl]   (start the server with ALLOW_FAST_ROOMS=1 for short rounds)
import { chromium } from "playwright";
import { mkdirSync, renameSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = process.env.DEMO_OUT ?? "demo-video";
const NO_VIDEO = process.env.NO_VIDEO === "1"; // dry run: check the flow without recording
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const mk = async (name, viewport, record) => {
  const ctx = await browser.newContext({
    viewport,
    ...(record && !NO_VIDEO ? { recordVideo: { dir: OUT, size: viewport } } : {}),
    ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}),
  });
  await ctx.addCookies([{ name: "botched_test", value: "1", url: BASE }]); // keep test games out of public stats
  const page = await ctx.newPage();
  return { name, ctx, page };
};

const host = await mk("Asha", { width: 1280, height: 720 }, true);
const phone = await mk("Kabir", { width: 390, height: 844 }, true);
const g2 = await mk("Meera", { width: 1000, height: 700 }, false);
const g3 = await mk("Dev", { width: 1000, height: 700 }, false);
const players = [host, phone, g2, g3];

async function caption(page, text, ms = 2600) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText =
        "position:fixed;left:50%;bottom:96px;pointer-events:none;transform:translateX(-50%);z-index:9999;max-width:80%;padding:12px 20px;border-radius:999px;background:rgba(11,10,20,.88);color:#f3f1ff;font:600 20px Inter,system-ui,sans-serif;border:1px solid #a3ff5c;box-shadow:0 10px 40px rgba(0,0,0,.5);text-align:center;transition:opacity .3s";
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = t ? "1" : "0";
  }, text);
  if (ms) await wait(ms);
}

async function typeAndSend(p, text) {
  const input = p.page.locator('input[aria-label="Message"]');
  if (await input.isDisabled()) return; // voted out: they can only watch
  await input.click();
  await input.pressSequentially(text, { delay: 35 });
  await p.page.click('button[aria-label="Send"]');
}

// 1. Landing
await host.page.goto(BASE);
await caption(host.page, "Botched: party games in your group chat", 3500);
await caption(host.page, "Game one: one of your friends is secretly an AI", 4000);
await host.page.click("text=Start a game");
await host.page.waitForSelector("#nick");
await caption(host.page, "No sign-up. Just a nickname.", 0);
await host.page.locator("#nick").pressSequentially("Asha", { delay: 90 });
await host.page.click("text=Continue");
await host.page.waitForSelector("text=Create a room");
const code = await host.page.evaluate(async () => (await (await fetch("/api/rooms?fast=1", { method: "POST" })).json()).code);
await host.page.goto(`${BASE}/r/${code}`);
await caption(host.page, "Share a link or QR code. Every player is a real Nexconn Chat user.", 1500);

// 2. Friends join
for (const g of [phone, g2, g3]) {
  await g.page.goto(`${BASE}/r/${code}`);
  await g.page.fill("#nick", g.name);
  await g.page.click("text=Join the game");
  await wait(1200);
}
await host.page.waitForFunction(() => document.body.innerText.includes("In the room (4/8)"), null, { timeout: 20000 });
await caption(host.page, "Friends join from any phone or laptop", 2500);
await host.page.click("text=Start the game");
for (const p of players) await p.page.waitForSelector("text=Round 1", { timeout: 20000 });

// Work out every human's alias; the alias left over is the bot.
const aliases = await Promise.all(
  players.map((p) => p.page.evaluate(async (c) => (await (await fetch(`/api/rooms/${c}`)).json()).you.alias, code)),
);
const all = await host.page.evaluate(async (c) => (await (await fetch(`/api/rooms/${c}`)).json()).players.map((p) => p.alias), code);
const botAlias = all.find((a) => !aliases.includes(a));
console.log("humans:", aliases.join(", "), "| bot:", botAlias);

// 3. Round 1 chat
await caption(host.page, "Everyone gets a secret alias. One of them is an AI.", 3000);
await caption(phone.page, "Same game on a phone", 0);
await typeAndSend(g2, "ok mine is embarrassing. how to fold a fitted sheet");
await wait(2500);
await typeAndSend(phone, "lmao did it work");
await wait(2000);
await caption(host.page, "Watch for the typing dots. The bot types like a person.", 0);
await typeAndSend(host, "who here googled something they'd never admit to");
await wait(3500);
await typeAndSend(g3, "how long can you survive on maggi alone. asking for me");
await wait(6000);

// 4. Vote, round 1: the humans split their votes; whatever happens is real.
await host.page.getByText("Who is the bot?", { exact: true }).waitFor({ timeout: 60000 });
await caption(host.page, "Chat locks. Everyone votes, the bot included.", 0);
const vote = async (p, target) => {
  const btn = p.page.locator(".absolute.inset-x-0 button", { hasText: target });
  if (await btn.count()) await btn.first().click().catch(() => {});
};
await vote(host, aliases[2]);
await wait(1200);
await vote(phone, aliases[3]);
await vote(g2, aliases[0]);
await vote(g3, aliases[1]);
await host.page.getByText("Tie vote").or(host.page.getByText("was voted out")).first().waitFor({ timeout: 40000 }).catch(() => {});
const r1 = await host.page.innerText("body");
await caption(host.page, r1.includes("Tie vote") ? "A tie. Nobody leaves. On to round 2." : "Wrong call: a human is out. The bot survives round 1.", 3500);

// 5. Round 2: the humans compare notes and catch it.
await host.page.waitForSelector("text=Round 2", { timeout: 40000 });
await typeAndSend(phone, `${botAlias.toLowerCase()} has been way too chill this whole time`);
await wait(2500);
await typeAndSend(g2, "yeah and it replied in like 2 seconds every time");
await wait(2500);
await caption(host.page, "Ask oddly specific questions. Real friends overshare.", 0);
await typeAndSend(host, `${botAlias.toLowerCase()} what's the name of your street`);
await wait(9000);
await host.page.getByText("Who is the bot?", { exact: true }).waitFor({ timeout: 60000 });
for (const p of players) await vote(p, botAlias);
await caption(host.page, `Everyone votes ${botAlias}…`, 0);

// 6. Results
await host.page.waitForSelector("text=Game over", { timeout: 60000 });
console.log("result:", (await host.page.innerText("h1")).trim());
await caption(host.page, "Masks off: real names, every vote and the bot's inner thoughts", 4500);
await host.page.mouse.wheel(0, 500);
await wait(3000);
await host.page.mouse.wheel(0, -500);
await caption(host.page, "Share the result. Rate the game. Play again.", 3000);
// 7. Public numbers, once real games exist (test games like this one never count, so early on there is nothing to show).
const hasNumbers = await host.page.evaluate(async () => (await (await fetch("/")).text()).includes("Live from real games"));
if (hasNumbers) {
  await host.page.goto(`${BASE}/stats`);
  await caption(host.page, "Every number is public and counted live", 3500);
}

// 8. Solo mode: one human, three AIs hunting them.
const solo = await host.page.evaluate(async () => (await (await fetch("/api/rooms?fast=1&mode=reverse", { method: "POST" })).json()).code);
await host.page.goto(`${BASE}/r/${solo}`);
await host.page.waitForSelector("text=Start the solo game");
await caption(host.page, "Nobody around? Solo mode flips it: you're the only human among three AIs.", 3500);
await host.page.click("text=Start the solo game");
await host.page.waitForSelector("text=Round 1", { timeout: 20000 });
await caption(host.page, "Pass as a bot. The AIs hunt for typos, slang and feelings.", 0);
await wait(5000);
await typeAndSend(host, "Acknowledged. I do not experience weekends. I optimise them.");
// Stay until at least two AIs have answered (they think before typing, like the classic bot).
// The chat list holds 2 Game Master lines + the human's line, so 5+ items means 2+ AI replies.
await host.page
  .waitForFunction(() => (document.querySelector('ul[aria-relevant="additions"]')?.children.length ?? 0) >= 5, null, { timeout: 35000 })
  .catch(() => {});
await wait(6000);
await caption(host.page, "", 0);

await host.page.goto(`${BASE}/lounge`);
await caption(host.page, "No friends online? Find players in the lounge.", 3500);
await caption(host.page, "Botched. Built on Nexconn Chat.", 3000);

const hostVideo = host.page.video();
const phoneVideo = phone.page.video();
for (const p of players) await p.ctx.close();
await browser.close();
if (NO_VIDEO) {
  console.log("Dry run finished.");
  process.exit(0);
}
renameSync(await hostVideo.path(), `${OUT}/demo-desktop.webm`);
renameSync(await phoneVideo.path(), `${OUT}/demo-phone.webm`);
console.log(`Saved ${OUT}/demo-desktop.webm and ${OUT}/demo-phone.webm`);
