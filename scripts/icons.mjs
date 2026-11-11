// Renders public/icon.svg to the PNG sizes needed by the web manifest, iOS and the Android app.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg", "utf8");
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
const page = await browser.newPage();
for (const [size, file] of [
  [192, "public/icons/icon-192.png"],
  [512, "public/icons/icon-512.png"],
  [512, "public/icons/maskable-512.png"],
  [180, "src/app/apple-icon.png"],
  [32, "public/icons/icon-32.png"],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: file, omitBackground: false });
}
await browser.close();
console.log("icons written");
