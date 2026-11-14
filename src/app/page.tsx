import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { LiveStatsSection } from "@/components/hub/live-stats";
import { DemoChat } from "@/components/landing/demo-chat";
import { Nav } from "@/components/nav";
import { ANDROID_APK_URL } from "@/lib/constants";
import { SOLO_MODES, TAGLINE } from "@/lib/game/modes";

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
    title: "Answer, argue, vote",
    body: "Everyone answers the prompt privately and the answers drop together. Then you argue about who wrote like a machine, and vote someone out.",
  },
];

const BOT_TRAITS = [
  ["Reads the room", "It writes its answer after seeing yours, matching the group's length, slang and vibe without copying anyone."],
  ["Has a personality", "Each game it plays a different character, with its own slang, typos and habits."],
  ["Uses your names", "If someone in the chat calls a friend by name, the bot picks it up and uses it too."],
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
              <Link href="/play/whos-the-bot?solo=1" className="btn btn-ghost px-6 py-4 text-lg">
                Play solo now
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              2 to 8 friends, quick match with strangers, or 5 solo modes · any phone ·{" "}
              <Link href="/how-to-play" className="text-cool hover:underline">
                how it works
              </Link>
            </p>
          </div>
          <DemoChat />
        </section>
      </div>

      <main className="flex flex-col gap-24 py-20">
        <Suspense fallback={null}>
          <LiveStatsSection
            title="Live from real games"
            className="mx-auto w-full max-w-6xl px-4"
            aside={
              <Link href="/leaderboard" className="text-sm text-cool hover:underline">
                Leaderboard →
              </Link>
            }
          />
        </Suspense>

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

        <section className="term mx-auto w-full max-w-6xl overflow-hidden rounded-md border border-line px-5 py-10 md:px-10 md:py-14">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} solo · who&apos;s the human</p>
          <h2 className="crt glow mt-3 text-6xl leading-[0.85] text-brand md:text-8xl">{TAGLINE.solo}</h2>
          <p className="mt-4 max-w-2xl text-muted">
            Nobody around? Flip the game. You are the only human in a chat full of AIs that are hunting you. Pass as one of them.
          </p>
          <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {SOLO_MODES.map((m) => (
              <li key={m.id} className="card flex flex-col p-4">
                <p className="crt text-2xl leading-none text-brand">{m.label.toUpperCase()}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{m.blurb}</p>
              </li>
            ))}
          </ul>
          <Link href="/play/whos-the-bot#solo" className="btn btn-brand mt-8 px-7 py-3.5">
            Pick a solo mode
          </Link>
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
              <a href={ANDROID_APK_URL} className="btn btn-ghost px-6 py-4 text-lg">
                Get the Android app
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

