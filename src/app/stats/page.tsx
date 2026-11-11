import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { DailyChart } from "@/components/hub/daily-chart";
import { LiveStats, LiveStatsSkeleton } from "@/components/hub/live-stats";
import { Nav } from "@/components/nav";
import { getDailySeries, getFeedback, getNextGameVotes, NEXT_GAMES } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Live stats",
  description: "Public, live numbers for Botched: games played, active players, ratings and what players asked for next.",
};

async function Charts() {
  const series = await getDailySeries(14);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DailyChart title="Games finished per day" unit="games" color="#a3ff5c" data={series.map((d) => ({ day: d.day, value: d.games }))} />
      <DailyChart
        title="Active players per day"
        unit="players"
        color="#5cc8ff"
        data={series.map((d) => ({ day: d.day, value: d.visitors }))}
      />
    </div>
  );
}

async function Feedback() {
  const fb = await getFeedback(12);
  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card flex flex-col justify-center p-6">
        <p className="text-sm text-muted">Average post-game rating</p>
        <p className="font-display text-6xl font-black tabular-nums">
          {fb.avg === null ? "—" : fb.avg.toFixed(1)}
          <span className="text-2xl text-muted"> / 5</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          from {fb.count} rating{fb.count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="card p-6">
        <h2 className="font-display text-xl font-bold">What players said</h2>
        {fb.recent.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {fb.recent.map((f) => (
              <li key={`${f.code}-${f.at}-${f.name}`} className="rounded-2xl bg-ink/60 p-4">
                <p className="leading-snug">“{f.text}”</p>
                <p className="mt-2 text-xs text-muted">
                  {f.name} · rated {f.rating}/5
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">No written feedback yet. Players can leave some after each game.</p>
        )}
      </div>
    </section>
  );
}

async function Wishlist() {
  const { counts } = await getNextGameVotes();
  const rows = NEXT_GAMES.map((g) => ({ ...g, n: Math.max(0, counts[g.id] ?? 0) })).sort((a, b) => b.n - a.n);
  const top = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div>
            <p className="text-sm font-semibold">
              {r.emoji} {r.title}
            </p>
            <div className="mt-1 h-2 rounded-full bg-ink">
              <div className="h-2 rounded-full bg-warn" style={{ width: `${(r.n / top) * 100}%` }} />
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

const Skeleton = ({ h = "h-64" }: { h?: string }) => <div className={`card ${h} animate-pulse`} />;

export default function StatsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 md:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Open stats</p>
          <h1 className="mt-3 font-display text-5xl font-black md:text-6xl">Live numbers</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Counted live from real games, never seeded or edited. Days are in UTC. Active players are people who opened
            the app with a nickname that day.
          </p>
        </header>
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-20">
        <Suspense fallback={<LiveStatsSkeleton />}>
          <LiveStats />
        </Suspense>
        <Suspense fallback={<Skeleton />}>
          <Charts />
        </Suspense>
        <Suspense fallback={<Skeleton h="h-48" />}>
          <Feedback />
        </Suspense>
        <section className="card grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <h2 className="font-display text-2xl font-extrabold">What players want next</h2>
            <p className="mt-1 text-muted">Votes from the game hub. The winner is the next game we build.</p>
            <Link href="/play" className="mt-4 inline-block text-sm text-cool hover:underline">
              Cast your vote →
            </Link>
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-ink/60" />}>
            <Wishlist />
          </Suspense>
        </section>
      </main>
      <Footer />
    </div>
  );
}
