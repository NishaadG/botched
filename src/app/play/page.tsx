import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStats, LiveStatsSkeleton } from "@/components/hub/live-stats";
import { NextGameVote } from "@/components/hub/next-game-vote";
import { Nav } from "@/components/nav";
import { NEXT_GAMES } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Games",
  description: "Pick a party game and send your friends one link. Who's the Bot is live now.",
};

const PREVIEW = [
  { avatar: "🦊", color: "#fb923c", text: "ok who here actually likes pineapple pizza" },
  { avatar: "🐸", color: "#a3e635", text: "me lol. fight me" },
  { avatar: "🦉", color: "#a78bfa", text: "frog that answer came way too fast" },
];

export default function Hub() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 md:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">The arcade</p>
          <h1 className="mt-3 font-display text-5xl font-black md:text-6xl">Pick a game.</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Every game runs inside a real-time group chat. Make a room, send the link, play from any phone or laptop.
          </p>
        </header>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20">
        <Link
          href="/play/whos-the-bot"
          className="card group relative grid gap-8 overflow-hidden p-6 transition hover:border-brand/60 md:grid-cols-[1.3fr_1fr] md:p-10"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl transition group-hover:bg-brand/30"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">Live</span>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted">Game 01</span>
            </div>
            <h2 className="mt-4 font-display text-4xl font-black md:text-6xl">Who&apos;s the Bot?</h2>
            <p className="mt-3 max-w-lg text-lg text-muted">
              One player in the chat is an AI wearing a human mask. Chat about the prompt, vote people out, and catch it
              before it outlasts you.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2 text-sm text-muted">
              <li className="rounded-full border border-line px-3 py-1">2 to 8 players</li>
              <li className="rounded-full border border-line px-3 py-1">~5 minutes</li>
              <li className="rounded-full border border-line px-3 py-1">Social deduction</li>
              <li className="rounded-full border border-brand/50 px-3 py-1 text-brand">Solo mode: 1 human vs 3 AIs</li>
            </ul>
            <span className="btn btn-brand mt-7 px-7 py-4 text-lg">Play now →</span>
          </div>
          <div className="relative flex flex-col justify-end gap-2" aria-hidden>
            {PREVIEW.map((m, i) => (
              <div key={i} className="flex items-end gap-2" style={{ opacity: 0.55 + i * 0.2 }}>
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ background: `${m.color}22`, boxShadow: `inset 0 0 0 2px ${m.color}` }}
                >
                  {m.avatar}
                </span>
                <span className="rounded-2xl rounded-bl-md bg-panel-2 px-3.5 py-2">{m.text}</span>
              </div>
            ))}
          </div>
        </Link>

        <section>
          <h2 className="font-display text-2xl font-extrabold md:text-3xl">So far</h2>
          <div className="mt-4">
            <Suspense fallback={<LiveStatsSkeleton />}>
              <LiveStats />
            </Suspense>
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-warn">Coming next</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold md:text-4xl">You choose the next game.</h2>
            </div>
            <p className="max-w-sm text-sm text-muted">
              The idea with the most votes gets built next. One vote each, and you can change it.
            </p>
          </div>
          <div className="mt-6">
            <NextGameVote games={NEXT_GAMES} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
