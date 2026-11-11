import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { chooseVote, generateLine, shouldReply, timing } from "../bot/brain";
import { personaById, PERSONAS } from "../bot/personas";
import { sendGroupEvent, sendGroupText } from "../nexconn-server";
import { kv } from "../store";
import { emptyRecord, type PlayerRecord } from "../stats";
import { addMessage, castVote, GameError } from "./engine";
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

export function newBot() {
  return {
    id: "p_" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x").toLowerCase(),
    personaId: PERSONAS[Math.floor(Math.random() * PERSONAS.length)].id,
  };
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
    const effects = await fn(room, now);
    for (const e of effects) {
      if (e.type === "botSay" && room.bot) {
        const id = `bot_${now}_${Math.random().toString(36).slice(2, 7)}`;
        addMessage(room, { id, from: room.bot.id, text: e.text, at: now }, now);
        room.bot.lastSpokeAt = now;
        room.bot.linesThisRound += 1;
      }
    }
    await saveRoom(room);
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
      else if (e.type === "botSay" && room.bot) await sendGroupText(room.channelId, room.bot.id, e.text);
      else if (e.type === "botTyping" && room.bot) await sendGroupEvent(room.channelId, room.bot.id, { kind: "typing" }, false);
      else if (e.type === "planBot") after(() => planBot(room.code, e.trigger));
      else if (e.type === "botVote") after(() => botVote(room.code));
      else if (e.type === "gameOver") after(() => recordStats(room.code));
    } catch (err) {
      console.error("[runner] effect failed", e.type, err);
    }
  }
}

async function planBot(code: string, trigger: "prompt" | "reply" | "nudge") {
  let snapshot: Room | null = null;
  await mutate(code, (room, now) => {
    if (shouldReply(room, trigger, now)) {
      room.bot!.thinkingSince = now;
      snapshot = structuredClone(room);
    }
    return [];
  });
  if (!snapshot) return;
  const s = snapshot as Room;
  const line = await generateLine(s, trigger);
  await mutate(code, (room, now) => {
    const bot = room.bot;
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

async function botVote(code: string) {
  const room = await loadRoom(code);
  if (!room?.bot || room.phase !== "vote") return;
  if (!room.players.find((p) => p.id === room.bot!.id)?.alive) return;
  const { targetId, thought } = await chooseVote(room);
  // Humans take a few seconds to vote, so the bot does too.
  await new Promise((r) => setTimeout(r, 3000 + Math.random() * 6000));
  await mutate(code, (r, now) => {
    if (r.phase !== "vote" || !r.bot || r.votes[r.bot.id]) return [];
    if (thought) r.bot.thoughts.push({ at: now, round: r.round, text: `Vote: ${thought}` });
    try {
      return castVote(r, r.bot.id, targetId, now);
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
    const final = room.eliminations.at(-1);
    const humans = room.players.filter((x) => !x.isBot);
    const botAlias = room.players.find((x) => x.isBot)?.alias ?? "";
    await kv.incr("stats:games");
    await kv.incr(humansWon ? "stats:humanWins" : "stats:botWins");
    await kv.incr("stats:messages", room.transcript.length);
    for (const p of humans) {
      const caught = humansWon && !!final && room.votes[p.id] === final.playerId;
      await kv.sadd("stats:players", p.id);
      await kv.zincr("lb:games", p.id, 1);
      if (caught) await kv.zincr("lb:catches", p.id, 1);
      if (humansWon && p.alive) await kv.zincr("lb:survived", p.id, 1);
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
