import "server-only";
import { connection } from "next/server";
import { kv } from "./store";

/** Read side of the numbers we show publicly. Every figure here is counted from real games, never seeded. */

export interface PlayerRecord {
  games: number;
  wins: number;
  catches: number;
  fooled: number;
  lastPlayed: number;
  recent: { code: string; at: number; won: boolean; rounds: number; players: number; botAlias: string }[];
}

/** UTC day bucket, e.g. 2026-11-11. */
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export interface Feedback {
  name: string;
  rating: number;
  text: string;
  code: string;
  at: number;
}

export const emptyRecord = (): PlayerRecord => ({ games: 0, wins: 0, catches: 0, fooled: 0, lastPlayed: 0, recent: [] });

export async function getGlobalStats() {
  await connection();
  const [[games, humanWins, botWins, messages], players, visitors] = await Promise.all([
    kv.mget<number>(["stats:games", "stats:humanWins", "stats:botWins", "stats:messages"]),
    kv.scard("stats:players"),
    kv.scard("stats:visitors"),
  ]);
  return {
    games: Number(games ?? 0),
    humanWins: Number(humanWins ?? 0),
    botWins: Number(botWins ?? 0),
    players,
    messages: Number(messages ?? 0),
    visitors,
  };
}

export type BoardKey = "catches" | "games" | "survived" | "impostors";

export async function getBoard(key: BoardKey, n = 20) {
  await connection();
  const rows = await kv.ztop(`lb:${key}`, n);
  const names = await kv.mget<string>(rows.map((r) => `name:${r.member}`));
  return rows.map((r, i) => ({ id: r.member, name: names[i] ?? "Someone", score: r.score }));
}

export async function getPlayerRecord(uid: string) {
  await connection();
  return (await kv.get<PlayerRecord>(`player:${uid}`)) ?? emptyRecord();
}

export const NEXT_GAMES = [
  {
    id: "two-truths",
    title: "Two Truths & a Bot",
    blurb: "Everyone posts two true facts about themselves. The AI slips a fake one into somebody's set. Find the forgery.",
  },
  {
    id: "emoji-heist",
    title: "Emoji Heist",
    blurb: "Describe a movie in emoji only. The AI is the fastest guesser in the room, so beat it to the answer.",
  },
  {
    id: "impostor-prompt",
    title: "Off Script",
    blurb: "Everyone gets the same secret word except one human. Chat around it without giving it away.",
  },
  {
    id: "roast-court",
    title: "Roast Court",
    blurb: "Pitch a terrible startup. An AI judge grills you live in the chat and the room votes on the verdict.",
  },
] as const;

export async function getNextGameVotes(uid?: string) {
  await connection();
  const scores = await Promise.all(NEXT_GAMES.map((g) => kv.zscore("votes:next", g.id)));
  const mine = uid ? await kv.get<string>(`nextvote:${uid}`) : null;
  return { counts: Object.fromEntries(NEXT_GAMES.map((g, i) => [g.id, scores[i]])) as Record<string, number>, mine };
}

/** Last `days` days of activity, oldest first. Players and visitors are unique per day. */
export async function getDailySeries(days = 14) {
  await connection();
  const keys = Array.from({ length: days }, (_, i) => dayKey(Date.now() - (days - 1 - i) * 86_400_000));
  const [games, messages, players, visitors] = await Promise.all([
    kv.mget<number>(keys.map((d) => `day:games:${d}`)),
    kv.mget<number>(keys.map((d) => `day:messages:${d}`)),
    Promise.all(keys.map((d) => kv.scard(`day:players:${d}`))),
    Promise.all(keys.map((d) => kv.scard(`day:visitors:${d}`))),
  ]);
  return keys.map((day, i) => ({
    day,
    games: Number(games[i] ?? 0),
    messages: Number(messages[i] ?? 0),
    players: players[i],
    visitors: visitors[i],
  }));
}

export async function getFeedback(n = 30) {
  await connection();
  const list = await kv.lrange<Feedback>("feedback", 200);
  const rated = list.filter((f) => f.rating >= 1);
  const avg = rated.length ? rated.reduce((a, f) => a + f.rating, 0) / rated.length : null;
  return { count: list.length, avg, recent: list.filter((f) => f.text).slice(0, n) };
}
