"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NicknameForm, useSession } from "@/components/session";
import { SOLO_MODES, TAGLINE, type SoloVariant } from "@/lib/game/modes";

const noop = () => () => {};

export default function WhosTheBotStart() {
  const router = useRouter();
  const { session, loading, saveName } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [variant, setVariant] = useState<SoloVariant>("classic");
  const [waiting, setWaiting] = useState<number | null>(null);
  // "?solo=1" (the landing page's solo button) goes straight into a solo game once there's a nickname.
  const soloIntent = useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get("solo") === "1",
    () => false,
  );
  const started = useRef(false);

  const go = async (url: string, key: string) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/r/${j.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open a room.");
      setBusy(null);
    }
  };
  const create = () => go("/api/rooms", "create");
  const solo = (v: SoloVariant = variant) => go(`/api/rooms?mode=reverse&variant=${v}`, "solo");
  const quickMatch = () => go("/api/match", "match");

  useEffect(() => {
    if (!soloIntent || !session || renaming || started.current) return;
    started.current = true;
    void solo("classic");
    // solo only reads state setters, so it is safe to leave out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloIntent, session, renaming]);

  // How many people are sitting in the quick-match lobby right now.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/match", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => alive && setWaiting(Number(j.waiting ?? 0)))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const picked = SOLO_MODES.find((m) => m.id === variant)!;

  return (
    <div className="term flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3">
        <Link href="/" className="crt glow text-2xl leading-none text-brand">
          BOTCHED<span className="text-muted">://whos-the-bot</span>
        </Link>
        <Link href="/how-to-play" className="text-xs uppercase tracking-widest text-muted hover:text-text">
          Rules
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 md:grid-cols-[1fr_1.1fr] md:py-12">
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{">"} game 01</p>
          <h1 className="crt glow mt-3 text-7xl leading-[0.85] text-brand md:text-8xl">
            WHO&apos;S
            <br />
            THE BOT?
          </h1>
          <p className="crt mt-4 text-3xl leading-none text-text">{TAGLINE.classic}</p>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
            Everyone gets a secret alias. One of them is an AI. Each round you answer a question privately, the answers drop
            together, then you argue about who wrote like a machine and vote someone out.
          </p>
          <ul className="mt-6 grid max-w-md grid-cols-3 gap-2 text-center text-xs text-muted">
            {["2-8 players", "5-8 minutes", "No sign-up"].map((t) => (
              <li key={t} className="border border-line px-2 py-2">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 hidden border border-line bg-panel p-4 text-sm md:block">
            <p className="text-muted">
              <span className="text-brand">01</span> answer privately <span className="text-line">──</span>{" "}
              <span className="text-brand">02</span> discuss <span className="text-line">──</span> <span className="text-brand">03</span> vote
            </p>
            <p className="mt-2 text-xs text-muted">
              The bot reads the answers already in and tries to sound like the room. Catch it before it outlasts you.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {loading || (soloIntent && session && !renaming && !error) ? (
            <div className="card flex h-56 flex-col items-center justify-center gap-3 text-muted">
              {soloIntent && session ? (
                <>
                  <p className="crt glow cursor text-3xl text-brand">BOOTING 3 AIs</p>
                  <p className="text-sm">{TAGLINE.solo}</p>
                </>
              ) : (
                <p className="crt cursor text-2xl text-brand">LOADING</p>
              )}
            </div>
          ) : !session || renaming ? (
            <div className="card p-6">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted">{">"} identify yourself</p>
              <NicknameForm
                initial={session?.name}
                cta={renaming ? "Save" : soloIntent ? "Play solo vs 3 AIs" : "Continue"}
                onSubmit={async (n) => {
                  await saveName(n);
                  setRenaming(false);
                }}
              />
            </div>
          ) : (
            <>
              <div className="card flex flex-col gap-4 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-muted">{">"} multiplayer</p>
                  <p className="text-xs text-muted">
                    as <b className="text-text">{session.name}</b>{" "}
                    <button className="text-brand underline-offset-2 hover:underline" onClick={() => setRenaming(true)}>
                      change
                    </button>
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn btn-brand py-4" onClick={create} disabled={busy !== null}>
                    {busy === "create" ? "Opening…" : "Room for friends"}
                  </button>
                  <button className="btn btn-ghost flex-col gap-0 py-3" onClick={quickMatch} disabled={busy !== null}>
                    <span>{busy === "match" ? "Matching…" : "Quick match"}</span>
                    <span className="text-[10px] normal-case tracking-normal text-muted">
                      {waiting ? `${waiting} waiting now` : "random players"}
                    </span>
                  </button>
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim().length >= 4) router.push(`/r/${code.trim().toUpperCase()}`);
                  }}
                >
                  <input
                    className="input crt text-2xl uppercase tracking-[0.3em]"
                    placeholder="ROOM CODE"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ""))}
                    aria-label="Room code"
                  />
                  <button className="btn btn-ghost" disabled={code.trim().length < 4}>
                    Join
                  </button>
                </form>
              </div>

              <div id="solo" className="card flex flex-col gap-4 p-5 md:p-6">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted">{">"} solo · who&apos;s the human</p>
                  <p className="crt glow mt-2 text-3xl leading-none text-brand">{TAGLINE.solo}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Solo mode">
                  {SOLO_MODES.map((m) => (
                    <button
                      key={m.id}
                      role="radio"
                      aria-checked={variant === m.id}
                      onClick={() => setVariant(m.id)}
                      className={`truncate rounded-sm border px-1 py-2 text-[11px] uppercase transition ${
                        variant === m.id ? "border-brand bg-brand/15 text-brand" : "border-line text-muted hover:border-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="min-h-10 text-sm text-muted">{picked.blurb}</p>
                <button className="btn btn-brand py-3.5" onClick={() => solo()} disabled={busy !== null}>
                  {busy === "solo" ? "Booting AIs…" : picked.id === "interrogation" ? "Face the detective" : `Play ${picked.label.toLowerCase()}`}
                </button>
              </div>
              {error && <p className="text-sm text-hot">{error}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
