"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomView } from "@/lib/game/engine";
import type { IncomingMessage } from "@/lib/nexconn-client";
import { handle, Sigil } from "@/components/sigil";

type PlayerView = RoomView["players"][number];

export function Avatar({ p, size = 36 }: { p?: Pick<PlayerView, "alias" | "color" | "alive">; size?: number }) {
  return <Sigil seed={p?.alias ?? ""} color={p?.color} size={size} dim={Boolean(p && !p.alive)} />;
}

const clock = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const isAnswer = (m: IncomingMessage) => m.extra?.answer !== undefined;

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
    <ul className="flex flex-col gap-1" aria-live={live ? "polite" : undefined} aria-relevant="additions">
      <AnimatePresence initial={false}>
        {messages.map((m, i) => {
          if (m.from === gmId) {
            const round = /^Round (\d+)\./.exec(m.text ?? "");
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`${round ? "mt-4 border-y border-brand/25 bg-brand/[0.06] py-2" : "my-1"} px-1 text-[13px] leading-relaxed text-brand`}
              >
                <span className="mr-2 text-brand/60">{">>"}</span>
                {round ? (
                  <>
                    <span className="crt glow mr-2 text-lg leading-none">ROUND {round[1]}</span>
                    <span className="text-text">{(m.text ?? "").replace(/^Round \d+\.\s*/, "")}</span>
                  </>
                ) : (
                  <span className="uppercase tracking-wide">{m.text}</span>
                )}
              </motion.li>
            );
          }
          const p = players.get(m.from);
          if (!p) return null;
          const mine = m.from === meId;
          const answer = isAnswer(m);
          const firstAnswer = answer && !(messages[i - 1] && isAnswer(messages[i - 1]));
          const who = (
            <span className="shrink-0 font-semibold" style={{ color: p.color }}>
              {handle(p.alias)}
              {mine && <span className="font-normal text-muted"> (you)</span>}
              {showNames && p.name && (
                <span className={`ml-1 font-normal ${p.isBot ? "text-hot" : "text-muted"}`}>[{p.isBot ? "AI" : p.name}]</span>
              )}
            </span>
          );
          if (answer) {
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className={`${firstAnswer ? "mt-2" : ""} flex items-start gap-2 border-l-2 bg-panel-2/70 px-3 py-2 text-[14px] ${
                  showNames && p.isBot ? "ring-1 ring-hot/60" : ""
                }`}
                style={{ borderColor: p.color }}
              >
                <Avatar p={p} size={22} />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-muted">
                    answer · {who}
                  </div>
                  <p className="mt-0.5 break-words text-text">{m.text}</p>
                </div>
              </motion.li>
            );
          }
          return (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`group flex items-start gap-2 rounded-sm px-1 py-1 text-[14px] leading-snug ${mine ? "bg-brand/[0.06]" : ""} ${
                showNames && p.isBot ? "bg-hot/[0.08]" : ""
              }`}
            >
              <span className="hidden w-10 shrink-0 pt-0.5 text-[11px] text-muted/70 sm:block">{clock(m.at)}</span>
              <Avatar p={p} size={20} />
              <p className="min-w-0 break-words">
                {who}
                <span className="mx-1.5 text-muted">{">"}</span>
                <span className="text-text">{m.text}</span>
              </p>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function ChatPanel({
  view,
  messages,
  players,
  gmId,
  meId,
  typing,
  onSend,
  onAnswer,
  onTyping,
}: {
  view: RoomView;
  messages: IncomingMessage[];
  players: Map<string, PlayerView>;
  gmId: string;
  meId: string;
  typing: Record<string, number>;
  onSend: (text: string) => Promise<void>;
  onAnswer: (text: string) => Promise<unknown>;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const alive = Boolean(view.you?.alive);
  const phase = view.phase;
  const answering = phase === "answer" && alive;
  const answered = Boolean(view.yourAnswer);
  const canType = alive && (phase === "chat" || (answering && !answered));
  const reverse = view.mode === "reverse";
  const interrogation = view.variant === "interrogation";
  const aliveCount = view.players.filter((p) => p.alive).length;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Stay at the bottom while the reader is there; otherwise count what they haven't seen.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (pinned.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setUnseen(0);
    } else setUnseen((n) => n + 1);
  }, [messages.length]);

  const jump = () => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    pinned.current = true;
    setUnseen(0);
  };

  const typers = Object.entries(typing)
    .filter(([id, until]) => until > now && id !== meId && players.get(id)?.alive)
    .map(([id]) => players.get(id)!);

  const placeholder = !alive
    ? "You're out. Watch the rest of the game."
    : phase === "answer"
      ? answered
        ? "Answer locked. Waiting for the others…"
        : reverse
          ? "Answer like an AI would. Revealed when everyone's in."
          : "Your answer. Revealed when everyone's in."
      : phase === "vote"
        ? interrogation
          ? "The detective is deciding…"
          : "Voting. Chat is paused."
        : phase === "reveal"
          ? "Revealing…"
          : interrogation
            ? "Answer the detective. Stay robotic."
            : reverse
              ? "Type like a bot. Calm, tidy, no slang."
              : "Say something human…";

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          if (pinned.current && unseen) setUnseen(0);
        }}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-5"
      >
        <MessageList messages={messages} players={players} gmId={gmId} meId={meId} live />
      </div>
      {unseen > 0 && (
        <button
          onClick={jump}
          className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-sm border border-brand/50 bg-ink px-3 py-1 text-xs text-brand"
        >
          {unseen} new ↓
        </button>
      )}
      <div className="flex h-6 shrink-0 items-center px-4 text-xs text-muted md:px-5">
        {phase === "answer" ? (
          <span>
            {">"} answers in: <b className="text-text">{view.answersIn}</b>/{aliveCount}
            {answered && <span className="text-brand"> · yours is locked</span>}
          </span>
        ) : (
          typers.length > 0 && (
            <span className="flex items-center gap-1.5">
              {typers.map((p) => handle(p.alias)).join(", ")} {typers.length > 1 ? "are" : "is"} typing
              <span className="inline-flex gap-0.5">
                <i className="typing-dot h-1 w-1 bg-muted" />
                <i className="typing-dot h-1 w-1 bg-muted" />
                <i className="typing-dot h-1 w-1 bg-muted" />
              </span>
            </span>
          )
        )}
      </div>
      <form
        className="flex shrink-0 items-center gap-2 border-t border-line/80 bg-ink/60 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || busy) return;
          setError("");
          setBusy(true);
          setText("");
          try {
            if (phase === "answer") await onAnswer(t);
            else await onSend(t);
            jump();
          } catch (err) {
            setText(t);
            setError(err instanceof Error ? err.message : "Couldn't send.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className={`crt text-2xl leading-none ${canType ? "text-brand glow" : "text-muted"}`} aria-hidden>
          {phase === "answer" ? "?" : ">"}
        </span>
        <input
          className="input !border-transparent !bg-transparent !px-1 !shadow-none"
          value={text}
          maxLength={phase === "answer" ? 200 : 300}
          disabled={!canType}
          placeholder={placeholder}
          aria-label={phase === "answer" ? "Your answer" : "Message"}
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value && phase === "chat") onTyping();
          }}
        />
        <button className="btn btn-brand px-4 py-2.5" disabled={!canType || !text.trim() || busy}>
          {phase === "answer" ? "Lock" : "Send"}
        </button>
      </form>
      {error && <p className="shrink-0 px-4 pb-2 text-xs text-hot">{error}</p>}
    </>
  );
}
