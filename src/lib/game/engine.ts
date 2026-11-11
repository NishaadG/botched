import { ALIASES, PROMPTS, shuffle } from "./content";
import { MAX_HUMANS, MIN_HUMANS, type ChatLine, type Effect, type Player, type Room } from "./types";

/**
 * Pure game rules for "Who's the Bot". No I/O: every function mutates the room
 * and returns the side-effects (Game Master lines, events, bot actions) to perform.
 */

export class GameError extends Error {}

export function createRoom(code: string, host: { id: string; name: string }, now: number): Room {
  return {
    code,
    channelId: `wtb_${code}`,
    game: "whos-the-bot",
    hostId: host.id,
    createdAt: now,
    startedAt: null,
    phase: "lobby",
    round: 0,
    maxRounds: 0,
    phaseEndsAt: null,
    prompt: null,
    usedPrompts: [],
    players: [makePlayer(host.id, host.name, now)],
    votes: {},
    eliminations: [],
    winner: null,
    bot: null,
    transcript: [],
    seen: [],
    settings: { chatSeconds: 90, voteSeconds: 30, revealSeconds: 7 },
    version: 1,
  };
}

function makePlayer(id: string, name: string, now: number, isBot = false): Player {
  return { id, name, alias: "", color: "#94a3b8", avatar: "🙂", isBot, alive: true, joinedAt: now };
}

export const humans = (room: Room) => room.players.filter((p) => !p.isBot);
export const alive = (room: Room) => room.players.filter((p) => p.alive);
export const playerById = (room: Room, id: string) => room.players.find((p) => p.id === id);

export function join(room: Room, user: { id: string; name: string }, now: number): Effect[] {
  if (playerById(room, user.id)) return [];
  if (room.phase !== "lobby") throw new GameError("This game has already started.");
  if (humans(room).length >= MAX_HUMANS) throw new GameError("This room is full.");
  room.players.push(makePlayer(user.id, user.name, now));
  room.version++;
  return [{ type: "event", event: { kind: "lobby" } }];
}

export function leave(room: Room, userId: string): Effect[] {
  if (room.phase !== "lobby") return [];
  room.players = room.players.filter((p) => p.id !== userId);
  if (room.hostId === userId && room.players.length) room.hostId = room.players[0].id;
  room.version++;
  return [{ type: "event", event: { kind: "lobby" } }];
}

export function start(
  room: Room,
  by: string,
  bot: { id: string; personaId: string },
  now: number,
  rand: () => number = Math.random,
): Effect[] {
  if (room.phase !== "lobby") throw new GameError("The game has already started.");
  if (by !== room.hostId) throw new GameError("Only the host can start the game.");
  if (humans(room).length < MIN_HUMANS) throw new GameError(`You need at least ${MIN_HUMANS} people to play.`);

  room.players.push(makePlayer(bot.id, "The Bot", now, true));
  const looks = shuffle(ALIASES, rand);
  shuffle(room.players, rand).forEach((p, i) => Object.assign(p, looks[i]));
  room.bot = {
    id: bot.id,
    personaId: bot.personaId,
    thoughts: [],
    plan: null,
    lastSpokeAt: 0,
    linesThisRound: 0,
    thinkingSince: null,
  };
  room.maxRounds = Math.min(5, Math.max(2, humans(room).length));
  room.startedAt = now;
  return [
    { type: "gm", text: `Welcome. ${humans(room).length} humans, 1 bot. Everyone has a secret alias. Find the bot before it outlasts you.` },
    ...startRound(room, now, rand),
  ];
}

function startRound(room: Room, now: number, rand: () => number): Effect[] {
  room.round += 1;
  room.phase = "chat";
  room.votes = {};
  room.phaseEndsAt = now + room.settings.chatSeconds * 1000;
  const pool = PROMPTS.filter((p) => !room.usedPrompts.includes(p));
  room.prompt = (pool.length ? pool : PROMPTS)[Math.floor(rand() * (pool.length || PROMPTS.length))];
  room.usedPrompts.push(room.prompt);
  if (room.bot) room.bot.linesThisRound = 0;
  room.version++;
  return [
    { type: "gm", text: `Round ${room.round}. ${room.prompt}` },
    { type: "event", event: { kind: "phase", phase: "chat", round: room.round } },
    { type: "planBot", trigger: "prompt" },
  ];
}

export function addMessage(room: Room, line: Omit<ChatLine, "round">, now: number): Effect[] {
  if (room.seen.includes(line.id)) return [];
  const sender = playerById(room, line.from);
  if (!sender || !sender.alive || room.phase !== "chat") return [];
  room.seen.push(line.id);
  if (room.seen.length > 400) room.seen = room.seen.slice(-300);
  room.transcript.push({ ...line, text: line.text.slice(0, 500), round: room.round });
  room.version++;
  if (sender.isBot) return [];
  void now;
  return [{ type: "planBot", trigger: "reply" }];
}

export function castVote(room: Room, voterId: string, targetId: string, now: number): Effect[] {
  if (room.phase !== "vote") throw new GameError("Voting is not open.");
  const voter = playerById(room, voterId);
  const target = playerById(room, targetId);
  if (!voter?.alive) throw new GameError("Only players still in the game can vote.");
  if (!target?.alive || target.id === voter.id) throw new GameError("Pick someone else who is still in the game.");
  room.votes[voterId] = targetId;
  room.version++;
  const effects: Effect[] = [{ type: "event", event: { kind: "vote", count: Object.keys(room.votes).length } }];
  if (alive(room).every((p) => room.votes[p.id])) effects.push(...resolveVote(room, now));
  return effects;
}

