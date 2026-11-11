"use client";

import { useEffect, useState } from "react";
import { NicknameForm, useSession } from "@/components/session";

interface Game {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
}

export function NextGameVote({ games }: { games: readonly Game[] }) {
  const { session, saveName } = useSession();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/next-game", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setCounts(j.counts ?? {});
        setMine(j.mine ?? null);
      })
      .catch(() => {});
  }, [session?.uid]);

  const vote = async (id: string) => {
    setPending(id);
    try {
      const res = await fetch("/api/next-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: id }),
      });
      const j = await res.json();
      if (res.ok) {
        setCounts(j.counts);
        setMine(j.mine);
      }
    } finally {
      setPending(null);
    }
  };

  const total = Object.values(counts).reduce((a, b) => a + Math.max(0, b), 0);

  return (
    <div className="flex flex-col gap-4">
      {asking && !session && (
        <div className="card p-5">
          <p className="mb-3 font-semibold">Pick a nickname to cast your vote</p>
          <NicknameForm
            cta="Save and vote"
            onSubmit={async (n) => {
              await saveName(n);
              const id = asking;
              setAsking(null);
              await vote(id);
            }}
          />
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {games.map((g) => {
          const n = Math.max(0, counts[g.id] ?? 0);
          const pct = total ? Math.round((n / total) * 100) : 0;
          const picked = mine === g.id;
          return (
            <li key={g.id} className={`card relative flex flex-col gap-3 overflow-hidden p-5 ${picked ? "ring-2 ring-brand" : ""}`}>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-brand/[0.07] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <span className="text-3xl" aria-hidden>
                  {g.emoji}
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold">{g.title}</h3>
                  <p className="mt-1 text-sm text-muted">{g.blurb}</p>
                </div>
              </div>
              <div className="relative mt-auto flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted">
                  {n} vote{n === 1 ? "" : "s"}
                  {total > 0 && ` · ${pct}%`}
                </span>
                <button
                  className={`btn px-4 py-2 text-sm ${picked ? "btn-brand" : "btn-ghost"}`}
                  onClick={() => (session ? vote(g.id) : setAsking(g.id))}
                  disabled={pending !== null || picked}
                  aria-pressed={picked}
                >
                  {picked ? "Your pick ✓" : pending === g.id ? "Voting…" : "I want this"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
