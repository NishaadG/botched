import type { ReactNode } from "react";
import { getGlobalStats } from "@/lib/stats";

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: n > 9999 ? "compact" : "standard" }).format(n);

/** Live counters straight from the game store. Nothing here is seeded. */
export async function LiveStats({ compact = false }: { compact?: boolean }) {
  const s = await getGlobalStats();
  const classic = s.humanWins + s.botWins;
  const botRate = classic ? Math.round((s.botWins / classic) * 100) : null;
  const items = [
    { label: "games played", value: fmt(s.games) },
    { label: "players so far", value: fmt(Math.max(s.players, s.visitors)) },
    { label: "messages sent", value: fmt(s.messages) },
    { label: "bot got away", value: botRate === null ? "—" : `${botRate}%` },
  ];
  return (
    <dl className={`grid grid-cols-2 gap-3 ${compact ? "" : "md:grid-cols-4"}`}>
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border border-line bg-ink/60 px-4 py-3">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="font-display text-2xl font-extrabold tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LiveStatsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${compact ? "" : "md:grid-cols-4"}`}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-2xl border border-line bg-ink/60" />
      ))}
    </div>
  );
}

/** A titled block of live counters that stays hidden until the first game has finished (a row of zeros sells nothing). */
export async function LiveStatsSection({ title, aside, className = "" }: { title?: string; aside?: ReactNode; className?: string }) {
  const { games } = await getGlobalStats();
  if (!games) return null;
  return (
    <section className={className}>
      {title && (
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h2>
          {aside}
        </div>
      )}
      <LiveStats />
    </section>
  );
}
