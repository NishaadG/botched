import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStatsSection } from "@/components/hub/live-stats";
import { NextGameVote } from "@/components/hub/next-game-vote";
import { Nav } from "@/components/nav";
import { Sigil, handle } from "@/components/sigil";
import { TAGLINE } from "@/lib/game/modes";
import { NEXT_GAMES } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Games",
  description: "Pick a party game and send your friends one link. Who's the Bot is live now.",
};

const PREVIEW = [
  { alias: "Mango Fox", color: "#ffa04d", text: "ok who here actually likes pineapple pizza" },
  { alias: "Lime Frog", color: "#c8ff4d", text: "me lol. fight me" },
  { alias: "Violet Owl", color: "#c39bff", text: "frog that answer came way too fast" },
];

export default function Hub() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <header className="bg-grid border-b border-line/60">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 md:pt-14">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} ls ./games</p>
          <h1 className="crt glow mt-3 text-7xl leading-[0.85] text-brand md:text-8xl">PICK A GAME.</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            Every game runs inside a real-time group chat. Make a room, send the link, play from any phone or laptop.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 md:py-16">
        <Link
          href="/play/whos-the-bot"
          className="card group relative grid gap-8 overflow-hidden p-6 transition hover:border-brand/60 md:grid-cols-[1.3fr_1fr] md:p-10"
        >
          <div className="scanbar" />
          <div className="relative">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest">
              <span className="bg-brand px-1.5 py-0.5 text-brand-ink">live</span>
              <span className="text-muted">game 01</span>
            </div>
            <h2 className="crt glow mt-4 text-6xl leading-[0.85] text-brand md:text-8xl">WHO&apos;S THE BOT?</h2>
            <p className="crt mt-3 text-3xl leading-none text-text">{TAGLINE.classic}</p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              One player in the chat is an AI wearing a human mask. Answer the prompt, argue, vote people out, and catch it
              before it outlasts you.
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5 text-[11px] uppercase tracking-widest text-muted">
              {["2-8 players", "~5 minutes", "social deduction", "quick match"].map((t) => (
                <li key={t} className="border border-line px-2 py-1">
                  {t}
                </li>
              ))}
              <li className="border border-brand/50 px-2 py-1 text-brand">5 solo modes</li>
            </ul>
            <span className="btn btn-brand mt-7 px-7 py-4">Play now →</span>
          </div>
          <div className="relative flex flex-col justify-end gap-1.5 font-mono text-[13px]" aria-hidden>
            {PREVIEW.map((m, i) => (
              <p key={i} className="flex items-start gap-2" style={{ opacity: 0.5 + i * 0.25 }}>
                <Sigil seed={m.alias} color={m.color} size={18} className="mt-0.5" />
                <span>
                  <span style={{ color: m.color }}>{handle(m.alias)}</span>
                  <span className="mx-1.5 text-muted">{">"}</span>
                  <span className="text-text">{m.text}</span>
                </span>
              </p>
            ))}
          </div>
        </Link>

        <Suspense fallback={null}>
          <LiveStatsSection title="so far" />
        </Suspense>

        <section>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-warn">{">"} coming next</p>
              <h2 className="crt glow mt-2 text-5xl leading-[0.9] text-text md:text-6xl">YOU PICK THE NEXT GAME.</h2>
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
