import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { chooseVerdict, chooseVote, generateAnswer, generateLine, shouldReply, timing } from "../bot/brain";
import { AI_PERSONAS, DETECTIVE, personaById, PERSONAS } from "../bot/personas";
import { sendGroupEvent, sendGroupText } from "../nexconn-server";
import { kv } from "../store";
import { dayKey, emptyRecord, type PlayerRecord } from "../stats";
import { createGroupChannel } from "../nexconn-server";
import { createRoom } from "./engine";
import { DEMO_TIMERS, FAST_TIMERS, type SoloVariant } from "./modes";
import { addMessage, alive, botById, botCount, castVerdict, castVote, GameError, isInterrogation, submitAnswer } from "./engine";
import type { Effect, Room } from "./types";

import { GM_ID } from "../constants";
export { GM_ID };
const ROOM_TTL = 60 * 60 * 24;
const roomKey = (code: string) => `room:${code}`;

export async function loadRoom(code: string) {
  return kv.get<Room>(roomKey(code.toUpperCase()));
}

export async function saveRoom(room: Room) {
  await kv.set(roomKey(room.code), room, ROOM_TTL);
}

export function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(5);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Creates a room with its Nexconn group channel. Throws if the chat room can't be opened. */
export async function openRoom(
  host: { id: string; name: string },
  opts: { mode: "classic" | "reverse"; variant?: SoloVariant; fast?: boolean | "demo"; test?: boolean; matchmade?: boolean },
) {
  let code = newRoomCode();
  for (let i = 0; i < 5 && (await loadRoom(code)); i++) code = newRoomCode();
  const room = createRoom(code, host, Date.now(), opts.mode, opts.variant);
  // Short timers for automated end-to-end tests: always in development, in production only when explicitly allowed.
  const fastAllowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_FAST_ROOMS === "1";
  if (opts.fast && fastAllowed) {
    const base = opts.fast === "demo" ? DEMO_TIMERS : FAST_TIMERS;
    room.settings = room.variant === "interrogation" ? { ...base, answerSeconds: 0, chatSeconds: 40 } : { ...base };
  }
  if (opts.test) room.test = true;
  if (opts.matchmade) room.matchmade = true;
  const title = `${opts.mode === "reverse" ? "Who's the Human" : "Who's the Bot"} · ${code}`;
  await createGroupChannel(room.channelId, host.id, title, [host.id]);
  await saveRoom(room);
  return room;
}

/** Fresh AI players for a game. Ids look exactly like human ids, so nothing gives them away. */
export function newBots(room: Room) {
  const pool = isInterrogation(room)
    ? [DETECTIVE]
    : [...(room.mode === "reverse" ? AI_PERSONAS : PERSONAS)].sort(() => Math.random() - 0.5);
  return Array.from({ length: botCount(room) }, (_, i) => ({
    id: "p_" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase(),
    personaId: pool[i % pool.length].id,
  }));
}

async function withLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const key = `lock:${code}`;
  for (let i = 0; i < 40; i++) {
    if (await kv.lock(key, 5000)) {
      try {
        return await fn();
      } finally {
        await kv.unlock(key);
      }
    }
    await new Promise((r) => setTimeout(r, 75));
  }
  throw new GameError("The room is busy, try again.");
}

/**
 * Loads the room under a lock, applies `fn`, saves, then performs the side-effects.
 * Chat-visible effects are sent in order; slow bot work runs after the response.
 */