export function tally(room: Room) {
  const counts: Record<string, number> = {};
  for (const target of Object.values(room.votes)) counts[target] = (counts[target] ?? 0) + 1;
  return counts;
}

function resolveVote(room: Room, now: number): Effect[] {
  const counts = tally(room);
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((id) => counts[id] === top);
  const out = leaders.length === 1 ? playerById(room, leaders[0]) : undefined;
  if (out) out.alive = false;
  room.eliminations.push({ round: room.round, playerId: out?.id ?? null, wasBot: Boolean(out?.isBot), tally: counts });
  room.phase = "reveal";
  room.phaseEndsAt = now + room.settings.revealSeconds * 1000;
  room.version++;

  let text: string;
  if (!out) text = "It's a tie. Nobody is voted out this round.";
  else if (out.isBot) text = `${out.alias} was voted out... and it WAS the bot. Humans win! 🎉`;
  else text = `${out.alias} was voted out. They were human. 😬 The bot is still among you.`;
  return [
    { type: "gm", text },
    { type: "event", event: { kind: "phase", phase: "reveal", round: room.round } },
  ];
}

function finish(room: Room, winner: "humans" | "bot", now: number): Effect[] {
  room.phase = "over";
  room.winner = winner;
  room.phaseEndsAt = null;
  room.version++;
  void now;
  const bot = room.players.find((p) => p.isBot);
  const text =
    winner === "humans"
      ? "Game over. The humans caught the bot."
      : `Game over. The bot survived. It was ${bot?.alias} all along. 🤖`;
  return [
    { type: "gm", text },
    { type: "event", event: { kind: "phase", phase: "over" } },
    { type: "gameOver" },
  ];
}

/** Advances timers. Safe to call often; does nothing until a deadline passes. */
export function tick(room: Room, now: number, rand: () => number = Math.random): Effect[] {
  const effects: Effect[] = [];
  const bot = room.bot;

  if (room.phase === "chat" && bot?.plan) {
    if (!bot.plan.typingSent && now >= bot.plan.typingAt) {
      bot.plan.typingSent = true;
      effects.push({ type: "botTyping" });
    }
    if (now >= bot.plan.dueAt) {
      effects.push({ type: "botSay", text: bot.plan.text });
      bot.plan = null;
    }
  }

  if (!room.phaseEndsAt || now < room.phaseEndsAt) return effects;

  if (room.phase === "chat") {
    if (bot) bot.plan = null;
    room.phase = "vote";
    room.phaseEndsAt = now + room.settings.voteSeconds * 1000;
    room.version++;
    effects.push(
      { type: "gm", text: "Time's up. Vote: who is the bot?" },
      { type: "event", event: { kind: "phase", phase: "vote", round: room.round } },
      { type: "botVote" },
    );
  } else if (room.phase === "vote") {
    effects.push(...resolveVote(room, now));
  } else if (room.phase === "reveal") {
    const last = room.eliminations.at(-1);
    const botAlive = room.players.some((p) => p.isBot && p.alive);
    if (last?.wasBot || !botAlive) effects.push(...finish(room, "humans", now));
    else if (alive(room).length <= 2 || room.round >= room.maxRounds) effects.push(...finish(room, "bot", now));
    else effects.push(...startRound(room, now, rand));
  }
  return effects;
}

/** What a given viewer is allowed to see. Hides the bot and real names until the end. */
export function viewFor(room: Room, viewerId: string | null) {
  const over = room.phase === "over";
  const me = viewerId ? playerById(room, viewerId) : undefined;
  const showAliases = room.phase !== "lobby";
  return {
    code: room.code,
    channelId: room.channelId,
    phase: room.phase,
    round: room.round,
    maxRounds: room.maxRounds,
    phaseEndsAt: room.phaseEndsAt,
    settings: room.settings,
    prompt: room.prompt,
    hostId: room.hostId,
    startedAt: room.startedAt,
    winner: room.winner,
    version: room.version,
    serverNow: Date.now(),
    you: me ? { id: me.id, alias: me.alias, color: me.color, avatar: me.avatar, alive: me.alive, name: me.name } : null,
    youVotedFor: viewerId ? room.votes[viewerId] ?? null : null,
    votesIn: Object.keys(room.votes).length,
    players: room.players.map((p) => ({
      id: p.id,
      alias: showAliases ? p.alias : "",
      color: showAliases ? p.color : "#94a3b8",
      avatar: showAliases ? p.avatar : "🙂",
      alive: p.alive,
      // Real names: everyone sees nicknames in the lobby; during the game only your own.
      name: !showAliases || over || p.id === viewerId ? p.name : null,
      isBot: over ? p.isBot : null,
    })),
    eliminations: room.eliminations.map((e) => ({
      ...e,
      wasBot: e.wasBot,
      tally: room.phase === "reveal" || over || e !== room.eliminations.at(-1) ? e.tally : {},
    })),
    transcript: room.transcript,
    botThoughts: over ? room.bot?.thoughts ?? [] : [],
    botPersona: over && room.bot ? room.bot.personaId : null,
    finalVotes: over ? room.votes : null,
  };
}

export type RoomView = ReturnType<typeof viewFor>;
