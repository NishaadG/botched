import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { DailyChart } from "@/components/hub/daily-chart";
import { LiveStats, LiveStatsSkeleton } from "@/components/hub/live-stats";
import { Nav } from "@/components/nav";
import { getDailySeries, getFeedback, getNextGameVotes, getPlaytests, NEXT_GAMES } from "@/lib/stats";
import { getSources } from "@/lib/visits";

export const metadata: Metadata = {
  title: "Live stats",
  description: "Public, live numbers for Botched: games played, active players, ratings and what players asked for next.",
};

async function Charts() {
  const series = await getDailySeries(14);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DailyChart title="Games finished per day" unit="games" color="#3dff72" data={series.map((d) => ({ day: d.day, value: d.games }))} />
      <DailyChart
        title="Active players per day"
        unit="players"
        color="#5ce8ff"
        data={series.map((d) => ({ day: d.day, value: d.visitors }))}
      />
      <DailyChart
        title="Site visitors per day"
        unit="visitors"
        color="#c39bff"
        data={series.map((d) => ({ day: d.day, value: d.site }))}
      />
      <Sources />
    </div>
  );
}

/** Which links and sites people arrive from, and how many of them went on to pick a nickname. */
async function Sources() {
  const rows = await getSources(8);
  const top = Math.max(1, ...rows.map((r) => r.visits));
  return (
    <figure className="card flex flex-col gap-3 p-5">
      <figcaption>
        <p className="font-semibold">Where people come from</p>
        <p className="text-xs text-muted">Visitors, and how many of them went on to play. Counted since Nov 18.</p>
      </figcaption>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
              <th className="pb-2 font-normal">source</th>
              <th className="pb-2 text-right font-normal">visitors</th>
              <th className="pb-2 pl-4 text-right font-normal">played</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-t border-line/60">
                <td className="py-1.5 pr-3">
                  <span className="block truncate">{r.source}</span>
                  <span className="mt-1 block h-1 bg-ink">
                    <span className="block h-1 bg-brand/70" style={{ width: `${(r.visits / top) * 100}%` }} />
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{r.visits}</td>
                <td className="py-1.5 pl-4 text-right font-mono tabular-nums">{r.players}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted">No visits counted yet.</p>
      )}
    </figure>
  );
}

async function Feedback() {
  const fb = await getFeedback(12);
  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card flex flex-col justify-center p-6">
        <p className="text-sm text-muted">Average post-game rating</p>
        <p className="crt glow text-8xl leading-none text-brand tabular-nums">
          {fb.avg === null ? "—" : fb.avg.toFixed(1)}
          <span className="text-2xl text-muted"> / 5</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          from {fb.count} rating{fb.count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="card p-6">
        <h2 className="crt text-3xl leading-none text-brand">What players said</h2>
        {fb.recent.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {fb.recent.map((f) => (
              <li key={`${f.code}-${f.at}-${f.name}`} className="rounded-sm bg-ink/60 p-4">
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
              {r.title}
            </p>
            <div className="mt-1 h-2 bg-ink">
              <div className="h-2 bg-warn" style={{ width: `${(r.n / top) * 100}%` }} />
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

/** Our own automated test games, published in full but kept out of every number above. */
async function Playtests() {
  const { games, messages, recent } = await getPlaytests(12);
  const when = (t: number) =>
    new Date(t).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="card flex flex-col gap-5 p-6">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="crt text-3xl leading-none text-brand">Our playtests</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Automated games we run to check every release: real Chrome browsers, scripted with Playwright, playing whole
            games through the same Nexconn chat and the same AI as everyone else. They are listed here in full and never
            added to the numbers above. Logged since Nov 22.
          </p>
        </div>
        <div className="flex gap-6 font-mono text-sm">
          <p>
            <span className="block text-[11px] uppercase tracking-widest text-muted">test games</span>
            <span className="crt text-4xl leading-none text-text tabular-nums">{games}</span>
          </p>
          <p>
            <span className="block text-[11px] uppercase tracking-widest text-muted">messages</span>
            <span className="crt text-4xl leading-none text-text tabular-nums">{messages}</span>
          </p>
        </div>
      </div>
      {recent.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
                <th className="pb-2 font-normal">finished (UTC)</th>
                <th className="pb-2 font-normal">game</th>
                <th className="pb-2 font-normal">players</th>
                <th className="pb-2 text-right font-normal">rounds</th>
                <th className="pb-2 font-normal pl-4">winner</th>
                <th className="pb-2 text-right font-normal">messages (AI)</th>
                <th className="pb-2 pl-4 font-normal">where</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={`${r.code}-${r.at}`} className="border-t border-line/60">
                  <td className="py-1.5 pr-3 font-mono text-xs text-muted">{when(r.at)}</td>
                  <td className="py-1.5 pr-3">{r.mode}</td>
                  <td className="py-1.5 pr-3 text-muted">
                    {r.humans} test player{r.humans === 1 ? "" : "s"} + {r.ais} AI{r.ais === 1 ? "" : "s"}
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{r.rounds}</td>
                  <td className={`py-1.5 pl-4 ${r.winner === "AI" ? "text-hot" : "text-brand"}`}>{r.winner}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {r.messages} <span className="text-muted">({r.aiMessages})</span>
                  </td>
                  <td className="py-1.5 pl-4 text-muted">{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No playtests logged yet.</p>
      )}
    </section>
  );
}

const Skeleton = ({ h = "h-64" }: { h?: string }) => <div className={`card ${h} animate-pulse`} />;

export default function StatsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-grid">
        <Nav />
        <header className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 md:pt-14">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} Open stats</p>
          <h1 className="mt-3 crt glow text-6xl leading-[0.85] text-brand md:text-7xl">Live numbers</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Counted live from real games, never seeded or edited. Days are in UTC. Active players are people who opened
            the app with a nickname that day. Site visitors are counted anonymously, without a cookie.
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
        <Suspense fallback={<Skeleton h="h-48" />}>
          <Playtests />
        </Suspense>
        <section className="card grid gap-6 p-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <h2 className="crt text-3xl leading-none text-brand">What players want next</h2>
            <p className="mt-1 text-muted">Votes from the game hub. The winner is the next game we build.</p>
            <Link href="/play" className="mt-4 inline-block text-sm text-brand hover:underline">
              Cast your vote →
            </Link>
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-sm bg-ink/60" />}>
            <Wishlist />
          </Suspense>
        </section>
      </main>
      <Footer />
    </div>
  );
}
