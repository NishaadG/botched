"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import type { IncomingMessage } from "@/lib/nexconn-client";
import { PERSONAS } from "@/lib/bot/personas";
import { Avatar, MessageList } from "./chat";

type PlayerView = RoomView["players"][number];

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
  const bot = view.players.find((p) => p.isBot);
  const humansWon = view.winner === "humans";
  const persona = PERSONAS.find((p) => p.id === view.botPersona);
  const meId = view.you?.id ?? "";
  const botLines = messages.filter((m) => m.from === bot?.id).length;

  const rematch = async () => {
    setBusy(true);
    const res = await fetch("/api/rooms", { method: "POST" });
    const j = await res.json();
    if (res.ok) router.push(`/r/${j.code}`);
    setBusy(false);
  };

  const share = async () => {
    const text = humansWon
      ? `We caught the AI hiding in our group chat in round ${view.round}. Think you can? 🤖`
      : `An AI fooled our whole group chat for ${view.round} rounds. Think you'd spot it? 🤖`;
    const url = window.location.origin;
    if (navigator.share) await navigator.share({ title: "Who's the Bot", text, url }).catch(() => {});
    else await navigator.clipboard.writeText(`${text} ${url}`);
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-3 md:grid-cols-[1fr_1fr] md:p-6">
      <section className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card overflow-hidden p-6 md:p-8 ${humansWon ? "shadow-[0_0_80px_-20px_var(--color-brand)]" : "shadow-[0_0_80px_-20px_var(--color-hot)]"}`}
        >
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Game over · {view.round} rounds</p>
          <h1 className={`mt-2 font-display text-5xl font-black leading-none md:text-6xl ${humansWon ? "text-brand" : "text-hot"}`}>
            {humansWon ? "Humans win." : "The bot wins."}
          </h1>
          {bot && (
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-ink p-4">
              <Avatar p={{ ...bot, alive: true }} size={60} />
              <div>
                <p className="text-sm text-muted">The bot was</p>
                <p className="font-display text-2xl font-extrabold" style={{ color: bot.color }}>
                  {bot.alias}
                </p>
                {persona && <p className="text-sm text-muted">Playing as: {persona.label} · {botLines} messages</p>}
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-brand" onClick={rematch} disabled={busy}>
              {busy ? "Creating…" : "Play again"}
            </button>
            <button className="btn btn-ghost" onClick={share}>
              Share result
            </button>
            <Link className="btn btn-ghost" href="/leaderboard">
              Leaderboard
            </Link>
          </div>
        </motion.div>

        <div className="card p-5">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted">Who was who</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {view.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-ink px-3 py-2">
                <Avatar p={{ ...p, alive: true }} size={28} />
                <span className="text-sm font-semibold" style={{ color: p.color }}>
                  {p.alias}
                </span>
                <span className="ml-auto text-sm text-muted">{p.isBot ? "🤖 AI" : p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {view.botThoughts.length > 0 && (
          <div className="card p-5">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted">The bot&apos;s inner thoughts</p>
            <ol className="space-y-2">
              {view.botThoughts.map((t, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex gap-3 text-sm"
                >
                  <span className="font-mono text-xs text-muted">R{t.round}</span>
                  <span className="italic">“{t.text}”</span>
                </motion.li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="card flex max-h-[85dvh] flex-col overflow-hidden">
        <p className="border-b border-line/60 px-5 py-3 text-xs uppercase tracking-widest text-muted">Replay · masks off</p>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          <MessageList messages={messages} players={players} gmId={gmId} meId={meId} showNames />
        </div>
      </section>
    </main>
  );
}
