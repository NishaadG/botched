import { ALIASES, PROMPTS, shuffle } from "./content";
import { MAX_HUMANS, MIN_HUMANS, type BotState, type ChatLine, type Effect, type Mode, type Player, type Room } from "./types";

/**
 * Pure game rules for "Who's the Bot". No I/O: every function mutates the room
 * and returns the side-effects (Game Master lines, events, bot actions) to perform.
 */

export class GameError extends Error {}

export function createRoom(code: string, host: { id: string; name: string }, now: number, mode: Mode = "classic"): Room {
  return {
    code,
    mode,
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
    bots: [],
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
export const botById = (room: Room, id: string) => room.bots.find((b) => b.id === id);
export const isReverse = (room: Room) => room.mode === "reverse";

export function join(room: Room, user: { id: string; name: string }, now: number): Effect[] {
  if (playerById(room, user.id)) return [];
  if (room.phase !== "lobby") throw new GameError("This game has already started.");
  if (humans(room).length >= MAX_HUMANS[room.mode ?? "classic"]) {
    throw new GameError(isReverse(room) ? "This is a solo game. Start your own!" : "This room is full.");
  }
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
  bots: { id: string; personaId: string }[],
  now: number,
  rand: () => number = Math.random,
): Effect[] {
  if (room.phase !== "lobby") throw new GameError("The game has already started.");
  if (by !== room.hostId) throw new GameError("Only the host can start the game.");
  const min = MIN_HUMANS[room.mode];
  if (humans(room).length < min) throw new GameError(`You need at least ${min} people to play.`);

  for (const b of bots) room.players.push(makePlayer(b.id, "AI", now, true));
  const looks = shuffle(ALIASES, rand);
  shuffle(room.players, rand).forEach((p, i) => Object.assign(p, looks[i]));
  room.bots = bots.map(
    (b): BotState => ({
      id: b.id,
      personaId: b.personaId,
      thoughts: [],
      plan: null,
      lastSpokeAt: 0,
      linesThisRound: 0,
      thinkingSince: null,
    }),
  );
  room.maxRounds = isReverse(room) ? 3 : Math.min(5, Math.max(2, humans(room).length));
  room.startedAt = now;
  const welcome = isReverse(room)
    ? `Welcome. Everyone in this chat is an AI except one human. AIs: find the human. Human: act like a bot and survive ${room.maxRounds} rounds.`
    : `Welcome. ${humans(room).length} humans, 1 bot. Everyone has a secret alias. Find the bot before it outlasts you.`;
  return [{ type: "gm", text: welcome }, ...startRound(room, now, rand)];
}

function startRound(room: Room, now: number, rand: () => number): Effect[] {
  room.round += 1;
  room.phase = "chat";
  room.votes = {};
  room.phaseEndsAt = now + room.settings.chatSeconds * 1000;
  const pool = PROMPTS.filter((p) => !room.usedPrompts.includes(p));
  room.prompt = (pool.length ? pool : PROMPTS)[Math.floor(rand() * (pool.length || PROMPTS.length))];
  room.usedPrompts.push(room.prompt);
  for (const b of room.bots) b.linesThisRound = 0;
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
  else if (isReverse(room)) {
    text = out.isBot
      ? `${out.alias} was voted out. Just another AI. 🤖 The human is still hiding.`
      : `${out.alias} was voted out... and they were the HUMAN. The AIs win. 🤖`;
  } else if (out.isBot) text = `${out.alias} was voted out... and it WAS the bot. Humans win! 🎉`;
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
  const human = room.players.find((p) => !p.isBot);
  const text = isReverse(room)
    ? winner === "humans"
      ? `Game over. The human survived. It was ${human?.alias} all along. 🧠`
      : "Game over. The AIs found the human."
    : winner === "humans"
      ? "Game over. The humans caught the bot."
      : `Game over. The bot survived. It was ${bot?.alias} all along. 🤖`;
  return [
    { type: "gm", text },
    { type: "event", event: { kind: "phase", phase: "over" } },
    { type: "gameOver" },
  ];
}

/** Advances timers. Safe to call often; does nothing until a deadline passes. */
/** A chat that has been silent this long gets a nudge from one of the AIs. */
export const NUDGE_AFTER_MS = 18_000;

function quietSince(room: Room) {
  const roundStart = (room.phaseEndsAt ?? 0) - room.settings.chatSeconds * 1000;
  const lastLine = room.transcript.filter((l) => l.round === room.round).at(-1)?.at ?? 0;
  return Math.max(roundStart, lastLine, room.lastNudgeAt ?? 0);
}

function nudgeDue(room: Room, now: number) {
  if (room.phase !== "chat" || !room.phaseEndsAt) return false;
  if (room.phaseEndsAt - now < 10_000) return false; // too close to the vote to bother
  if (room.bots.some((b) => b.plan || b.thinkingSince)) return false;
  return now - quietSince(room) >= NUDGE_AFTER_MS;
}

/** Cheap check so clock ticks only lock and write the room when something is actually due. */
export function tickDue(room: Room, now: number) {
  if (room.phase === "chat") {
    for (const b of room.bots) {
      const plan = b.plan;
      if (plan && (now >= plan.dueAt || (!plan.typingSent && now >= plan.typingAt))) return true;
    }
    if (nudgeDue(room, now)) return true;
  }
  return Boolean(room.phaseEndsAt && now >= room.phaseEndsAt && room.phase !== "lobby" && room.phase !== "over");
}

export function tick(room: Room, now: number, rand: () => number = Math.random): Effect[] {
  const effects: Effect[] = [];

  if (room.phase === "chat") {
    for (const bot of room.bots) {
      if (!bot.plan || !playerById(room, bot.id)?.alive) continue;
      if (!bot.plan.typingSent && now >= bot.plan.typingAt) {
        bot.plan.typingSent = true;
        effects.push({ type: "botTyping", botId: bot.id });
      }
      if (now >= bot.plan.dueAt) {
        effects.push({ type: "botSay", botId: bot.id, text: bot.plan.text });
        bot.plan = null;
      }
    }
  }

  if (nudgeDue(room, now)) {
    const awake = room.bots.filter((b) => playerById(room, b.id)?.alive);
    if (awake.length) {
      room.lastNudgeAt = now;
      effects.push({ type: "planBot", trigger: "nudge", botId: awake[Math.floor(rand() * awake.length)].id });
    }
  }

  if (!room.phaseEndsAt || now < room.phaseEndsAt) return effects;

  if (room.phase === "chat") {
    for (const b of room.bots) b.plan = null;
    room.phase = "vote";
    room.phaseEndsAt = now + room.settings.voteSeconds * 1000;
    room.version++;
    effects.push(
      { type: "gm", text: isReverse(room) ? "Time's up. Vote: who is the human?" : "Time's up. Vote: who is the bot?" },
      { type: "event", event: { kind: "phase", phase: "vote", round: room.round } },
      { type: "botVote" },
    );
  } else if (room.phase === "vote") {
    effects.push(...resolveVote(room, now));
  } else if (room.phase === "reveal") {
    const last = room.eliminations.at(-1);
    if (isReverse(room)) {
      // The AIs win by voting out the human; the human wins by lasting every round
      // (or when only one AI is left, which can never outvote them).
      const humanAlive = room.players.some((p) => !p.isBot && p.alive);
      if (!humanAlive) effects.push(...finish(room, "bot", now));
      else if (alive(room).length <= 2 || room.round >= room.maxRounds) effects.push(...finish(room, "humans", now));
      else effects.push(...startRound(room, now, rand));
    } else {
      const botAlive = room.players.some((p) => p.isBot && p.alive);
      if (last?.wasBot || !botAlive) effects.push(...finish(room, "humans", now));
      else if (alive(room).length <= 2 || room.round >= room.maxRounds) effects.push(...finish(room, "bot", now));
      else effects.push(...startRound(room, now, rand));
    }
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
    mode: room.mode ?? "classic",
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
    botThoughts: over
      ? room.bots
          .flatMap((b) => b.thoughts.map((t) => ({ ...t, alias: playerById(room, b.id)?.alias ?? "" })))
          .sort((a, b) => a.at - b.at)
      : [],
    botPersona: over && room.bots[0] ? room.bots[0].personaId : null,
    finalVotes: over ? room.votes : null,
    rematch: room.rematch ?? null,
  };
}

export type RoomView = ReturnType<typeof viewFor>;