export async function mutate(code: string, fn: (room: Room, now: number) => Effect[] | Promise<Effect[]>) {
  const now = Date.now();
  const { room, effects } = await withLock(code, async () => {
    const room = await loadRoom(code);
    if (!room) throw new GameError("Room not found.");
    const before = JSON.stringify(room);
    const effects = await fn(room, now);
    for (const e of effects) {
      const bot = e.type === "botSay" ? botById(room, e.botId) : undefined;
      if (e.type === "botSay" && bot) {
        const id = `bot_${now}_${Math.random().toString(36).slice(2, 7)}`;
        addMessage(room, { id, from: bot.id, text: e.text, at: now }, now);
        bot.lastSpokeAt = now;
        bot.linesThisRound += 1;
      }
    }
    // Skip the write when nothing changed (most clock ticks), to save database commands.
    if (effects.length || JSON.stringify(room) !== before) await saveRoom(room);
    return { room, effects };
  });
  await perform(room, effects);
  return room;
}

async function perform(room: Room, effects: Effect[]) {
  for (const e of effects) {
    try {
      if (e.type === "gm") await sendGroupText(room.channelId, GM_ID, e.text);
      else if (e.type === "event") await sendGroupEvent(room.channelId, GM_ID, { ...e.event, v: room.version });
      else if (e.type === "botSay") await sendGroupText(room.channelId, e.botId, e.text);
      else if (e.type === "answers") {
        // Each answer goes into the chat as its author, tagged so clients show it as an answer card.
        for (const it of e.items) await sendGroupText(room.channelId, it.from, it.text, { answer: e.round });
      } else if (e.type === "botAnswers") {
        const pending = alive(room).filter((p) => p.isBot && !room.answers?.[p.id]);
        pending.forEach((p, i) => after(() => delay(i * 400).then(() => botAnswer(room.code, p.id))));
      } else if (e.type === "botVerdict") after(() => botVerdict(room.code));
      else if (e.type === "botTyping") await sendGroupEvent(room.channelId, e.botId, { kind: "typing" }, false);
      else if (e.type === "planBot") {
        const ids = e.botId ? [e.botId] : room.bots.map((b) => b.id);
        // Each AI decides on its own, a beat apart, so they don't all pile in at once.
        ids.forEach((id, i) => after(() => delay(i * 700).then(() => planBot(room.code, id, e.trigger))));
      } else if (e.type === "botVote") room.bots.forEach((b) => after(() => botVote(room.code, b.id)));
      else if (e.type === "gameOver") after(() => recordStats(room.code));
    } catch (err) {
      console.error("[runner] effect failed", e.type, err);
    }
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function planBot(code: string, botId: string, trigger: "prompt" | "reply" | "nudge") {
  let snapshot: Room | null = null;
  await mutate(code, (room, now) => {
    if (shouldReply(room, botId, trigger, now)) {
      botById(room, botId)!.thinkingSince = now;
      snapshot = structuredClone(room);
    }
    return [];
  });
  if (!snapshot) return;
  const s = snapshot as Room;
  const line = await generateLine(s, botId, trigger);
  await mutate(code, (room, now) => {
    const bot = botById(room, botId);
    if (!bot) return [];
    bot.thinkingSince = null;
    if (room.phase !== "chat" || room.round !== s.round || bot.plan) return [];
    if (line.thought) bot.thoughts.push({ at: now, round: room.round, text: line.thought });
    if (!line.say) return [];
    const t = timing(line.say, personaById(bot.personaId), trigger, now);
    bot.plan = { text: line.say, typingAt: t.typingAt, dueAt: t.dueAt, typingSent: false, reason: trigger };
    return [];
  });
}

async function botAnswer(code: string, botId: string) {
  const room = await loadRoom(code);
  if (!room || room.phase !== "answer" || room.answers?.[botId]) return;
  const line = await generateAnswer(room, botId);
  await mutate(code, (r, now) => {
    const bot = botById(r, botId);
    if (!bot || r.phase !== "answer" || r.round !== room.round || r.answers?.[botId]) return [];
    if (line.thought) bot.thoughts.push({ at: now, round: r.round, text: `Answer: ${line.thought}` });
    try {
      return submitAnswer(r, botId, line.say, now);
    } catch {
      return [];
    }
  });
}

async function botVerdict(code: string) {
  const room = await loadRoom(code);
  if (!room || room.phase !== "vote" || !isInterrogation(room)) return;
  const { human, thought } = await chooseVerdict(room);
  // A beat of suspense before the ruling.
  await delay(2500);
  await mutate(code, (r, now) => {
    const bot = r.bots[0];
    if (r.phase !== "vote" || !bot) return [];
    if (thought) bot.thoughts.push({ at: now, round: r.round, text: `Verdict: ${thought}` });
    return castVerdict(r, human, now);
  });
}

async function botVote(code: string, botId: string) {
  const room = await loadRoom(code);
  if (!room || room.phase !== "vote" || !botById(room, botId)) return;
  if (!alive(room).some((p) => p.id === botId)) return;
  const { targetId, thought } = await chooseVote(room, botId);
  // Humans take a few seconds to vote, so the bots do too.
  await delay(3000 + Math.random() * 6000);
  await mutate(code, (r, now) => {
    const bot = botById(r, botId);
    if (r.phase !== "vote" || !bot || r.votes[botId]) return [];
    if (thought) bot.thoughts.push({ at: now, round: r.round, text: `Vote: ${thought}` });
    try {
      return castVote(r, botId, targetId, now);
    } catch {
      return [];
    }
  });
}

async function recordStats(code: string) {
  await mutate(code, async (room) => {
    if (room.statsRecorded) return [];
    room.statsRecorded = true;
    if (room.test) return [];
    const humansWon = room.winner === "humans";
    const solo = room.mode === "reverse";
    const final = room.eliminations.at(-1);
    const humans = room.players.filter((x) => !x.isBot);
    const botAlias = solo ? `${room.bots.length} AI${room.bots.length > 1 ? "s" : ""} (solo ${room.variant ?? "classic"})` : room.players.find((x) => x.isBot)?.alias ?? "";
    await kv.incr("stats:games");
    if (solo) await kv.incr(humansWon ? "stats:soloSurvived" : "stats:soloCaught");
    else await kv.incr(humansWon ? "stats:humanWins" : "stats:botWins");
    await kv.incr("stats:messages", room.transcript.length);
    const day = dayKey();
    await kv.incr(`day:games:${day}`);
    await kv.incr(`day:messages:${day}`, room.transcript.length);
    for (const p of humans) {
      const caught = !solo && humansWon && !!final && room.votes[p.id] === final.playerId;
      await kv.sadd("stats:players", p.id);
      await kv.sadd(`day:players:${day}`, p.id);
      await kv.zincr("lb:games", p.id, 1);
      if (caught) await kv.zincr("lb:catches", p.id, 1);
      if (!solo && humansWon && p.alive) await kv.zincr("lb:survived", p.id, 1);
      if (solo && humansWon) await kv.zincr("lb:impostors", p.id, 1);
      await kv.set(`name:${p.id}`, p.name);
      const rec = (await kv.get<PlayerRecord>(`player:${p.id}`)) ?? emptyRecord();
      rec.games += 1;
      if (humansWon) rec.wins += 1;
      else rec.fooled += 1;
      if (caught) rec.catches += 1;
      rec.lastPlayed = Date.now();
      rec.recent = [
        { code: room.code, at: Date.now(), won: humansWon, rounds: room.round, players: humans.length, botAlias },
        ...rec.recent,
      ].slice(0, 10);
      await kv.set(`player:${p.id}`, rec);
    }
    return [];
  });
}

/** Lobby presence: each open lobby tab refreshes a short-lived key, so closed tabs drop out. */
export const PRESENCE_TTL = 25;

export async function markSeen(code: string, uid: string) {
  await kv.set(`seen:${code}:${uid}`, 1, PRESENCE_TTL);
}

export async function onlineIn(room: Room) {
  const ids = room.players.filter((p) => !p.isBot).map((p) => p.id);
  const seen = await kv.mget<number>(ids.map((id) => `seen:${room.code}:${id}`));
  return ids.filter((_, i) => seen[i]);
}
