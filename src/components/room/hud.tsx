"use client";

import { useEffect, useState } from "react";
import type { RoomView } from "@/lib/game/engine";
import { Avatar } from "./chat";

const PHASE_LABEL: Record<string, string> = {
  chat: "Chat",
  vote: "Vote",
  reveal: "Reveal",
};

export function useCountdown(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));
}

export function PhaseBar({ view, offset }: { view: RoomView; offset: number }) {
  const left = useCountdown(view.phaseEndsAt, offset);
  const total =
    view.phase === "chat" ? view.settings.chatSeconds : view.phase === "vote" ? view.settings.voteSeconds : view.settings.revealSeconds;
  const pct = Math.min(100, (left / total) * 100);
  const urgent = left <= 10 && view.phase !== "reveal";
  return (
    <div className="border-b border-line/60">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-panel-2 px-2.5 py-1 font-mono text-xs">
            Round {view.round}/{view.maxRounds}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              view.phase === "vote" ? "bg-hot text-white" : view.phase === "reveal" ? "bg-warn text-ink" : "bg-brand text-brand-ink"
            }`}
          >
            {PHASE_LABEL[view.phase] ?? view.phase}
          </span>
          {view.you && (
            <span
              className="truncate rounded-full border px-2.5 py-1 text-xs font-semibold md:hidden"
              style={{ color: view.you.color, borderColor: `${view.you.color}66` }}
            >
              {view.you.avatar} {view.you.alias}
            </span>
          )}
        </div>
        <span className={`font-mono text-2xl font-bold tabular-nums ${urgent ? "text-hot animate-pulse" : ""}`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="h-1 bg-panel-2">
        <div
          className={`h-full transition-[width] duration-300 ${urgent ? "bg-hot" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {view.prompt && view.phase === "chat" && (
        <p className="px-4 py-3 font-display text-lg font-semibold leading-snug md:px-5 md:text-xl">“{view.prompt}”</p>
      )}
    </div>
  );
}

export function PlayersPanel({ view, meId }: { view: RoomView; meId: string }) {
  const me = view.you;
  return (
    <aside className="card flex flex-col gap-4 p-4">
      {me && (
        <div className="rounded-2xl border border-line bg-ink p-3">
          <p className="text-xs text-muted">You are</p>
          <div className="mt-1 flex items-center gap-2">
            <Avatar p={me} size={34} />
            <span className="font-display text-lg font-bold" style={{ color: me.color }}>
              {me.alias}
            </span>
          </div>
          {!me.alive && <p className="mt-2 text-xs text-hot">You were voted out. You can still watch.</p>}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-muted">
          Players · {view.players.filter((p) => p.alive).length} left
        </p>
        <ul className="flex flex-col gap-1.5">
          {view.players.map((p) => {
            const out = view.eliminations.find((e) => e.playerId === p.id);
            return (
              <li key={p.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${p.id === meId ? "bg-white/5" : ""}`}>
                <Avatar p={p} size={28} />
                <span className={`text-sm font-medium ${p.alive ? "" : "text-muted line-through"}`} style={{ color: p.alive ? p.color : undefined }}>
                  {p.alias}
                </span>
                {out && <span className="ml-auto text-[10px] text-muted">{out.wasBot ? "🤖 bot" : "human"}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-auto text-xs leading-relaxed text-muted">
        {view.mode === "reverse"
          ? "Tip: the AIs hunt for typos, slang and feelings. Write like a calm, polite language model."
          : "Tip: ask oddly specific questions. The bot is good at sounding normal, but bad at being weird in the same way twice."}
      </p>
    </aside>
  );
}
