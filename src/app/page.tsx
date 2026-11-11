import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStats, LiveStatsSkeleton } from "@/components/hub/live-stats";
import { DemoChat } from "@/components/landing/demo-chat";
import { Nav } from "@/components/nav";

const STEPS = [
  {
    n: "01",
    title: "Send one link",
    body: "Create a room and share the link or QR code. Friends join with just a nickname. No app, no sign-up.",
  },
  {
    n: "02",
    title: "Everyone gets a mask",
    body: "Each player becomes a random animal alias. So does the AI, which quietly joins the chat as one of you.",
  },
  {
    n: "03",
    title: "Chat, suspect, vote",
    body: "Talk about the round's prompt for 90 seconds, then vote someone out. Catch the bot before it outlasts you.",
  },
];

const BOT_TRAITS = [
  ["Types like a person", "It shows a typing indicator, hesitates, and takes longer to write longer messages."],
  ["Has a personality", "Each game it plays a different character, with its own slang, typos and habits."],
  ["Doesn't answer everything", "Like a real friend, it ignores some messages and jumps into others."],
  ["Votes to survive", "It reads the room, picks a suspect and votes with a reason you'll see afterwards."],
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> Party games for group chats
            </p>
            <h1 className="mt-5 font-display text-5xl font-black leading-[0.92] tracking-tight sm:text-6xl md:text-7xl">
              One of your friends
              <br />
              <span className="text-brand">is a bot.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted md:text-xl">
              Who&apos;s the Bot drops an AI into your group chat, disguised as a player. It types, jokes and lies like
              a human. You have three rounds to work out which one it is.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4 text-lg">
                Start a game
              </Link>
              <Link href="/how-to-play" className="btn btn-ghost px-6 py-4 text-lg">
                How it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              2 to 8 players · 5 minutes · works on any phone ·{" "}
              <Link href="/play/whos-the-bot" className="text-cool hover:underline">
                alone? play solo vs 3 AIs
              </Link>
            </p>
          </div>
          <DemoChat />
        </section>
      </div>

      <main className="flex flex-col gap-24 py-20">
        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold md:text-3xl">Live from real games</h2>
            <Link href="/leaderboard" className="text-sm text-cool hover:underline">
              Leaderboard →
            </Link>
          </div>
          <Suspense fallback={<LiveStatsSkeleton />}>
            <LiveStats />
          </Suspense>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="font-display text-4xl font-extrabold md:text-5xl">How a game goes</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-6">
                <span className="font-mono text-sm text-brand">{s.n}</span>
                <h3 className="mt-3 font-display text-2xl font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-hot">The opponent</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold md:text-5xl">A bot built to blend in.</h2>
            <p className="mt-4 text-lg text-muted">
              Most chatbots are trying to be helpful. This one is trying not to get caught. When the game ends, you see
              everything it was thinking.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {BOT_TRAITS.map(([t, b]) => (
              <li key={t} className="card p-5">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4">
          <div className="card flex flex-col items-start gap-6 overflow-hidden p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <h2 className="font-display text-4xl font-black md:text-5xl">Think you&apos;d spot it?</h2>
              <p className="mt-2 text-lg text-muted">Grab two friends. It takes ten seconds to start.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4 text-lg">
                Start a game
              </Link>
              <Link href="/lounge" className="btn btn-ghost px-6 py-4 text-lg">
                Find players
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
