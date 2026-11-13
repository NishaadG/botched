import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Botched stores when you play, and why.",
};

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "What you give us",
    points: [
      "A nickname. There are no accounts, emails or passwords.",
      "The messages you send in game rooms and the lounge.",
      "Optional feedback: a star rating and a short comment.",
    ],
  },
  {
    title: "What we store",
    points: [
      "A signed cookie with a random guest ID, so you stay the same player between games.",
      "Your nickname and game stats (games played, wins, catches) for the leaderboard and your stats page.",
      "Game rooms, including their chat, are deleted automatically 24 hours after they were last used.",
      "Feedback comments may be shown publicly on the stats page next to your nickname, with swear words masked.",
      "Your IP address is used only for short rate limits against spam and is not kept beyond 10 minutes.",
    ],
  },
  {
    title: "Who processes it",
    points: [
      "Nexconn delivers the chat. Each guest is registered there as a chat user under their nickname.",
      "An AI model provider (Groq or Google Gemini) receives the room's recent chat so the AI player can reply. Nothing else about you is sent.",
      "The site runs on Vercel, and game data is kept in Upstash Redis.",
      "There are no ads, no tracking pixels and no third-party analytics cookies.",
    ],
  },
  {
    title: "Your choices",
    points: [
      "Clear this site's cookies to start over as a new guest.",
      "Don't share anything personal in chat: other players, and the AI, will read it.",
      "To have your nickname and stats removed, open an issue on the project's GitHub repository with your nickname.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-3xl px-4 pb-8 pt-10 md:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Privacy</p>
          <h1 className="mt-3 font-display text-5xl font-black md:text-6xl">What we keep</h1>
          <p className="mt-3 text-lg text-muted">Short version: a nickname, your game stats and the chat, and not much else.</p>
        </header>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card p-6">
            <h2 className="font-display text-2xl font-extrabold">{s.title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-sm text-muted">Last updated 13 November 2026.</p>
      </main>
      <Footer />
    </div>
  );
}
