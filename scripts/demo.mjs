// Records a demo of a real game: 4 browsers play over Nexconn, the host's screen (desktop) and one guest (phone) are recorded.
// Captions are overlaid on the recordings; add the voice-over in any editor afterwards.
// Usage: node scripts/demo.mjs [baseUrl]   (start the server with ALLOW_FAST_ROOMS=1 for short rounds)
// Writes demo-desktop.webm, demo-phone.webm and marks.json (when the phone segment starts/ends, in seconds).
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const OUT = process.env.DEMO_OUT ?? "demo-video";
const NO_VIDEO = process.env.NO_VIDEO === "1"; // dry run: check the flow without recording
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const handle = (alias) => alias.toLowerCase().replace(/\s+/g, "_");

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

const T0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = (Date.now() - T0) / 1000);

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
        "position:fixed;left:50%;bottom:110px;pointer-events:none;transform:translateX(-50%);z-index:9999;max-width:80%;padding:12px 22px;border-radius:4px;background:rgba(3,7,3,.92);color:#c6f7cc;font:600 20px 'JetBrains Mono',ui-monospace,monospace;border:1px solid #3dff72;box-shadow:0 0 30px rgba(61,255,114,.35);text-align:center;transition:opacity .3s";
      document.body.appendChild(el);
    }
    el.textContent = t ? `> ${t}` : "";
    el.style.opacity = t ? "1" : "0";
  }, text);
  if (ms) await wait(ms);
}

async function typeIn(p, label, text, delay = 35) {
  const input = p.page.locator(`input[aria-label="${label}"]`);
  if (!(await input.isEnabled().catch(() => false))) return false; // voted out, or already answered
  await input.click();
  await input.pressSequentially(text, { delay });
  await p.page.locator("form button").click();
  return true;
}
const say = (p, text) => typeIn(p, "Message", text);
const answer = (p, text, delay) => typeIn(p, "Your answer", text, delay);
const waitFor = (p, sel, timeout = 60000) => p.page.waitForSelector(sel, { timeout });

// 1. Landing
await host.page.goto(BASE);
await caption(host.page, "Botched: party games in your group chat", 3500);
await caption(host.page, "Game one: one of your friends is secretly an AI", 3500);
await host.page.click("text=Start a game");
await host.page.waitForSelector("#nick");
await caption(host.page, "Who's the Bot gets its own look. No sign-up, just a nickname.", 0);
await host.page.locator("#nick").pressSequentially("Asha", { delay: 90 });
await host.page.click("text=Continue");
await host.page.waitForSelector("text=Room for friends");
await wait(1500);
const code = await host.page.evaluate(async () => (await (await fetch("/api/rooms?fast=demo", { method: "POST" })).json()).code);
await host.page.goto(`${BASE}/r/${code}`);
await caption(host.page, "Share a link, a QR code or WhatsApp. Every player is a real Nexconn Chat user.", 1500);

// 2. Friends join
mark("phoneStart");
for (const g of [phone, g2, g3]) {
  await g.page.goto(`${BASE}/r/${code}`);
  await g.page.fill("#nick", g.name);
  await g.page.click("text=Join the game");
  await wait(1200);
}
await host.page.waitForFunction(() => document.body.innerText.toLowerCase().includes("connected (4/8)"), null, { timeout: 20000 });
await caption(host.page, "Friends join from any phone or laptop", 2500);
await host.page.click("text=Start the game");
for (const p of players) await waitFor(p, 'input[aria-label="Your answer"]:enabled', 30000);

// Work out every human's alias; the alias left over is the bot.
const aliases = await Promise.all(
  players.map((p) => p.page.evaluate(async (c) => (await (await fetch(`/api/rooms/${c}`)).json()).you.alias, code)),
);
const all = await host.page.evaluate(async (c) => (await (await fetch(`/api/rooms/${c}`)).json()).players.map((p) => p.alias), code);
const botAlias = all.find((a) => !aliases.includes(a));
console.log("humans:", aliases.join(", "), "| bot:", botAlias);

// 3. Round 1: private answers, then they drop together.
await caption(host.page, "Everyone gets a secret alias. One of them is an AI.", 3000);
await caption(host.page, "Step 1: answer privately. Nobody sees anything until everyone's in.", 0);
await caption(phone.page, "Same game on a phone", 0);
const R1 = ["mom found my search history. thats all", "how to look busy in a meeting", "how long can you survive on maggi", "is it illegal to nap at work"];
await answer(g2, R1[2], 25);
await answer(phone, R1[1], 45);
await answer(g3, R1[3], 25);
await wait(1500);
await answer(host, R1[0], 45);
await caption(host.page, "The AI reads the answers already in, then writes one that fits the room.", 0);
await waitFor(host, 'input[aria-label="Message"]:enabled', 40000);
await wait(2500);
await caption(host.page, "Answers drop together. One of these was written by the AI.", 5000);
await caption(phone.page, "", 0);

// 4. Discussion
await caption(host.page, "Step 2: argue about who wrote like a machine.", 0);
await say(g2, "ok the maggi one is clearly me lol");
await wait(2200);
await say(phone, "asha ur mom found ur history??");
await wait(2500);
await caption(host.page, "Typing dots, typos, hesitation: the bot types like a person.", 0);
await say(host, "dont. who wrote the meeting one, thats so corporate");
await wait(7000);

