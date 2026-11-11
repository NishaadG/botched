"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import { Avatar } from "./chat";

export function VoteSheet({ view, meId, onVote }: { view: RoomView; meId: string; onVote: (id: string) => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const options = view.players.filter((p) => p.alive && p.id !== meId);
  const alive = view.players.filter((p) => p.alive).length;
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-line bg-panel/95 p-5 backdrop-blur-xl"
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="font-display text-2xl font-extrabold">Who is the bot?</p>
          <p className="text-sm text-muted">
            {view.youVotedFor ? "Vote locked in. You can still change it." : "Tap a player to vote them out."}
          </p>
        </div>
        <span className="font-mono text-sm text-muted">
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
              className={`flex items-center gap-2 rounded-2xl border p-3 text-left transition ${
                chosen ? "border-hot bg-hot/15" : "border-line bg-ink hover:border-muted"
              }`}
            >
              <Avatar p={p} size={34} />
              <span className="text-sm font-semibold" style={{ color: p.color }}>
                {p.alias}
              </span>
              {chosen && <span className="ml-auto text-hot">✓</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-hot">{error}</p>}
    </motion.div>
  );
}

export function RevealCard({ view }: { view: RoomView }) {
  const last = view.eliminations.at(-1);
  if (!last) return null;
  const out = view.players.find((p) => p.id === last.playerId);
  const total = Object.values(last.tally).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink/80 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, rotate: -2 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 14 }}
        className="card w-full max-w-md p-6 text-center"
      >
        {out ? (
          <>
            <div className="mx-auto mb-3 w-fit">
              <Avatar p={{ ...out, alive: true }} size={72} />
            </div>
            <p className="font-display text-2xl font-extrabold" style={{ color: out.color }}>
              {out.alias}
            </p>
            <p className="text-muted">was voted out and was…</p>
            <motion.p
              initial={{ opacity: 0, scale: 2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, type: "spring" }}
              className={`mt-2 font-display text-5xl font-black ${last.wasBot ? "text-brand" : "text-hot"}`}
            >
              {last.wasBot ? "THE BOT 🤖" : "HUMAN 😬"}
            </motion.p>
          </>
        ) : (
          <p className="font-display text-3xl font-extrabold">Tie vote. Nobody leaves.</p>
        )}
        <ul className="mt-5 space-y-1.5 text-left">
          {Object.entries(last.tally)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => {
              const p = view.players.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate" style={{ color: p?.color }}>
                    {p?.alias}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${(n / total) * 100}%` }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="block h-full rounded-full"
                      style={{ background: p?.color }}
                    />
                  </span>
                  <span className="w-5 text-right font-mono text-muted">{n}</span>
                </li>
              );
            })}
        </ul>
      </motion.div>
    </div>
  );
}
