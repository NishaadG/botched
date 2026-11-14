"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { RoomView } from "@/lib/game/engine";
import { soloMode, TAGLINE } from "@/lib/game/modes";

/** Quick match starts itself this long after the third person arrives (at once when full). */
const AUTO_START_MS = 15_000;

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
  const isOnline = (id: string) => id === meId || !online || online.includes(id);
  const present = humans.filter((p) => isOnline(p.id));
  const solo = view.mode === "reverse";
  const mode = solo ? soloMode(view.variant) : null;
  const interrogation = mode?.id === "interrogation";
  const canStart = present.length >= (solo ? 1 : 2);
  // If the host closed their tab, anyone still here can start.
  const hostGone = !isOnline(view.hostId);
  const canControl = isHost || hostGone;

  // Quick match: a shared countdown once 3 real people are in.
  const ready = view.matchmade && present.length >= 3;
  const full = present.length >= 8;
  const [autoAt, setAutoAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The clock runs for the whole quick-match lobby, so "now" is fresh when the third player lands.
  if (ready && autoAt === null) setAutoAt(now + (full ? 0 : AUTO_START_MS));
  if (!ready && autoAt !== null) setAutoAt(null);
  useEffect(() => {
    if (!view.matchmade) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [view.matchmade]);
  const autoLeft = autoAt === null ? null : Math.max(0, Math.ceil((autoAt - now) / 1000));
  const firing = useRef(false);
  useEffect(() => {
    if (autoLeft !== 0 || !canControl || firing.current) return;
    firing.current = true;
    onStart().catch(() => {
      firing.current = false;
    });
  }, [autoLeft, canControl, onStart]);

  useEffect(() => {
    const url = `${window.location.origin}/r/${view.code}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#030703", light: "#c6f7cc" },
    }).then((data) => {
      setLink(url);
      setQr(data);
    });
  }, [view.code]);

  const invite = "One of us is secretly an AI. Join my Who's the Bot room:";
  const share = async () => {
    if (navigator.share) {
      // The share sheet appends the url itself, so the text leaves it out.
      await navigator.share({ title: "Who's the Bot", text: invite, url: link }).catch(() => {});
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

  const startLabel = busy
    ? "Starting…"
    : solo
      ? interrogation
        ? "Enter the interrogation room"
        : `Start ${mode?.label.toLowerCase()} solo`
      : view.matchmade && !ready
        ? `Waiting for players (${present.length}/3)`
        : !canStart
          ? "Waiting for at least 2 people"
          : hostGone
            ? "Host left. Start anyway"
            : "Start the game";

  const steps = interrogation
    ? [
        "An AI detective questions you for two and a half minutes.",
        "Answer like a machine: literal, tidy, consistent. No feelings, no jokes, no stories.",
        "Then it rules: human or machine. Get filed as a machine to win.",
      ]
    : solo
      ? [
          "Everyone else is an AI. They know exactly one player is human.",
          "Each round: answer the prompt privately, then discuss, then vote.",
          `Write like a language model: calm, tidy, a bit formal. Survive ${mode?.rounds} rounds to win.`,
        ]
      : [
          "Everyone gets a secret alias. One alias is an AI.",
          "Each round: answer the prompt privately. Answers drop together.",
          "Discuss, then vote someone out. Catch the bot to win.",
        ];

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-4 p-3 md:grid-cols-[1.2fr_1fr] md:gap-5 md:p-8">
      <section className="card flex flex-col gap-6 p-5 md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-brand">
            {">"} lobby · {solo ? `who's the human · ${mode?.label}` : view.matchmade ? "quick match" : "who's the bot"}
          </p>
          <h1 className="crt glow mt-3 text-5xl leading-[0.9] text-brand md:text-6xl">
            {solo ? TAGLINE.solo : view.matchmade ? "Finding players" : TAGLINE.classic}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {solo
              ? mode?.blurb
              : view.matchmade
                ? "Real people only. The game starts by itself once 3 are here. Share the code to fill it faster."
                : "Get your friends in. The bot joins when you start."}
          </p>
        </div>

        {!solo && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="border border-line bg-ink px-5 py-3 text-center">
              <p className="text-[11px] uppercase tracking-widest text-muted">Room code</p>
              <p className="crt glow text-5xl leading-none tracking-[0.2em] text-brand">{view.code}</p>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <button className="btn btn-ghost" onClick={share}>
                {copied ? "Link copied" : "Share invite link"}
              </button>
              <a
                className="btn btn-ghost py-2 text-sm"
                href={`https://wa.me/?text=${encodeURIComponent(`${invite} ${link}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send on WhatsApp
              </a>
              {!view.matchmade && (
                <button className="btn btn-ghost py-2 text-sm" onClick={postToLounge} disabled={posted !== ""}>
                  {posted === "done" ? "Posted in the lounge" : posted === "busy" ? "Posting…" : "Find strangers in the lounge"}
                </button>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 text-[11px] uppercase tracking-widest text-muted">
            {solo ? (
              "In the room"
            ) : (
              <>
                Connected ({humans.length}/8)
                {humans.length < 3 && !view.matchmade && " · 3 or more is the most fun"}
              </>
            )}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {humans.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-l-2 border-line bg-panel-2/60 px-3 py-1.5">
                <span className={`h-2 w-2 ${isOnline(p.id) ? "bg-brand shadow-[0_0_8px] shadow-brand" : "bg-muted/40"}`} />
                <span className={isOnline(p.id) ? "text-text" : "text-muted"}>{p.name}</span>
                {p.id === view.hostId && !view.matchmade && <span className="text-xs text-muted">host</span>}
                {p.id === meId && <span className="text-xs text-muted">you</span>}
                {!isOnline(p.id) && <span className="ml-auto text-xs text-muted">away</span>}
              </li>
            ))}
            <li className="border-l-2 border-dashed border-hot/50 px-3 py-1.5 text-muted">
              {solo ? (interrogation ? "+ 1 AI detective" : `+ ${mode?.bots} AIs hunting you`) : "+ 1 hidden bot (joins at start)"}
            </li>
          </ul>
        </div>

        <div className="mt-auto">
          {autoLeft !== null ? (
            <p className="border border-brand/40 bg-brand/10 p-4 text-center text-brand">
              <span className="crt glow text-3xl leading-none">STARTING IN {autoLeft}</span>
            </p>
          ) : canControl ? (
            <button
              className="btn btn-brand w-full text-lg"
              disabled={!canStart || busy || (view.matchmade && !ready)}
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
              {startLabel}
            </button>
          ) : (
            <p className="border border-line bg-ink p-4 text-center text-muted">
              <span className="cursor">{view.matchmade ? `Waiting for players (${present.length}/3)` : "Waiting for the host to start"}</span>
            </p>
          )}
          {view.matchmade && !ready && (
            <p className="mt-3 text-center text-xs text-muted">
              Nobody else around?{" "}
              <a className="text-brand underline-offset-2 hover:underline" href="/play/whos-the-bot?solo=1">
                Play solo while you wait
              </a>
            </p>
          )}
          {error && <p className="mt-2 text-sm text-hot">{error}</p>}
        </div>
      </section>

      <aside className="card flex flex-col gap-4 p-6">
        {solo ? (
          <p className="crt glow text-3xl leading-none text-brand">{interrogation ? "HOW TO PASS" : "HOW TO SURVIVE"}</p>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs uppercase tracking-widest text-muted">Scan to join on a phone</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code to join room ${view.code}`} className="h-52 w-52 rounded-sm" />
            ) : (
              <div className="h-52 w-52 animate-pulse bg-panel-2" />
            )}
          </div>
        )}
        <ol className="space-y-3 text-sm text-muted">
          {steps.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-brand">{String(i + 1).padStart(2, "0")}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        {solo && (
          <p className="mt-auto border border-line bg-ink p-4 text-sm text-muted">
            Want the real thing? <b className="text-text">Who&apos;s the Bot</b> flips it: invite friends and find the one AI among you.
          </p>
        )}
      </aside>
    </main>
  );
}
