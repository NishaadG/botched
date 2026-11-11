import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { chooseVote, generateLine, shouldReply, timing } from "../bot/brain";
import { AI_PERSONAS, personaById, PERSONAS } from "../bot/personas";
import { sendGroupEvent, sendGroupText } from "../nexconn-server";
import { kv } from "../store";
import { dayKey, emptyRecord, type PlayerRecord } from "../stats";
import { addMessage, alive, botById, castVote, GameError } from "./engine";
import { BOT_COUNT, type Effect, type Mode, type Room } from "./types";

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

/** Fresh AI players for a game. Ids look exactly like human ids, so nothing gives them away. */
export function newBots(mode: Mode) {
  const pool = [...(mode === "reverse" ? AI_PERSONAS : PERSONAS)].sort(() => Math.random() - 0.5);
  return Array.from({ length: BOT_COUNT[mode] }, (_, i) => ({
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
    const humansWon = room.winner === "humans";
    const solo = room.mode === "reverse";
    const final = room.eliminations.at(-1);
    const humans = room.players.filter((x) => !x.isBot);
    const botAlias = solo ? "3 AIs (solo)" : room.players.find((x) => x.isBot)?.alias ?? "";
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