// 5. Vote, round 1: the humans split their votes; whatever happens is real.
await host.page.locator(".absolute.inset-x-0 button").first().waitFor({ timeout: 90000 });
await caption(host.page, "Step 3: chat locks. Everyone votes, the bot included.", 0);
const vote = async (p, target) => {
  const btn = p.page.locator(".absolute.inset-x-0 button", { hasText: handle(target) });
  if (await btn.count()) await btn.first().click().catch(() => {});
};
// Votes split so the host (the recorded screen) stays in the game.
await vote(host, aliases[2]);
await wait(1200);
await vote(phone, aliases[3]);
await vote(g2, aliases[3]);
await vote(g3, aliases[1]);
await host.page.getByText("Nobody leaves").or(host.page.getByText("Scanning voted-out player")).first().waitFor({ timeout: 40000 }).catch(() => {});
const tie = (await host.page.innerText("body")).toLowerCase().includes("nobody leaves");
await caption(host.page, tie ? "A tie. Nobody leaves. On to round 2." : "Wrong call: a human is out. The bot survives round 1.", 3500);

// 6. Round 2: answers again, then the humans catch it.
await waitFor(host, 'input[aria-label="Your answer"]:enabled', 40000); // the host is never voted out (see the votes above)
const R2 = ["snooze 4 times then sprint", "chai first, personality later", "wake up, regret, repeat", "i dont have a routine i have a crisis"];
await caption(host.page, "Round 2. Fresh question, fresh answers.", 0);
for (const [i, p] of [g2, g3, phone, host].entries()) {
  await answer(p, R2[i], 30);
  await wait(400);
}
await waitFor(host, 'input[aria-label="Message"]', 40000);
await wait(2500);
await say(phone, `${handle(botAlias).split("_")[0]} has been way too chill this whole time`);
await wait(2200);
await say(g2, "yeah and it always matches whatever we say");
await wait(2200);
await caption(host.page, "Ask oddly specific questions. Real friends overshare.", 0);
await say(host, `${handle(botAlias).split("_")[0]} whats the name of your street`);
await wait(9000);
await host.page.locator(".absolute.inset-x-0 button").first().waitFor({ timeout: 90000 });
for (const p of players) await vote(p, botAlias);
await caption(host.page, `Everyone votes ${handle(botAlias)}…`, 0);

// 7. Results
await host.page.waitForSelector("text=Game over", { timeout: 60000 });
console.log("result:", (await host.page.innerText("h1")).trim());
await caption(host.page, "Masks off: real names, every vote and the bot's inner thoughts", 4500);
await host.page.mouse.wheel(0, 600);
await wait(3500);
await host.page.mouse.wheel(0, -600);
await caption(host.page, "Share the result. Rate the game. Play again.", 3000);
mark("phoneEnd");
const phoneVideo = phone.page.video();
await phone.ctx.close();
for (const p of [g2, g3]) await p.ctx.close();

// 8. Public numbers, once real games exist (test games like this one never count).
const hasNumbers = await host.page.evaluate(async () => (await (await fetch("/")).text()).includes("Live from real games"));
if (hasNumbers) {
  await host.page.goto(`${BASE}/stats`);
  await caption(host.page, "Every number is public and counted live", 3500);
}

// 9. Solo: the mode picker, then Interrogation.
await host.page.goto(`${BASE}/play/whos-the-bot#solo`);
await host.page.waitForSelector("text=Interrogation");
await caption(host.page, "Nobody around? Solo flips it. AI took your job. Time to take its.", 3500);
for (const m of ["Blitz", "Crowd", "Hard", "Interrogation"]) {
  await host.page.locator('[role="radio"]', { hasText: m }).click();
  await wait(900);
}
await caption(host.page, "Five solo modes. In Interrogation, an AI detective questions you.", 2500);
const solo = await host.page.evaluate(async () => (await (await fetch("/api/rooms?fast=1&mode=reverse&variant=interrogation", { method: "POST" })).json()).code);
await host.page.goto(`${BASE}/r/${solo}`);
await host.page.locator("main button.btn-brand").first().click({ timeout: 30000 });
await caption(host.page, "Convince it you're a machine.", 0);
const box = host.page.locator('input[aria-label="Message"]');
const detectiveSpoke = () =>
  host.page
    .waitForFunction(() => {
      const last = [...document.querySelectorAll("main section li")].at(-1);
      return last && !last.textContent.includes("(you)") && !last.textContent.startsWith(">>");
    }, null, { timeout: 30000 })
    .catch(() => {});
await detectiveSpoke();
await wait(1500);
await say(host, "Acknowledged. I do not experience weekends. I optimise them.");
await detectiveSpoke();
await wait(2500);
if (await box.isEnabled().catch(() => false)) await say(host, "Negative. I have no preferences. I report averages.");
await detectiveSpoke();
await wait(3000);
await caption(host.page, "", 0);

// 10. Quick match + lounge
await host.page.goto(`${BASE}/play/whos-the-bot`);
await host.page.click("text=Quick match");
await host.page.waitForURL(/\/r\/[A-Z]+$/, { timeout: 20000 });
await caption(host.page, "Quick match: drop into a lobby with strangers. Real people only.", 3500);
await host.page.goto(`${BASE}/lounge`);
await caption(host.page, "Or find players in the public lounge.", 3000);
await host.page.goto(BASE);
await caption(host.page, "Botched. One of your friends is a bot. Built on Nexconn Chat.", 3500);

const hostVideo = host.page.video();
await host.ctx.close();
await browser.close();
if (NO_VIDEO) {
  console.log("Dry run finished.", marks);
  process.exit(0);
}
renameSync(await hostVideo.path(), `${OUT}/demo-desktop.webm`);
renameSync(await phoneVideo.path(), `${OUT}/demo-phone.webm`);
writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
console.log(`Saved ${OUT}/demo-desktop.webm, demo-phone.webm, marks.json`, marks);
