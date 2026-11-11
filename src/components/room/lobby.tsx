"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { RoomView } from "@/lib/game/engine";

export function Lobby({ view, isHost, onStart }: { view: RoomView; isHost: boolean; onStart: () => Promise<unknown> }) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState<"" | "busy" | "done">("");
  const humans = view.players;
  const canStart = humans.length >= 2;

  useEffect(() => {
    const url = `${window.location.origin}/r/${view.code}`;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#0b0a14", light: "#f3f1ff" } }).then((data) => {
      setLink(url);
      setQr(data);
    });
  }, [view.code]);

  const share = async () => {
    const text = `One of us is secretly an AI. Join my Who's the Bot room: ${link}`;
    if (navigator.share) {
      await navigator.share({ title: "Who's the Bot", text, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const postToLounge = async () => {
    setPosted("busy");
    const res = await fetch("/api/lounge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: view.code }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 429) {
      setError(j.error ?? "Could not post to the lounge.");
      setPosted("");
      return;
    }
    setPosted("done");
  };

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-5 p-4 md:grid-cols-[1.2fr_1fr] md:p-8">
      <section className="card flex flex-col gap-6 p-6 md:p-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Lobby · Who&apos;s the Bot</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight md:text-5xl">
            Get your friends in.
            <br />
            <span className="text-muted">The bot joins when you start.</span>
          </h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-line bg-ink px-5 py-3 text-center">
            <p className="text-xs text-muted">Room code</p>
            <p className="font-mono text-3xl font-bold tracking-[0.25em]">{view.code}</p>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <button className="btn btn-ghost" onClick={share}>
              {copied ? "Link copied ✓" : "Share invite link"}
            </button>
            <button className="btn btn-ghost py-2 text-sm" onClick={postToLounge} disabled={posted !== ""}>
              {posted === "done" ? "Posted in the lounge ✓" : posted === "busy" ? "Posting…" : "Find strangers in the lounge"}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm text-muted">
            In the room ({humans.length}/8) {humans.length < 3 && "· 3 or more humans is the most fun"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {humans.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1.5 text-sm">
                <span className="h-2 w-2 rounded-full bg-brand" />
                {p.name}
                {p.id === view.hostId && <span className="text-xs text-muted">host</span>}
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted">
              + 1 hidden bot
            </li>
          </ul>
        </div>

        <div className="mt-auto">
          {isHost ? (
            <button
              className="btn btn-brand w-full text-lg"
              disabled={!canStart || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onStart();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not start.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Starting…" : canStart ? "Start the game" : "Waiting for at least 2 people"}
            </button>
          ) : (
            <p className="rounded-2xl border border-line bg-ink p-4 text-center text-muted">
              Waiting for the host to start<span className="animate-pulse">…</span>
            </p>
          )}
          {error && <p className="mt-2 text-sm text-hot">{error}</p>}
        </div>
      </section>

      <aside className="card flex flex-col items-center gap-4 p-6 text-center">
        <p className="text-sm text-muted">Scan to join on a phone</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code to join room ${view.code}`} className="h-52 w-52 rounded-2xl" />
        ) : (
          <div className="h-52 w-52 animate-pulse rounded-2xl bg-panel-2" />
        )}
        <ol className="mt-2 space-y-2 text-left text-sm text-muted">
          <li>
            <b className="text-text">1.</b> Everyone gets a secret animal alias.
          </li>
          <li>
            <b className="text-text">2.</b> Chat about the prompt. One player is an AI pretending to be human.
          </li>
          <li>
            <b className="text-text">3.</b> Vote someone out each round. Catch the bot to win.
          </li>
        </ol>
      </aside>
    </main>
  );
}
