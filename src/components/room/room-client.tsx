"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomView } from "@/lib/game/engine";
import {
  connectChat,
  GAME_EVENT,
  loadHistory,
  onMessage,
  onStatus,
  sendGroupText,
  sendTyping,
  TYPING,
  type IncomingMessage,
} from "@/lib/nexconn-client";
import { NicknameForm, useSession } from "@/components/session";
import { Lobby } from "@/components/room/lobby";
import { ChatPanel } from "@/components/room/chat";
import { PlayersPanel, PhaseBar } from "@/components/room/hud";
import { VoteSheet, RevealCard, VerdictWait } from "@/components/room/vote";
import { handle } from "@/components/sigil";
import { Results } from "@/components/room/results";

import { GM_ID } from "@/lib/constants";

async function post(code: string, action: string, body: object = {}) {
  const res = await fetch(`/api/rooms/${code}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json as RoomView;
}

export function RoomClient() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const { session, appKey, loading, saveName } = useSession();
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [chatStatus, setChatStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  // Server clock minus ours, so every player's countdown agrees.
  const [offset, setOffset] = useState(0);
  const versionRef = useRef(0);
  // Who has the lobby open right now (only sent by the lobby poll).
  const [online, setOnline] = useState<string[] | null>(null);

  const apply = useCallback((v: RoomView & { online?: string[] | null }) => {
    setOffset(v.serverNow - Date.now());
    if (v.online !== undefined) setOnline(v.online);
    if (v.version >= versionRef.current) {
      versionRef.current = v.version;
      setView(v);
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    if (res.status === 404) return setNotFound(true);
    if (res.ok) apply(await res.json());
  }, [code, apply]);

  // Visitors without a nickname still get to see what kind of room this is (e.g. a shared result).
  useEffect(() => {
    if (loading || session) return;
    let alive = true;
    fetch(`/api/rooms/${code}`, { cache: "no-store" }).then(async (res) => {
      if (!alive) return;
      if (res.status === 404) setNotFound(true);
      else if (res.ok) apply(await res.json());
    });
    return () => {
      alive = false;
    };
  }, [loading, session, code, apply]);

  // Join the room once we have an identity.
  useEffect(() => {
    if (!session) return;
    post(code, "join")
      .then(apply)
      .catch((e: Error) => {
        if (/not found/i.test(e.message)) setNotFound(true);
        else refresh();
      });
  }, [session, code, apply, refresh]);

  const isHost = view?.hostId === session?.uid;
  const phase = view?.phase;

  // Real-time: connect to Nexconn, load history, listen for chat, typing and game events.
  useEffect(() => {
    if (!session || !appKey || !view?.channelId) return;
    const channelId = view.channelId;
    let cancelled = false;
    const offStatus = onStatus(setChatStatus);
    const offMsg = onMessage((m) => {
      if (m.channelId !== channelId) return;
      if (m.type === TYPING) {
        setTyping((t) => ({ ...t, [m.from]: Date.now() + 4000 }));
        return;
      }
      if (m.type === GAME_EVENT) {
        refresh();
        return;
      }
      setTyping((t) => ({ ...t, [m.from]: 0 }));
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].sort((a, b) => a.at - b.at)));
    });
    connectChat(appKey, session.token, session.uid)
      .then(() => loadHistory(channelId))
      .then((history) => {
        if (cancelled) return;
        setChatStatus("connected");
        setMessages((list) => {
          const ids = new Set(list.map((x) => x.id));
          return [...history.filter((h) => h.type !== GAME_EVENT && h.type !== TYPING && !ids.has(h.id)), ...list].sort(
            (a, b) => a.at - b.at,
          );
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      offStatus();
      offMsg();
    };
  }, [session, appKey, view?.channelId, refresh]);

  // Answers are posted by the server on each player's behalf; pull history once they drop so nothing is missed.
  const round = view?.round;
  useEffect(() => {
    if (!session || !view?.channelId || phase !== "chat") return;
    const channelId = view.channelId;
    const t = setTimeout(() => {
      loadHistory(channelId)
        .then((history) =>
          setMessages((list) => {
            const ids = new Set(list.map((x) => x.id));
            const fresh = history.filter((h) => h.type !== GAME_EVENT && h.type !== TYPING && !ids.has(h.id));
            return fresh.length ? [...list, ...fresh].sort((a, b) => a.at - b.at) : list;
          }),
        )
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [phase, round, session, view?.channelId]);

  // Timers: the host drives the clock; everyone else is a slower backup.

  useEffect(() => {
    if (!session || !phase || phase === "lobby" || phase === "over") return;
    const every = isHost ? 1200 : 4000;
    const id = setInterval(() => post(code, "tick").then(apply).catch(() => {}), every);
    return () => clearInterval(id);
  }, [session, phase, isHost, code, apply]);

  // A short buzz on phones when voting opens, so nobody misses it.
  useEffect(() => {
    if (phase === "vote" && "vibrate" in navigator) navigator.vibrate?.(80);
  }, [phase]);

  // Closing the tab in the lobby frees the seat (a reload simply rejoins).
  useEffect(() => {
    if (phase !== "lobby" || !session) return;
    const bye = () => navigator.sendBeacon(`/api/rooms/${code}/leave`);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [phase, session, code]);

  // Safety net in case a real-time event is missed.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(refresh, phase === "lobby" ? 3000 : 5000);
    return () => clearInterval(id);
  }, [session, phase, refresh]);

  const startGame = useCallback(() => post(code, "start").then(apply), [code, apply]);

  const send = useCallback(
    async (text: string) => {
      if (!view) return;
      const sent = await sendGroupText(view.channelId, text);
      setMessages((list) => [...list, sent].sort((a, b) => a.at - b.at));
      post(code, "message", { id: sent.id, text }).then(apply).catch(() => {});
    },
    [view, code, apply],
  );

  const players = useMemo(() => new Map((view?.players ?? []).map((p) => [p.id, p])), [view?.players]);
  const gameMessages = useMemo(
    // The lobby has no chat, so every text message in this room's channel belongs to the game.
    // (No timestamp filter: Nexconn's clock and ours can differ by a few seconds.)
    () => (view?.startedAt ? messages.filter((m) => m.type === "RC:TxtMsg") : []),
    [messages, view?.startedAt],
  );

  if (notFound) {
    return (
      <Centered>
        <h1 className="font-display text-3xl font-bold">Room {code} doesn&apos;t exist</h1>
        <p className="text-muted">It may have expired. Start a new one.</p>
        <Link href="/play/whos-the-bot" className="btn btn-brand">
          New game
        </Link>
      </Centered>
    );
  }

  if (loading) return <Centered><Spinner /></Centered>;

  const outsider = view && !view.you && view.phase !== "lobby";
  if (outsider && view.phase === "over") return <SharedResult view={view} />;
  if (outsider) {
    return (
      <Centered>
        <h1 className="font-display text-3xl font-bold">This game already started</h1>
        <p className="text-muted">Start your own room and send the link to your friends.</p>
        <Link href="/play/whos-the-bot" className="btn btn-brand">
          New game
        </Link>
      </Centered>
    );
  }

  if (!session) {
    return (
      <Centered>
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-brand">Room {code}</p>
        <h1 className="font-display text-4xl font-extrabold">You&apos;re invited to Who&apos;s the Bot</h1>
        <p className="max-w-sm text-muted">One player in this chat is secretly an AI. Pick a nickname to join.</p>
        <div className="card w-full max-w-sm p-5 text-left">
          <NicknameForm cta="Join the game" onSubmit={saveName} />
        </div>
      </Centered>
    );
  }

  if (!view) return <Centered><Spinner /></Centered>;

  const me = view.you;

  const inGame = view.phase !== "lobby" && view.phase !== "over";
  const interrogation = view.variant === "interrogation";

  return (
    <div className={`term flex flex-col ${inGame ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line/80 bg-ink/70 px-4 py-2.5">
        <Link href="/" className="crt glow text-2xl leading-none text-brand">
          BOTCHED<span className="text-muted">://{view.mode === "reverse" ? "whos-the-human" : "whos-the-bot"}</span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={`h-2 w-2 ${chatStatus === "connected" ? "bg-brand shadow-[0_0_8px] shadow-brand" : "animate-pulse bg-warn"}`} />
          <span className="hidden sm:inline">{chatStatus === "connected" ? "LIVE" : "CONNECTING"} ·</span> ROOM{" "}
          <span className="text-text">{view.code}</span>
        </div>
      </header>

      {error && <p className="shrink-0 bg-hot/15 px-4 py-2 text-center text-sm text-hot">{error}</p>}

      {view.phase === "lobby" ? (
        <Lobby view={view} isHost={isHost} meId={session.uid} online={online} onStart={startGame} />
      ) : view.phase === "over" ? (
        <Results view={view} messages={gameMessages} players={players} gmId={GM_ID} />
      ) : (
        <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 p-2 md:grid-cols-[1fr_270px] md:gap-4 md:p-4">
          <section className="card relative flex min-h-0 flex-col overflow-hidden">
            <PhaseBar view={view} offset={offset} />
            <ChatPanel
              view={view}
              messages={gameMessages}
              players={players}
              gmId={GM_ID}
              meId={session.uid}
              typing={typing}
              onSend={send}
              onAnswer={(text) => post(code, "answer", { text }).then(apply)}
              onTyping={() => sendTyping(view.channelId)}
            />
            {view.phase === "vote" && interrogation && <VerdictWait />}
            {view.phase === "vote" && !interrogation && me?.alive && (
              <VoteSheet view={view} meId={session.uid} onVote={(targetId) => post(code, "vote", { targetId }).then(apply)} />
            )}
            {view.phase === "reveal" && <RevealCard view={view} />}
          </section>
          <PlayersPanel view={view} meId={session.uid} />
        </main>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="term flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">{children}</main>;
}

function Spinner() {
  return (
    <p className="crt glow cursor text-3xl text-brand" aria-label="Loading">
      CONNECTING
    </p>
  );
}

/** What someone sees when they open a link to a finished game they weren't in. */
function SharedResult({ view }: { view: RoomView }) {
  const bot = view.players.find((p) => p.isBot);
  const humans = view.players.filter((p) => !p.isBot).length;
  const won = view.winner === "humans";
  return (
    <Centered>
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-muted">Room {view.code} · game over</p>
      <h1 className={`crt glow text-6xl leading-none md:text-7xl ${won ? "text-brand" : "text-hot"}`}>
        {view.variant === "interrogation"
          ? won
            ? "A human fooled an AI detective."
            : "An AI detective caught a human."
          : view.mode === "reverse"
          ? won
            ? `A human fooled ${view.players.filter((p) => p.isBot).length} AIs.`
            : `${view.players.filter((p) => p.isBot).length} AIs found the human.`
          : won
            ? `${humans} humans caught the bot.`
            : `The bot fooled ${humans} humans.`}
      </h1>
      {bot && view.mode !== "reverse" && (
        <p className="text-lg text-muted">
          It was hiding as{" "}
          <b style={{ color: bot.color }}>{handle(bot.alias)}</b>
          {won ? ` and got caught in round ${view.round}.` : ` and lasted all ${view.round} rounds.`}
        </p>
      )}
      <p className="text-muted">Think you&apos;d spot it? Start a room and send the link to your friends.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/play/whos-the-bot" className="btn btn-brand px-7 py-4 text-lg">
          Play Who&apos;s the Bot
        </Link>
        <Link href="/how-to-play" className="btn btn-ghost px-6 py-4 text-lg">
          How it works
        </Link>
      </div>
    </Centered>
  );
}
