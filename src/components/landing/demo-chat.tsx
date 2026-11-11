"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type Line =
  | { kind: "gm"; text: string }
  | { kind: "msg"; who: number; text: string }
  | { kind: "typing"; who: number }
  | { kind: "reveal"; who: number };

const CAST = [
  { alias: "Mango Fox", avatar: "🦊", color: "#fb923c" },
  { alias: "Sky Whale", avatar: "🐳", color: "#38bdf8" },
  { alias: "Violet Owl", avatar: "🦉", color: "#a78bfa" },
  { alias: "Lime Frog", avatar: "🐸", color: "#a3e635" },
];

const SCRIPT: Line[] = [
  { kind: "gm", text: "Round 1 · What did you do last Sunday? Be honest." },
  { kind: "msg", who: 0, text: "slept till 2 and then felt guilty about it till 6" },
  { kind: "msg", who: 1, text: "watched 3 episodes of a show i cant even name now" },
  { kind: "typing", who: 3 },
  { kind: "msg", who: 3, text: "same as fox lol. sunday is for rotting 🫠" },
  { kind: "msg", who: 2, text: "went for a run. by run i mean walked to the chai place" },
  { kind: "msg", who: 1, text: "lime frog replied in like 0.5 seconds 👀" },
  { kind: "typing", who: 3 },
  { kind: "msg", who: 3, text: "bro i just type fast what" },
  { kind: "gm", text: "Time's up. Vote: who is the bot?" },
  { kind: "reveal", who: 3 },
];

export function DemoChat() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? SCRIPT.length : 1);

  useEffect(() => {
    if (reduce) return;
    const done = step >= SCRIPT.length;
    const delay = done ? 4200 : SCRIPT[step]?.kind === "typing" ? 1100 : 1500;
    const id = setTimeout(() => setStep((s) => (s >= SCRIPT.length ? 1 : s + 1)), delay);
    return () => clearTimeout(id);
  }, [step, reduce]);

  // Typing indicators only show while they are the latest line.
  const visible = SCRIPT.slice(0, step).filter((l, i, arr) => l.kind !== "typing" || i === arr.length - 1);

  return (
    <div className="card relative overflow-hidden p-0 shadow-[0_30px_120px_-40px_rgb(163_255_92/0.45)]">
      <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-panel-2 px-2.5 py-1 font-mono text-xs">Round 1/3</span>
          <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">Chat</span>
        </div>
        <div className="flex -space-x-2">
          {CAST.map((c) => (
            <span
              key={c.alias}
              className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm"
              style={{ boxShadow: `inset 0 0 0 2px ${c.color}` }}
              aria-hidden
            >
              {c.avatar}
            </span>
          ))}
        </div>
      </div>
      <ul className="flex h-[420px] flex-col justify-end gap-2.5 overflow-hidden p-4" aria-label="Example game chat">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((l) => {
            const key = SCRIPT.indexOf(l);
            if (l.kind === "gm")
              return (
                <motion.li
                  layout
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-auto rounded-2xl border border-brand/30 bg-brand/10 px-4 py-2 text-center text-sm"
                >
                  {l.text}
                </motion.li>
              );
            const c = CAST[l.who];
            if (l.kind === "reveal")
              return (
                <motion.li
                  layout
                  key={key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mx-auto flex items-center gap-3 rounded-2xl border border-hot/50 bg-hot/15 px-4 py-3"
                >
                  <span className="text-2xl" aria-hidden>
                    {c.avatar}
                  </span>
                  <span>
                    <b style={{ color: c.color }}>{c.alias}</b> was voted out.
                    <br />
                    <span className="font-display text-lg font-extrabold text-hot">It was the bot. 🤖</span>
                  </span>
                </motion.li>
              );
            return (
              <motion.li
                layout
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-end gap-2"
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm"
                  style={{ background: `${c.color}22`, boxShadow: `inset 0 0 0 2px ${c.color}` }}
                  aria-hidden
                >
                  {c.avatar}
                </span>
                <div className="flex flex-col">
                  <span className="px-1 text-[11px] font-semibold" style={{ color: c.color }}>
                    {c.alias}
                  </span>
                  {l.kind === "typing" ? (
                    <span className="flex gap-1 rounded-2xl rounded-bl-md bg-panel-2 px-3.5 py-3" aria-label="typing">
                      <i className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                      <i className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                      <i className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                    </span>
                  ) : (
                    <span className="rounded-2xl rounded-bl-md bg-panel-2 px-3.5 py-2 text-[15px] leading-snug">{l.text}</span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
