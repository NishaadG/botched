import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

let iconData: Promise<string> | null = null;
const icon = () =>
  (iconData ??= readFile(join(process.cwd(), "public/icon.svg"), "utf8").then(
    (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`,
  ));

/** Shared look for every share image: dark card, lime accent, big headline. */
export async function ogCard({
  kicker,
  title,
  accent,
  sub,
  tone = "brand",
}: {
  kicker: string;
  title: string;
  accent?: string;
  sub: string;
  tone?: "brand" | "hot";
}) {
  const color = tone === "hot" ? "#ff4d8d" : "#a3ff5c";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0b0a14",
          backgroundImage: `radial-gradient(circle at 10% 0%, ${color}33, transparent 45%), radial-gradient(circle at 95% 20%, #ff4d8d22, transparent 40%)`,
          color: "#f3f1ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={await icon()} width={64} height={64} style={{ borderRadius: 16 }} alt="" />
          <span style={{ fontSize: 34, fontWeight: 800 }}>botched</span>
          <span style={{ marginLeft: "auto", fontSize: 24, color: "#9a96c4", letterSpacing: 4, textTransform: "uppercase" }}>
            {kicker}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 92, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{title}</span>
          {accent && <span style={{ fontSize: 92, fontWeight: 900, lineHeight: 1.05, color, letterSpacing: -2 }}>{accent}</span>}
        </div>
        <span style={{ fontSize: 32, color: "#9a96c4" }}>{sub}</span>
      </div>
    ),
    OG_SIZE,
  );
}
