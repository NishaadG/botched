"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { RoomView } from "@/lib/game/engine";
import { classicRounds, PACES, soloMode, TAGLINE, TIMER_CHOICES, type TimerKey } from "@/lib/game/modes";

/** Quick match starts itself this long after the third person arrives (at once when full). */
const AUTO_START_MS = 15_000;
/** Solo games opened from a play button start themselves after this long (enough to read the three rules). */
const SOLO_AUTO_MS = 6_000;

type TimerPatch = Partial<Record<TimerKey, number>>;
const TIMER_ROWS: [TimerKey, string][] = [
  ["answerSeconds", "Answer"],
  ["chatSeconds", "Discuss"],
  ["voteSeconds", "Vote"],
];
const secs = (n: number) => (n >= 120 && n % 60 === 0 ? `${n / 60}m` : `${n}s`);

/** How long each phase lasts. The host picks; everyone sees it. */
function TimerSettings({
  view,
  editable,
  onChange,
}: {
  view: RoomView;
  editable: boolean;
  onChange: (patch: TimerPatch) => Promise<unknown>;
}) {
  const t = view.settings;
  const [custom, setCustom] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pace = PACES.find((p) => TIMER_ROWS.every(([k]) => p.timers[k] === t[k]));
  const rounds = classicRounds(Math.max(2, view.players.length));
  const perRound = t.answerSeconds + t.chatSeconds + t.voteSeconds + t.revealSeconds;
  const minutes = Math.max(1, Math.round((rounds * perRound) / 60));

  const set = async (patch: TimerPatch) => {
    setPending(true);
    setError("");
    try {
      await onChange(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the timers.");
    } finally {
      setPending(false);
    }
  };

  const summary = (
    <span>
      {TIMER_ROWS.map(([k, label], i) => (
        <span key={k}>
          {i > 0 && <span className="text-line"> · </span>}
          {label.toLowerCase()} <b className="font-normal text-text">{secs(t[k])}</b>
        </span>
      ))}
      <span className="text-line"> · </span>up to ~{minutes} min
    </span>
  );

  if (!editable) {
    return (
      <div className="border border-line bg-ink px-3 py-2.5 text-xs text-muted">
        <span className="uppercase tracking-widest">Timers{pace ? ` · ${pace.label}` : ""}</span>
        <p className="mt-1">{summary}</p>
      </div>
    );
  }

  return (
    <div className="border border-line bg-ink p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest text-muted">Pace</p>
        <button className="text-[11px] uppercase tracking-widest text-brand hover:underline" onClick={() => setCustom((c) => !c)}>
          {custom ? "Done" : "Custom"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Game pace">
        {PACES.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={pace?.id === p.id}
            disabled={pending}
            onClick={() => set(p.timers)}
            className={`border px-2 py-2 text-xs uppercase tracking-wider transition disabled:opacity-60 ${
              pace?.id === p.id ? "border-brand bg-brand/15 text-brand" : "border-line text-muted hover:border-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {custom && (
        <div className="mt-3 flex flex-col gap-2">
          {TIMER_ROWS.map(([k, label]) => (
            <div key={k} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
              <span className="text-xs text-muted">{label}</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${label} time`}>
                {TIMER_CHOICES[k].map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={t[k] === v}
                    disabled={pending}
                    onClick={() => set({ [k]: v })}
                    className={`min-w-11 border px-1.5 py-1 text-xs transition disabled:opacity-60 ${
                      t[k] === v ? "border-brand bg-brand/15 text-brand" : "border-line text-muted hover:border-muted"
                    }`}
                  >
                    {secs(v)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-xs text-muted">{summary}</p>
      {error && <p className="mt-1 text-xs text-hot">{error}</p>}
    </div>
  );
}

export function Lobby({
  view,
  isHost,
  meId,
  online,
  onStart,
  onConfigure,
  chatReady,
}: {
  view: RoomView;
  isHost: boolean;
  meId: string;
  online: string[] | null;
  onStart: () => Promise<unknown>;
  onConfigure: (patch: TimerPatch) => Promise<unknown>;
  /** Starting before the chat connects would make the first messages fail. */
  chatReady: boolean;
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

  // Solo games opened from a play button ("?start=1") count down and start on their own; "Wait" cancels.
  // The lobby only renders after the room loads in the browser, so reading the URL here is safe.
  const [soloAuto, setSoloAuto] = useState(
    () => solo && isHost && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("start") === "1",
  );
  const [soloAt, setSoloAt] = useState<number | null>(null);
  if (soloAuto && chatReady && soloAt === null) setSoloAt(now + SOLO_AUTO_MS);
  useEffect(() => {
    // Drop the flag from the address bar so a reload or a shared link never auto-starts.
    if (new URLSearchParams(window.location.search).has("start")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const soloLeft = soloAuto && soloAt !== null ? Math.max(0, Math.ceil((soloAt - now) / 1000)) : null;

  useEffect(() => {
    if (!view.matchmade && !soloAuto) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [view.matchmade, soloAuto]);
  const autoLeft = autoAt === null ? null : Math.max(0, Math.ceil((autoAt - now) / 1000));
  const firing = useRef(false);
  useEffect(() => {
    if ((autoLeft !== 0 && soloLeft !== 0) || !canControl || !chatReady || firing.current) return;
    firing.current = true;
    setBusy(true);
    onStart()
      .catch((e) => {
        firing.current = false;
        setSoloAuto(false);
        setError(e instanceof Error ? e.message : "Could not start.");
      })
      .finally(() => setBusy(false));
  }, [autoLeft, soloLeft, canControl, chatReady, onStart]);

  const start = async () => {
    setSoloAuto(false);
    setBusy(true);
    setError("");
    try {
      await onStart();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  };

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
    : !chatReady
      ? "Connecting to chat…"
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

        {!solo && !view.matchmade && <TimerSettings view={view} editable={isHost} onChange={onConfigure} />}

        <div className="mt-auto">
          {autoLeft !== null ? (
            <p className="border border-brand/40 bg-brand/10 p-4 text-center text-brand">
              <span className="crt glow text-3xl leading-none">STARTING IN {autoLeft}</span>
            </p>
          ) : soloLeft !== null && !busy ? (
            <div className="border border-brand/40 bg-brand/10 p-4 text-center text-brand">
              <p className="crt glow text-3xl leading-none" aria-live="polite">
                STARTING IN {soloLeft}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-brand py-2.5" onClick={start}>
                  Start now
                </button>
                <button type="button" className="btn btn-ghost py-2.5" onClick={() => setSoloAuto(false)}>
                  Wait
                </button>
              </div>
            </div>
          ) : canControl ? (
            <button
              className="btn btn-brand w-full text-lg"
              disabled={!canStart || busy || !chatReady || (view.matchmade && !ready)}
              onClick={start}
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
