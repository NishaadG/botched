"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sigil, handle } from "@/components/sigil";

type Line =
  | { kind: "gm"; text: string; round?: boolean }
  | { kind: "answer"; who: number; text: string }
  | { kind: "msg"; who: number; text: string }
  | { kind: "typing"; who: number }
  | { kind: "reveal"; who: number };

const CAST = [
  { alias: "Mango Fox", color: "#ffa04d" },
  { alias: "Sky Whale", color: "#5ce8ff" },
  { alias: "Violet Owl", color: "#c39bff" },
  { alias: "Lime Frog", color: "#c8ff4d" },
];
const BOT = 3;

const SCRIPT: Line[] = [
  { kind: "gm", text: "What did you do last Sunday? Be honest.", round: true },
  { kind: "answer", who: 0, text: "slept till 2 then felt guilty about it till 6" },
  { kind: "answer", who: 2, text: "walked to the chai place and called it a run" },
  { kind: "answer", who: 3, text: "rotted in bed lol. sunday is for rotting" },
  { kind: "answer", who: 1, text: "3 episodes of a show i cant even name now" },
  { kind: "gm", text: "Answers are in. 60 seconds. Who wrote like a machine?" },
  { kind: "msg", who: 1, text: "frog's answer is just fox's answer but tidier" },
  { kind: "typing", who: 3 },
  { kind: "msg", who: 3, text: "bro we all rot on sundays what" },
  { kind: "msg", who: 2, text: "nobody says rotted AND rotting in one line" },
  { kind: "gm", text: "Chat locked. Vote: who is the bot?" },
  { kind: "reveal", who: BOT },
];

// Open mid-round so the preview never starts as an empty box.
const FIRST = 3;

export function DemoChat() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? SCRIPT.length : FIRST);

  useEffect(() => {
    if (reduce) return;
    const done = step >= SCRIPT.length;
    const next = SCRIPT[step];
    const delay = done ? 4500 : next?.kind === "typing" ? 1100 : next?.kind === "answer" ? 650 : 1600;
    const id = setTimeout(() => setStep((s) => (s >= SCRIPT.length ? FIRST : s + 1)), delay);
    return () => clearTimeout(id);
  }, [step, reduce]);

  // Typing indicators only show while they are the latest line.
  const visible = SCRIPT.slice(0, step).filter((l, i, arr) => l.kind !== "typing" || i === arr.length - 1);
  const voting = step >= SCRIPT.length - 1;
  const phase = step <= 5 ? "answer" : voting ? "vote" : "discuss";

  return (
    <div className="card relative overflow-hidden p-0">
      <div className="scanbar" />
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[11px] uppercase tracking-widest text-muted">
        <span>
          <span className="text-brand">wtb_kxqp</span> · <span className="hidden sm:inline">round </span>1/3
        </span>
        <span className="flex shrink-0 gap-1">
          {(["answer", "discuss", "vote"] as const).map((p) => (
            <span key={p} className={`px-1.5 py-0.5 ${p === phase ? "bg-brand text-brand-ink" : "border border-line"}`}>
              {p}
            </span>
          ))}
        </span>
      </div>
      <ul
        className="flex h-[360px] flex-col justify-end gap-1 overflow-hidden px-3 py-3 font-mono text-[13px] md:h-[430px] md:px-4"
        aria-label="Example game chat"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((l) => {
            const key = SCRIPT.indexOf(l);
            const anim = {
              layout: true,
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0 },
              transition: { duration: 0.18 },
            } as const;
            if (l.kind === "gm")
              return (
                <motion.li
                  key={key}
                  {...anim}
                  className={`${l.round ? "border-y border-brand/25 bg-brand/[0.06] py-2" : "my-1"} px-1 leading-relaxed text-brand`}
                >
                  <span className="mr-2 text-brand/60">{">>"}</span>
                  {l.round ? (
                    <>
                      <span className="crt glow mr-2 text-lg leading-none">ROUND 1</span>
                      <span className="text-text">{l.text}</span>
                    </>
                  ) : (
                    <span className="uppercase tracking-wide">{l.text}</span>
                  )}
                </motion.li>
              );
            const c = CAST[l.who];
            if (l.kind === "reveal")
              return (
                <motion.li
                  key={key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center gap-3 border border-hot/60 bg-hot/10 px-3 py-3"
                >
                  <Sigil seed={c.alias} color={c.color} size={40} />
                  <span className="leading-tight">
                    <span style={{ color: c.color }}>{handle(c.alias)}</span> <span className="text-muted">voted out, 3 votes</span>
                    <br />
                    <span className="crt glow text-3xl leading-none text-hot">IT WAS THE BOT.</span>
                  </span>
                </motion.li>
              );
            if (l.kind === "answer")
              return (
                <motion.li
                  key={key}
                  {...anim}
                  className="flex items-start gap-2 border-l-2 bg-panel-2/70 px-3 py-1.5"
                  style={{ borderColor: c.color }}
                >
                  <Sigil seed={c.alias} color={c.color} size={20} className="mt-0.5" />
                  <p className="min-w-0">
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: c.color }}>
                      {handle(c.alias)} answered
                    </span>
                    <br />
                    <span className="text-text">{l.text}</span>
                  </p>
                </motion.li>
              );
            return (
              <motion.li key={key} {...anim} className="flex items-start gap-2 px-1 py-0.5 leading-snug">
                <Sigil seed={c.alias} color={c.color} size={18} className="mt-0.5" />
                <p className="min-w-0">
                  <span style={{ color: c.color }}>{handle(c.alias)}</span>
                  <span className="mx-1.5 text-muted">{">"}</span>
                  {l.kind === "typing" ? (
                    <span className="inline-flex gap-0.5 align-middle" aria-label="typing">
                      <i className="typing-dot h-1 w-1 bg-muted" />
                      <i className="typing-dot h-1 w-1 bg-muted" />
                      <i className="typing-dot h-1 w-1 bg-muted" />
                    </span>
                  ) : (
                    <span className="text-text">{l.text}</span>
                  )}
                </p>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="flex items-center gap-2 border-t border-line/80 px-4 py-2.5 text-[13px] text-muted">
        <span className={`crt text-xl leading-none ${voting ? "" : "glow text-brand"}`}>{">"}</span>
        <span className={voting ? "" : "cursor"}>{voting ? "chat locked" : ""}</span>
      </div>
    </div>
  );
}
