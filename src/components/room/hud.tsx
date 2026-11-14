"use client";

import { useEffect, useState } from "react";
import type { RoomView } from "@/lib/game/engine";
import { handle } from "@/components/sigil";
import { Avatar } from "./chat";

const PHASE_LABEL: Record<string, string> = {
  answer: "Answer",
  chat: "Discuss",
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

function phaseTotal(view: RoomView) {
  const s = view.settings;
  return view.phase === "answer" ? s.answerSeconds : view.phase === "chat" ? s.chatSeconds : view.phase === "vote" ? s.voteSeconds : s.revealSeconds;
}

/** The three steps of a round, so new players always know what happens next. */
function Steps({ phase, interrogation }: { phase: string; interrogation: boolean }) {
  const steps = interrogation ? ["chat", "vote"] : ["answer", "chat", "vote"];
  return (
    <ol className="hidden items-center gap-1 text-[11px] uppercase tracking-widest sm:flex">
      {steps.map((s, i) => {
        const active = s === phase || (phase === "reveal" && s === "vote");
        const done = steps.indexOf(phase === "reveal" ? "vote" : phase) > i;
        return (
          <li key={s} className="flex items-center gap-1">
            {i > 0 && <span className="text-line">──</span>}
            <span className={active ? "text-brand glow" : done ? "text-muted" : "text-muted/50"}>
              {interrogation && s === "chat" ? "Questioning" : interrogation && s === "vote" ? "Verdict" : PHASE_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PhaseBar({ view, offset }: { view: RoomView; offset: number }) {
  const left = useCountdown(view.phaseEndsAt, offset);
  const total = phaseTotal(view) || 1;
  const pct = Math.min(100, (left / total) * 100);
  const urgent = left <= 10 && view.phase !== "reveal";
  const interrogation = view.variant === "interrogation";
  const label = interrogation && view.phase === "chat" ? "Questioning" : interrogation && view.phase === "vote" ? "Verdict" : PHASE_LABEL[view.phase];
  return (
    <div className="shrink-0 border-b border-line/80">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="crt text-xl leading-none text-muted">
            R{view.round}/{view.maxRounds}
          </span>
          <span
            className={`crt glow text-2xl leading-none uppercase ${
              view.phase === "vote" ? "text-hot" : view.phase === "reveal" ? "text-warn" : "text-brand"
            }`}
          >
            {label}
          </span>
          {!interrogation && <Steps phase={view.phase} interrogation={false} />}
        </div>
        <span className={`crt glow text-4xl leading-none tabular-nums ${urgent ? "animate-pulse text-hot" : "text-brand"}`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="h-[3px] bg-panel-2">
        <div
          className={`h-full transition-[width] duration-300 ${urgent ? "bg-hot" : "bg-brand"}`}
          style={{ width: `${pct}%`, boxShadow: "0 0 10px currentColor" }}
        />
      </div>
      {view.prompt && (view.phase === "answer" || view.phase === "chat") && !interrogation && (
        <p className="px-4 py-2.5 text-[15px] leading-snug md:px-5 md:text-base">
          <span className="text-muted">PROMPT: </span>
          <span className={`text-text ${view.phase === "answer" ? "cursor" : ""}`}>{view.prompt}</span>
        </p>
      )}
      <PlayerStrip view={view} />
    </div>
  );
}

/** Phones: the player list as one scrolling row, since there's no room for a side panel. */
function PlayerStrip({ view }: { view: RoomView }) {
  return (
    <ul className="scrollbar-thin flex gap-1.5 overflow-x-auto border-t border-line/50 px-3 py-2 md:hidden">
      {view.players.map((p) => {
        const out = view.eliminations.find((e) => e.playerId === p.id);
        const me = p.id === view.you?.id;
        return (
          <li
            key={p.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-1 text-[11px] ${me ? "border-brand/50" : "border-line/70"}`}
          >
            <Avatar p={p} size={16} />
            <span className={p.alive ? "" : "text-muted line-through"} style={{ color: p.alive ? p.color : undefined }}>
              {handle(p.alias)}
            </span>
            {me && <span className="text-muted">you</span>}
            {out && <span className="text-muted">{out.wasBot ? "AI" : "human"}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function PlayersPanel({ view, meId }: { view: RoomView; meId: string }) {
  const me = view.you;
  const reverse = view.mode === "reverse";
  const interrogation = view.variant === "interrogation";
  return (
    <aside className="card hidden min-h-0 flex-col gap-4 overflow-y-auto p-4 md:flex">
      {me && (
        <div className="border border-line bg-ink p-3">
          <p className="text-[11px] uppercase tracking-widest text-muted">Your identity</p>
          <div className="mt-2 flex items-center gap-2.5">
            <Avatar p={me} size={36} />
            <span className="crt glow text-2xl leading-none" style={{ color: me.color }}>
              {handle(me.alias)}
            </span>
          </div>
          {!me.alive && <p className="mt-2 text-xs text-hot">You were voted out. You can still watch.</p>}
        </div>
      )}
      <div>
        <p className="mb-2 text-[11px] uppercase tracking-widest text-muted">
          {interrogation ? "In the room" : `Players · ${view.players.filter((p) => p.alive).length} left`}
        </p>
        <ul className="flex flex-col gap-1">
          {view.players.map((p) => {
            const out = view.eliminations.find((e) => e.playerId === p.id);
            return (
              <li key={p.id} className={`flex items-center gap-2 px-2 py-1.5 ${p.id === meId ? "bg-brand/[0.06]" : ""}`}>
                <Avatar p={p} size={24} />
                <span className={`text-sm ${p.alive ? "" : "text-muted line-through"}`} style={{ color: p.alive ? p.color : undefined }}>
                  {handle(p.alias)}
                </span>
                {interrogation && p.id !== meId && <span className="ml-auto text-[10px] uppercase text-muted">detective</span>}
                {out && <span className="ml-auto text-[10px] uppercase text-muted">{out.wasBot ? "AI" : "human"}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-auto border-t border-line/60 pt-3 text-xs leading-relaxed text-muted">
        <p className="mb-1 uppercase tracking-widest text-brand/80">{">"} tip</p>
        {interrogation
          ? "Short, literal, perfectly punctuated. No jokes, no feelings, no stories about your weekend."
          : reverse
            ? "The AIs hunt for typos, slang and feelings. Write like a calm, polite language model."
            : view.phase === "answer"
              ? "Answer like yourself. The bot reads the answers that are already in and tries to sound like the room."
              : "Ask oddly specific questions. The bot sounds normal, but struggles to be weird in the same way twice."}
      </div>
    </aside>
  );
}
