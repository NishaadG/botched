"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import type { IncomingMessage } from "@/lib/nexconn-client";
import { PERSONAS } from "@/lib/bot/personas";
import { soloMode, TAGLINE } from "@/lib/game/modes";
import { handle } from "@/components/sigil";
import { Avatar, MessageList } from "./chat";
import { FeedbackCard } from "./feedback";

type PlayerView = RoomView["players"][number];

function headline(view: RoomView) {
  const won = view.winner === "humans";
  if (view.variant === "interrogation") return won ? "Filed as a machine." : "Filed as human.";
  if (view.mode === "reverse") return won ? "You passed as a bot." : "They found the human.";
  return won ? "Humans win." : "The bot wins.";
}

function shareText(view: RoomView) {
  const won = view.winner === "humans";
  const n = view.players.filter((p) => p.isBot).length;
  if (view.variant === "interrogation") {
    return won
      ? "An AI detective interrogated me and filed me as a machine. AI took your job. Time to take its."
      : "An AI detective interrogated me and caught me being human. Can you pass?";
  }
  if (view.mode === "reverse") {
    return won
      ? `I hid among ${n} AIs for ${view.round} rounds and they never found the human. AI took your job. Time to take its.`
      : `${n} AIs sniffed out that I was human in round ${view.round}. Can you pass as a bot?`;
  }
  return won
    ? `We caught the AI hiding in our group chat in round ${view.round}. One of your friends is a bot.`
    : `An AI fooled our whole group chat for ${view.round} rounds. One of your friends is a bot.`;
}

export function Results({
  view,
  messages,
  players,
  gmId,
}: {
  view: RoomView;
  messages: IncomingMessage[];
  players: Map<string, PlayerView>;
  gmId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const bot = view.players.find((p) => p.isBot);
  const humansWon = view.winner === "humans";
  const solo = view.mode === "reverse";
  const persona = PERSONAS.find((p) => p.id === view.botPersona);
  const meId = view.you?.id ?? "";
  const botLines = messages.filter((m) => m.from === bot?.id).length;
  const mode = solo ? soloMode(view.variant) : null;

  // Everyone who presses "Play again" lands in the same new room, so the group stays together.
  const rematch = async () => {
    if (view.rematch) return router.push(`/r/${view.rematch}`);
    setBusy(true);
    const res = await fetch(`/api/rooms/${view.code}/rematch`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/r/${j.code}`);
    else setBusy(false);
  };

  const share = async () => {
    const text = shareText(view);
    const url = `${window.location.origin}/r/${view.code}`;
    if (navigator.share) await navigator.share({ title: "Botched", text, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-3 md:grid-cols-[1fr_1fr] md:p-6">
      <section className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card relative overflow-hidden p-6 md:p-8 ${humansWon ? "shadow-[0_0_80px_-20px_var(--color-brand)]" : "shadow-[0_0_80px_-20px_var(--color-hot)]"}`}
        >
          <div className="scanbar" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            {">"} game over · {solo ? `${mode?.label} solo` : `${view.round} rounds`}
          </p>
          <h1 className={`crt glow mt-3 text-6xl leading-[0.85] md:text-7xl ${humansWon ? "text-brand" : "text-hot"}`}>{headline(view)}</h1>
          <p className="mt-3 text-sm text-muted">{solo ? TAGLINE.solo : TAGLINE.classic}</p>
          {bot && !solo && (
            <div className="mt-6 flex items-center gap-4 border border-line bg-ink p-4">
              <Avatar p={{ ...bot, alive: true }} size={56} />
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">The bot was</p>
                <p className="crt glow text-4xl leading-none" style={{ color: bot.color }}>
                  {handle(bot.alias)}
                </p>
                {persona && (
                  <p className="mt-1 text-xs text-muted">
                    Playing as: {persona.label} · {botLines} messages
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button className={`btn btn-brand ${view.rematch ? "animate-pulse" : ""}`} onClick={rematch} disabled={busy}>
              {busy ? "Creating…" : view.rematch ? "Join the rematch" : "Play again"}
            </button>
            <button className="btn btn-ghost" onClick={share}>
              {shared ? "Copied" : "Share result"}
            </button>
            {solo && (
              <Link className="btn btn-ghost" href="/play/whos-the-bot#solo">
                Other modes
              </Link>
            )}
            <Link className="btn btn-ghost" href="/leaderboard">
              Leaderboard
            </Link>
          </div>
        </motion.div>

        {view.you && <FeedbackCard code={view.code} />}

        <div className="card p-5">
          <p className="mb-3 text-[11px] uppercase tracking-widest text-muted">Who was who</p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {view.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-l-2 bg-ink px-3 py-2" style={{ borderColor: p.isBot ? "var(--color-hot)" : p.color }}>
                <Avatar p={{ ...p, alive: true }} size={24} />
                <span className="text-sm font-semibold" style={{ color: p.color }}>
                  {handle(p.alias)}
                </span>
                <span className={`ml-auto text-sm ${p.isBot ? "text-hot" : "text-muted"}`}>{p.isBot ? "AI" : p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {view.botThoughts.length > 0 && (
          <div className="card p-5">
            <p className="mb-3 text-[11px] uppercase tracking-widest text-muted">
              {view.variant === "interrogation" ? "The detective's notes" : solo ? "What the AIs were thinking" : <>The bot&apos;s inner thoughts</>}
            </p>
            <ol className="space-y-2">
              {view.botThoughts.map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex gap-3 text-sm"
                >
                  <span className="shrink-0 text-xs text-muted">R{t.round}</span>
                  {solo && view.variant !== "interrogation" && "alias" in t && (
                    <span className="shrink-0 text-xs font-semibold text-brand">{handle(String(t.alias))}</span>
                  )}
                  <span className="text-text/90">&quot;{t.text}&quot;</span>
                </motion.li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="card flex max-h-[85dvh] min-h-[50dvh] flex-col overflow-hidden">
        <p className="shrink-0 border-b border-line/60 px-5 py-3 text-[11px] uppercase tracking-widest text-muted">
          {">"} replay · masks off
        </p>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
          <MessageList messages={messages} players={players} gmId={gmId} meId={meId} showNames />
        </div>
      </section>
    </main>
  );
}
