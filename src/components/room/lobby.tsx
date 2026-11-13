"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { RoomView } from "@/lib/game/engine";

export function Lobby({
  view,
  isHost,
  meId,
  online,
  onStart,
}: {
  view: RoomView;
  isHost: boolean;
  meId: string;
  online: string[] | null;
  onStart: () => Promise<unknown>;
}) {
  const [link, setLink] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState<"" | "busy" | "done">("");
  const humans = view.players;
  const isOnline = (id: string) =>
    id === meId || !online || online.includes(id);
  const present = humans.filter((p) => isOnline(p.id));
  const solo = view.mode === "reverse";
  const canStart = present.length >= (solo ? 1 : 2);
  // If the host closed their tab, anyone still here can start.
  const hostGone = !isOnline(view.hostId);
  const canControl = isHost || hostGone;

  useEffect(() => {
    const url = `${window.location.origin}/r/${view.code}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#0b0a14", light: "#f3f1ff" },
    }).then((data) => {
      setLink(url);
      setQr(data);
    });
  }, [view.code]);

  const invite = "One of us is secretly an AI. Join my Who's the Bot room:";
  const share = async () => {
    if (navigator.share) {
      // The share sheet appends the url itself, so the text leaves it out.
      await navigator
        .share({ title: "Who's the Bot", text: invite, url: link })
        .catch(() => {});
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
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">
            Lobby · {solo ? "Who's the Human (solo)" : "Who's the Bot"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight md:text-5xl">
            {solo ? (
              <>
                You vs three AIs.
                <br />
                <span className="text-muted">
                  They know one player is human. Don&apos;t let it be obvious.
                </span>
              </>
            ) : (
              <>
                Get your friends in.
                <br />
                <span className="text-muted">
                  The bot joins when you start.
                </span>
              </>
            )}
          </h1>
        </div>

        {!solo && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-line bg-ink px-5 py-3 text-center">
              <p className="text-xs text-muted">Room code</p>
              <p className="font-mono text-3xl font-bold tracking-[0.25em]">
                {view.code}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <button className="btn btn-ghost" onClick={share}>
                {copied ? "Link copied ✓" : "Share invite link"}
              </button>
              <a
                className="btn btn-ghost py-2 text-sm"
                href={`https://wa.me/?text=${encodeURIComponent(`${invite} ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send on WhatsApp
              </a>
              <button
                className="btn btn-ghost py-2 text-sm"
                onClick={postToLounge}
                disabled={posted !== ""}
              >
                {posted === "done"
                  ? "Posted in the lounge ✓"
                  : posted === "busy"
                    ? "Posting…"
                    : "Find strangers in the lounge"}
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 text-sm text-muted">
            {solo ? (
              "In the chat"
            ) : (
              <>
                In the room ({humans.length}/8){" "}
                {humans.length < 3 && "· 3 or more humans is the most fun"}
              </>
            )}
          </p>
          <ul className="flex flex-wrap gap-2">
            {humans.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1.5 text-sm"
              >
                <span
                  className={`h-2 w-2 rounded-full ${isOnline(p.id) ? "bg-brand" : "bg-muted/40"}`}
                />
                <span className={isOnline(p.id) ? "" : "text-muted"}>
                  {p.name}
                </span>
                {p.id === view.hostId && (
                  <span className="text-xs text-muted">host</span>
                )}
                {!isOnline(p.id) && (
                  <span className="text-xs text-muted">away</span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted">
              {solo ? "+ 3 AIs hunting you" : "+ 1 hidden bot"}
            </li>
          </ul>
        </div>

        <div className="mt-auto">
          {canControl ? (
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
              {busy
                ? "Starting…"
                : solo
                  ? "Start the solo game"
                  : !canStart
                    ? "Waiting for at least 2 people"
                    : hostGone
                      ? "Host left. Start anyway"
                      : "Start the game"}
            </button>
          ) : (
            <p className="rounded-2xl border border-line bg-ink p-4 text-center text-muted">
              Waiting for the host to start
              <span className="animate-pulse">…</span>
            </p>
          )}
          {error && <p className="mt-2 text-sm text-hot">{error}</p>}
        </div>
      </section>

      {solo ? (
        <aside className="card flex flex-col gap-4 p-6">
          <p className="font-display text-2xl font-extrabold">How to survive</p>
          <ol className="space-y-3 text-sm text-muted">
            <li>
              <b className="text-text">1.</b> Everyone else is an AI. They know
              exactly one player is human.
            </li>
            <li>
              <b className="text-text">2.</b> Answer each prompt the way a
              language model would: calm, tidy, a bit formal.
            </li>
            <li>
              <b className="text-text">3.</b> The AIs vote out whoever seems
              most human. Survive 3 rounds to win.
            </li>
          </ol>
          <p className="mt-auto rounded-2xl border border-line bg-ink p-4 text-sm text-muted">
            Want the real thing? <b className="text-text">Who&apos;s the Bot</b>{" "}
            flips it: invite friends and find the one AI among you.
          </p>
        </aside>
      ) : (
        <aside className="card flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-sm text-muted">Scan to join on a phone</p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`QR code to join room ${view.code}`}
              className="h-52 w-52 rounded-2xl"
            />
          ) : (
            <div className="h-52 w-52 animate-pulse rounded-2xl bg-panel-2" />
          )}
          <ol className="mt-2 space-y-2 text-left text-sm text-muted">
            <li>
              <b className="text-text">1.</b> Everyone gets a secret animal
              alias.
            </li>
            <li>
              <b className="text-text">2.</b> Chat about the prompt. One player
              is an AI pretending to be human.
            </li>
            <li>
              <b className="text-text">3.</b> Vote someone out each round. Catch
              the bot to win.
            </li>
          </ol>
        </aside>
      )}
    </main>
  );
}
