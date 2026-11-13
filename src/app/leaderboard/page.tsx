import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStatsSection } from "@/components/hub/live-stats";
import { Nav } from "@/components/nav";
import { getBoard, type BoardKey } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The best bot hunters and the most games played in Who's the Bot.",
};

const BOARDS: { key: BoardKey; title: string; unit: string; blurb: string }[] = [
  { key: "catches", title: "Bot hunters", unit: "catches", blurb: "Voted for the bot in the round it got caught." },
  { key: "survived", title: "Still standing", unit: "wins", blurb: "Survived to the end of a game the humans won." },
  { key: "impostors", title: "Best impersonators", unit: "wins", blurb: "Passed as a bot in solo games against three AIs." },
  { key: "games", title: "Regulars", unit: "games", blurb: "Most games finished." },
];

const MEDALS = ["🥇", "🥈", "🥉"];

async function Board({ k, unit }: { k: BoardKey; unit: string }) {
  const rows = await getBoard(k, 10);
  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Nobody here yet.{" "}
        <Link href="/play/whos-the-bot" className="text-brand hover:underline">
          Play a game
        </Link>{" "}
        to claim the top spot.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li key={r.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i === 0 ? "bg-brand/10" : "bg-ink/60"}`}>
          <span className="w-7 text-center font-mono text-sm text-muted">{MEDALS[i] ?? i + 1}</span>
          <span className="truncate font-semibold">{r.name}</span>
          <span className="ml-auto font-mono text-sm tabular-nums">
            {r.score} <span className="text-muted">{unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-ink/60" />
      ))}
    </div>
  );
}

export default function Leaderboard() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 md:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Leaderboard</p>
          <h1 className="mt-3 font-display text-5xl font-black md:text-6xl">Humans vs the bot</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Every number here comes from finished games. Updated live.{" "}
            <Link href="/stats" className="text-cool hover:underline">
              Daily stats →
            </Link>
          </p>
        </header>
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-20">
        <Suspense fallback={null}>
          <LiveStatsSection />
        </Suspense>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARDS.map((b) => (
            <section key={b.key} className="card flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-display text-2xl font-extrabold">{b.title}</h2>
                <p className="text-sm text-muted">{b.blurb}</p>
              </div>
              <Suspense fallback={<BoardSkeleton />}>
                <Board k={b.key} unit={b.unit} />
              </Suspense>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
