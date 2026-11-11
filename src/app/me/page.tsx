import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { ProfileName } from "@/components/profile-name";
import { getSession } from "@/lib/session";
import { getPlayerRecord } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Your stats",
  description: "Your games, wins and bot catches.",
};

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

async function Profile() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="card flex flex-col items-start gap-4 p-8">
        <h1 className="font-display text-4xl font-black">No games yet</h1>
        <p className="text-muted">Pick a nickname and play a round. Your stats will show up here.</p>
        <Link href="/play/whos-the-bot" className="btn btn-brand">
          Play Who&apos;s the Bot
        </Link>
      </div>
    );
  }
  const rec = await getPlayerRecord(session.uid);
  const winRate = rec.games ? Math.round((rec.wins / rec.games) * 100) : 0;
  const tiles = [
    { label: "Games", value: rec.games },
    { label: "Humans won", value: rec.wins },
    { label: "Bot catches", value: rec.catches },
    { label: "Fooled by the bot", value: rec.fooled },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <ProfileName name={session.name} />
        <div className="text-left md:text-right">
          <p className="font-display text-5xl font-black text-brand tabular-nums">{winRate}%</p>
          <p className="text-sm text-muted">of your games ended with the bot caught</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-5">
            <dt className="text-sm text-muted">{t.label}</dt>
            <dd className="font-display text-4xl font-extrabold tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="card p-5 md:p-6">
        <h2 className="font-display text-2xl font-extrabold">Recent games</h2>
        {rec.recent.length ? (
          <ul className="mt-4 flex flex-col gap-2">
            {rec.recent.map((g) => (
              <li key={`${g.code}-${g.at}`}>
                <Link
                  href={`/r/${g.code}`}
                  className="flex items-center gap-3 rounded-xl bg-ink/60 px-4 py-3 transition hover:bg-white/5"
                >
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${g.won ? "bg-brand text-brand-ink" : "bg-hot text-white"}`}
                  >
                    {g.won ? "Caught it" : "Fooled"}
                  </span>
                  <span className="text-sm">
                    The bot was <b>{g.botAlias || "someone"}</b> · {g.players} humans · {g.rounds} round{g.rounds === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{ago(g.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">
            Nothing yet.{" "}
            <Link href="/play/whos-the-bot" className="text-brand hover:underline">
              Start your first game
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

export default function MePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col bg-grid">
        <Nav />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 md:py-14">
          <Suspense fallback={<div className="card h-64 animate-pulse" />}>
            <Profile />
          </Suspense>
        </main>
      </div>
      <Footer />
    </div>
  );
}
