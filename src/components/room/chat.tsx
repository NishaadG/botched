"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import type { IncomingMessage } from "@/lib/nexconn-client";

type PlayerView = RoomView["players"][number];

export function Avatar({ p, size = 36 }: { p?: Pick<PlayerView, "avatar" | "color" | "alive">; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `${p?.color ?? "#94a3b8"}22`,
        boxShadow: `inset 0 0 0 2px ${p?.color ?? "#94a3b8"}`,
        filter: p && !p.alive ? "grayscale(1) opacity(.5)" : undefined,
      }}
      aria-hidden
    >
      {p?.avatar ?? "🙂"}
    </span>
  );
}

export function MessageList({
  messages,
  players,
  gmId,
  meId,
  showNames = false,
  live = false,
}: {
  messages: IncomingMessage[];
  players: Map<string, PlayerView>;
  gmId: string;
  meId: string;
  showNames?: boolean;
  /** Announce new messages to screen readers (the live game chat, not the replay). */
  live?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2.5" aria-live={live ? "polite" : undefined} aria-relevant="additions">
      <AnimatePresence initial={false}>
        {messages.map((m) => {
          if (m.from === gmId) {
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto my-1 max-w-[90%] rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-center text-sm"
              >
                <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-brand">Game master</span>
                {m.text}
              </motion.li>
            );
          }
          const p = players.get(m.from);
          if (!p) return null;
          const mine = m.from === meId;
          return (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
            >
              <Avatar p={p} size={30} />
              <div className={`max-w-[78%] ${mine ? "items-end text-right" : ""} flex flex-col`}>
                <span className="mb-0.5 px-1 text-[11px] font-semibold" style={{ color: p.color }}>
                  {p.alias}
                  {mine && " (you)"}
                  {showNames && p.name && <span className="ml-1 font-normal text-muted">· {p.isBot ? "🤖 bot" : p.name}</span>}
                </span>
                <span
                  className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                    mine ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md bg-panel-2"
                  } ${showNames && p.isBot ? "ring-2 ring-hot" : ""}`}
                >
                  {m.text}
                </span>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function ChatPanel({
  messages,
  players,
  gmId,
  meId,
  typing,
  canSend,
  phase,
  alive,
  onSend,
  onTyping,
}: {
  messages: IncomingMessage[];
  players: Map<string, PlayerView>;
  gmId: string;
  meId: string;
  typing: Record<string, number>;
  canSend: boolean;
  phase: string;
  alive: boolean;
  onSend: (text: string) => Promise<void>;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const typers = Object.entries(typing)
    .filter(([id, until]) => until > now && id !== meId && players.get(id)?.alive)
    .map(([id]) => players.get(id)!);

  const placeholder = !alive
    ? "You're out. Watch the rest of the game."
    : phase === "vote"
      ? "Voting. Chat is paused."
      : phase === "reveal"
        ? "Revealing…"
        : "Say something human…";

  return (
    <>
      <div ref={scroller} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 md:px-5">
        <MessageList messages={messages} players={players} gmId={gmId} meId={meId} live />
      </div>
      <div className="h-6 px-5 text-xs text-muted">
        {typers.length > 0 && (
          <span className="flex items-center gap-1.5">
            {typers.map((p) => p.alias).join(", ")} {typers.length > 1 ? "are" : "is"} typing
            <span className="inline-flex gap-0.5">
              <i className="typing-dot h-1 w-1 rounded-full bg-muted" />
              <i className="typing-dot h-1 w-1 rounded-full bg-muted" />
              <i className="typing-dot h-1 w-1 rounded-full bg-muted" />
            </span>
          </span>
        )}
      </div>
      <form
        className="flex gap-2 border-t border-line/60 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          setError("");
          try {
            await onSend(t);
          } catch (err) {
            setText(t);
            setError(err instanceof Error ? err.message : "Couldn't send.");
          }
        }}
      >
        <input
          className="input"
          value={text}
          maxLength={300}
          disabled={!canSend}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping();
          }}
        />
        <button className="btn btn-brand px-5" disabled={!canSend || !text.trim()} aria-label="Send">
          ➤
        </button>
      </form>
      {error && <p className="px-4 pb-2 text-xs text-hot">{error}</p>}
    </>
  );
}
