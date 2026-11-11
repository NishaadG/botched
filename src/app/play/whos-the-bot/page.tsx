"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Nav } from "@/components/nav";
import { NicknameForm, useSession } from "@/components/session";

export default function WhosTheBotStart() {
  const router = useRouter();
  const { session, loading, saveName } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/r/${j.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-grid">
      <Nav />
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-10 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand">Game 01</p>
          <h1 className="mt-3 font-display text-5xl font-black leading-[0.95] md:text-6xl">
            Who&apos;s
            <br />
            the Bot?
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Everyone gets a secret alias. One of the aliases is an AI that types, hesitates and jokes like a person. Chat,
            suspect, vote. Catch it before it outlasts you.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-sm text-muted">
            <li className="rounded-full border border-line px-3 py-1">2 to 8 players</li>
            <li className="rounded-full border border-line px-3 py-1">5 to 8 minutes</li>
            <li className="rounded-full border border-line px-3 py-1">No sign-up</li>
          </ul>
        </div>

        <div className="card p-6 md:p-8">
          {loading ? (
            <div className="h-48 animate-pulse rounded-2xl bg-panel-2" />
          ) : !session || renaming ? (
            <NicknameForm
              initial={session?.name}
              cta={renaming ? "Save" : "Continue"}
              onSubmit={async (n) => {
                await saveName(n);
                setRenaming(false);
              }}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-muted">
                Playing as <b className="text-text">{session.name}</b>{" "}
                <button className="text-sm text-cool underline-offset-2 hover:underline" onClick={() => setRenaming(true)}>
                  change
                </button>
              </p>
              <button className="btn btn-brand py-4 text-lg" onClick={create} disabled={busy}>
                {busy ? "Opening a room…" : "Create a room"}
              </button>
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
                <span className="h-px flex-1 bg-line" /> or join one <span className="h-px flex-1 bg-line" />
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim().length >= 4) router.push(`/r/${code.trim().toUpperCase()}`);
                }}
              >
                <input
                  className="input font-mono text-lg uppercase tracking-[0.3em]"
                  placeholder="CODE"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ""))}
                  aria-label="Room code"
                />
                <button className="btn btn-ghost" disabled={code.trim().length < 4}>
                  Join
                </button>
              </form>
              {error && <p className="text-sm text-hot">{error}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
