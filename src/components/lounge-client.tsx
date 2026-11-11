"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NicknameForm, useSession } from "./session";
import {
  connectChat,
  enterOpenChannel,
  exitOpenChannel,
  onMessage,
  sendOpenText,
  type IncomingMessage,
} from "@/lib/nexconn-client";
import { GM_ID } from "@/lib/constants";

const COLORS = ["#2dd4bf", "#fb923c", "#a78bfa", "#a3e635", "#f472b6", "#38bdf8", "#facc15", "#f87171"];
const colorFor = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function LoungeClient() {
  const router = useRouter();
  const { session, appKey, loading, saveName } = useSession();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [hosting, setHosting] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session || !appKey) return;
    let cancelled = false;
    let entered: string | null = null;
    const off = onMessage((m) => {
      if (m.channelId !== entered) return;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.at - b.at).slice(-150)));
    });
    (async () => {
      setStatus("connecting");
      try {
        const { channelId: id } = await (await fetch("/api/lounge", { cache: "no-store" })).json();
        await connectChat(appKey, session.token, session.uid);
        if (cancelled) return;
        entered = id;
        await enterOpenChannel(id, 40);
        if (cancelled) return;
        setChannelId(id);
        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      off();
      if (entered) exitOpenChannel(entered);
    };
  }, [session, appKey]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !channelId || !session) return;
    setText("");
    setError("");
    try {
      const sent = await sendOpenText(channelId, t.slice(0, 300), { id: session.uid, name: session.name });
      setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, { ...sent, name: session.name }]));
    } catch {
      setText(t);
      setError("Message didn't send. Check your connection.");
    }
  };

  const hostAndPost = async () => {
    setHosting(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      await fetch("/api/lounge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: j.code }),
      });
      router.push(`/r/${j.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setHosting(false);
    }
  };

  if (loading) return <div className="card h-[70dvh] animate-pulse" />;
  if (!session) {
    return (
      <div className="card mx-auto w-full max-w-md p-6">
        <h2 className="mb-1 font-display text-2xl font-bold">Join the lounge</h2>
        <p className="mb-4 text-sm text-muted">Chat with other players and jump into open games.</p>
        <NicknameForm cta="Enter the lounge" onSubmit={saveName} />
      </div>
    );
  }

  const people = new Set(messages.filter((m) => m.from !== GM_ID).map((m) => m.from)).size;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="card flex h-[70dvh] min-h-[420px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${status === "ready" ? "bg-brand" : status === "error" ? "bg-hot" : "animate-pulse bg-warn"}`}
            />
            <span className="text-sm font-semibold">
              {status === "ready" ? "Lounge" : status === "error" ? "Couldn't connect" : "Connecting…"}
            </span>
          </div>
          <span className="text-xs text-muted">{people} recently active</span>
        </div>
        <div ref={scroller} className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {status === "ready" && messages.length === 0 && (
            <p className="mt-10 text-center text-muted">It&apos;s quiet in here. Say hi, or host a game and it will show up for everyone.</p>
          )}
          <ul className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const code = typeof m.extra?.code === "string" ? m.extra.code : null;
                if (m.from === GM_ID) {
                  return (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-start gap-3 rounded-2xl border border-brand/30 bg-brand/10 p-4 sm:flex-row sm:items-center"
                    >
                      <span className="text-2xl" aria-hidden>
                        🎮
                      </span>
                      <p className="flex-1 text-sm">{m.text}</p>
                      {code && (
                        <Link href={`/r/${code}`} className="btn btn-brand px-4 py-2 text-sm">
                          Join {code}
                        </Link>
                      )}
                    </motion.li>
                  );
                }
                const mine = m.from === session.uid;
                const name = mine ? session.name : (m.name ?? "Player");
                return (
                  <motion.li
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                  >
                    <span className="mb-0.5 px-1 text-[11px]">
                      <b style={{ color: colorFor(m.from) }}>{name}</b> <span className="text-muted">{time(m.at)}</span>
                    </span>
                    <span
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                        mine ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md bg-panel-2"
                      }`}
                    >
                      {m.text}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-line/60 p-3">
          <input
            className="input"
            placeholder={status === "ready" ? `Message as ${session.name}…` : "Connecting…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            disabled={status !== "ready"}
            aria-label="Lounge message"
          />
          <button className="btn btn-brand" disabled={status !== "ready" || !text.trim()} aria-label="Send">
            Send
          </button>
        </form>
        {error && <p className="px-4 pb-3 text-sm text-hot">{error}</p>}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="card p-5">
          <h2 className="font-display text-xl font-bold">Need players?</h2>
          <p className="mt-1 text-sm text-muted">Open a room and we&apos;ll post it here so anyone in the lounge can join.</p>
          <button className="btn btn-brand mt-4 w-full" onClick={hostAndPost} disabled={hosting || status !== "ready"}>
            {hosting ? "Opening…" : "Host & post a game"}
          </button>
        </div>
        <div className="card p-5 text-sm text-muted">
          <h2 className="mb-2 font-display text-lg font-bold text-text">Lounge rules</h2>
          <ul className="space-y-1.5">
            <li>Be nice. It&apos;s a party.</li>
            <li>No spoilers about which alias was the bot.</li>
            <li>Messages here are public to everyone in the lounge.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
