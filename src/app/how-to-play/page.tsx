import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "How to play",
  description: "The rules of Who's the Bot in two minutes, plus tips for catching the AI.",
};

const RULES = [
  {
    title: "Set up",
    points: [
      "One person creates a room and shares the link or QR code.",
      "Friends join with a nickname. You need at least 2 humans; 3 to 6 is the sweet spot.",
      "When the host starts, an AI player joins secretly. Nobody, including the host, knows which alias it gets.",
    ],
  },
  {
    title: "Each round",
    points: [
      "The game master posts a prompt. Everyone chats about it for 90 seconds.",
      "Then the chat locks and you have 30 seconds to vote for who you think the bot is.",
      "The player with the most votes is out and their role is revealed. A tie means nobody leaves.",
    ],
  },
  {
    title: "Winning",
    points: [
      "Humans win the moment the bot is voted out.",
      "The bot wins if it survives every round, or if only one human is left beside it.",
      "At the end, masks come off: real names, every vote and the bot's private thoughts.",
    ],
  },
];

const TIPS = [
  ["Ask oddly specific questions", "“What's the name of the chai place near your college?” is harder to fake than “how was your day”."],
  ["Watch the timing", "The bot types at a human pace, but it never gets distracted. Notice who always replies."],
  ["Look for vagueness", "It avoids details that could be checked. Real friends overshare."],
  ["Don't trust the loudest accuser", "Pointing fingers early is a great way for a bot to look human."],
];

const FAQ = [
  ["Do I need an account?", "No. Pick a nickname and play. Your stats are tied to this browser."],
  ["Can the bot see my real name?", "No. During the game everyone, the bot included, only sees aliases."],
  ["Is the bot the same every time?", "No. It plays a different character each game, with its own slang, typing speed and habits."],
  ["Does it work on phones?", "Yes, it is built for phones first. You can also install it to your home screen."],
];

export default function HowToPlay() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-4xl px-4 pb-10 pt-10 md:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Rules</p>
          <h1 className="mt-3 font-display text-5xl font-black md:text-6xl">How to play Who&apos;s the Bot</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Social deduction in a group chat. One of the players is an AI trying to pass as human. Two minutes to learn,
            hard to master.
          </p>
        </header>
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-14 px-4 pb-20">
        <section className="grid gap-4 md:grid-cols-3">
          {RULES.map((r, i) => (
            <div key={r.title} className="card p-6">
              <span className="font-mono text-sm text-brand">0{i + 1}</span>
              <h2 className="mt-2 font-display text-2xl font-bold">{r.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-brand" aria-hidden>
                      ›
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2 className="font-display text-3xl font-extrabold">Tips for catching it</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {TIPS.map(([t, b]) => (
              <li key={t} className="card p-5">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-3xl font-extrabold">Questions</h2>
          <div className="mt-5 flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-muted transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4 text-lg">
            Start a game
          </Link>
          <Link href="/lounge" className="btn btn-ghost px-6 py-4 text-lg">
            Find players in the lounge
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
