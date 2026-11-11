"use client";

import { useCallback, useEffect, useState } from "react";

export interface ClientSession {
  uid: string;
  name: string;
  token: string;
}

export function useSession() {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [appKey, setAppKey] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSession(j.session);
        setAppKey(j.appKey ?? "");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const saveName = useCallback(async (name: string) => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "Could not save your nickname.");
    setSession(j.session);
    setAppKey(j.appKey ?? "");
    return j.session as ClientSession;
  }, []);

  return { session, appKey, loading, saveName };
}

export function NicknameForm({
  initial,
  cta,
  onSubmit,
}: {
  initial?: string;
  cta: string;
  onSubmit: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSubmit(name);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-sm text-muted" htmlFor="nick">
        Your nickname (your friends see it in the lobby)
      </label>
      <input
        id="nick"
        className="input text-lg"
        placeholder="e.g. Rohan"
        maxLength={20}
        autoComplete="nickname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      {error && <p className="text-sm text-hot">{error}</p>}
      <button className="btn btn-brand text-lg" disabled={busy || name.trim().length < 2}>
        {busy ? "One sec…" : cta}
      </button>
    </form>
  );
}
