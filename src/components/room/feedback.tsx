"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FACES = [
  { v: 1, label: "Boring" },
  { v: 2, label: "Meh" },
  { v: 3, label: "Fun" },
  { v: 4, label: "Really fun" },
  { v: 5, label: "Loved it" },
];

/** Quick post-game rating. Comments may be shown on the public stats page. */
export function FeedbackCard({ code }: { code: string }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError("");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, rating, text }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok || res.status === 409) setState("done");
    else {
      setError(j.error ?? "Could not send. Try again.");
      setState("idle");
    }
  };

  return (
    <div className="card p-5">
      <AnimatePresence mode="wait" initial={false}>
        {state === "done" ? (
          <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center font-semibold">
            Thanks. That helps a lot.
          </motion.p>
        ) : (
          <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-muted">How was that game?</p>
            <div className="flex justify-between gap-1" role="radiogroup" aria-label="Rating">
              {FACES.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  role="radio"
                  aria-checked={rating === f.v}
                  aria-label={f.label}
                  title={f.label}
                  onClick={() => setRating(f.v)}
                  className={`flex h-14 flex-1 flex-col items-center justify-center rounded-xl border transition ${
                    rating >= f.v ? "border-brand bg-brand/15 text-brand" : "border-line bg-ink text-muted hover:bg-white/5"
                  }`}
                >
                  <span className="text-lg font-bold leading-none">{f.v}</span>
                  <span className="mt-1 text-[10px] leading-none">{f.label}</span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <>
                <input
                  className="input"
                  placeholder="Anything to add? (optional)"
                  maxLength={280}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Comment"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">Comments may appear on our public stats page with your nickname.</p>
                  <button className="btn btn-brand shrink-0 px-5 py-2 text-sm" disabled={state === "busy"}>
                    {state === "busy" ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-sm text-hot">{error}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
