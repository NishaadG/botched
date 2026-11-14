"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import { handle } from "@/components/sigil";
import { Avatar } from "./chat";

export function VoteSheet({ view, meId, onVote }: { view: RoomView; meId: string; onVote: (id: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const options = view.players.filter((p) => p.alive && p.id !== meId);
  const alive = view.players.filter((p) => p.alive).length;
  const reverse = view.mode === "reverse";
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="absolute inset-x-0 bottom-0 z-20 border-t-2 border-hot/70 bg-ink/95 p-4 backdrop-blur-md md:p-5"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="crt glow text-3xl leading-none text-hot">{reverse ? "WHO IS THE HUMAN?" : "WHO IS THE BOT?"}</p>
          <p className="mt-1 text-xs text-muted">
            {view.youVotedFor
              ? "Vote locked. You can still change it."
              : reverse
                ? "Vote like an AI would. Pick someone who seems human."
                : "Select a player to vote them out."}
          </p>
        </div>
        <span className="text-xs text-muted">
          {view.votesIn}/{alive} voted
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((p) => {
          const chosen = view.youVotedFor === p.id;
          return (
            <button
              key={p.id}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(p.id);
                setError("");
                try {
                  await onVote(p.id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Vote failed.");
                } finally {
                  setBusy(null);
                }
              }}
              className={`flex items-center gap-2 rounded-sm border p-2.5 text-left transition ${
                chosen ? "border-hot bg-hot/15" : "border-line bg-panel hover:border-muted"
              }`}
            >
              <Avatar p={p} size={28} />
              <span className="truncate text-sm font-semibold" style={{ color: p.color }}>
                {handle(p.alias)}
              </span>
              {chosen && <span className="crt ml-auto text-lg leading-none text-hot">[X]</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-hot">{error}</p>}
    </motion.div>
  );
}

/** Interrogation: no vote for the suspect, just the wait for the ruling. */
export function VerdictWait() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 border-t-2 border-warn/60 bg-ink/95 p-5 text-center backdrop-blur-md">
      <p className="crt glow cursor text-3xl leading-none text-warn">ANALYSING TRANSCRIPT</p>
      <p className="mt-2 text-xs text-muted">The detective is deciding whether you are human.</p>
    </div>
  );
}

export function RevealCard({ view }: { view: RoomView }) {
  const last = view.eliminations.at(-1);
  if (!last) return null;
  const out = view.players.find((p) => p.id === last.playerId);
  const total = Object.values(last.tally).reduce((a, b) => a + b, 0) || 1;
  const interrogation = view.variant === "interrogation";

  if (interrogation) {
    const human = view.verdict === "human";
    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-ink/85 p-4 backdrop-blur-md">
        <div className="scanbar" />
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md p-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Case file · verdict</p>
          <motion.p
            initial={{ opacity: 0, scale: 1.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className={`crt glow mt-3 text-7xl leading-none ${human ? "text-hot" : "text-brand"}`}
          >
            {human ? "HUMAN" : "MACHINE"}
          </motion.p>
          <p className="mt-3 text-sm text-muted">{human ? "The detective saw through you." : "You passed as an AI."}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink/85 p-4 backdrop-blur-md">
      <div className="scanbar" />
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md p-6 text-center">
        {out ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Scanning voted-out player</p>
            <div className="mx-auto mt-3 w-fit">
              <Avatar p={{ ...out, alive: true }} size={64} />
            </div>
            <p className="crt glow mt-3 text-3xl leading-none" style={{ color: out.color }}>
              {handle(out.alias)}
            </p>
            <motion.p
              initial={{ opacity: 0, scale: 1.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, type: "spring" }}
              className={`crt glow mt-3 text-6xl leading-none ${last.wasBot ? "text-brand" : "text-hot"}`}
            >
              {last.wasBot ? "AI" : "HUMAN"}
            </motion.p>
          </>
        ) : (
          <p className="crt glow text-4xl leading-none text-warn">TIE. NOBODY LEAVES.</p>
        )}
        <ul className="mt-5 space-y-1.5 text-left">
          {Object.entries(last.tally)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => {
              const p = view.players.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate" style={{ color: p?.color }}>
                    {p ? handle(p.alias) : ""}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden bg-panel-2">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${(n / total) * 100}%` }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="block h-full"
                      style={{ background: p?.color }}
                    />
                  </span>
                  <span className="w-5 text-right text-muted">{n}</span>
                </li>
              );
            })}
        </ul>
      </motion.div>
    </div>
  );
}
