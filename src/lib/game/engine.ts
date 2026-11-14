import { offlineLine, promptIndexOf, humanScore } from "../bot/offline";
import { ALIASES, PROMPTS, shuffle } from "./content";
import { CLASSIC_TIMERS, soloMode, type SoloVariant } from "./modes";
import { MAX_HUMANS, MIN_HUMANS, type BotState, type ChatLine, type Effect, type Mode, type Player, type Room } from "./types";

/**
 * Pure game rules for "Who's the Bot". No I/O: every function mutates the room
 * and returns the side-effects (Game Master lines, events, bot actions) to perform.
 *
 * A round: answer (everyone answers the prompt privately, revealed together) → chat (discussion) → vote → reveal.
 */

export class GameError extends Error {}

export function createRoom(
  code: string,
  host: { id: string; name: string },
  now: number,
  mode: Mode = "classic",
  variant?: SoloVariant,
): Room {
  const solo = mode === "reverse" ? soloMode(variant) : null;
  return {
    code,
    mode,
    ...(solo ? { variant: solo.id } : {}),
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
    settings: { ...(solo ? solo.timers : CLASSIC_TIMERS) },
    version: 1,
  };
}

function makePlayer(id: string, name: string, now: number, isBot = false): Player {
  return { id, name, alias: "", color: "#94a3b8", avatar: "", isBot, alive: true, joinedAt: now };
}

export const humans = (room: Room) => room.players.filter((p) => !p.isBot);
export const alive = (room: Room) => room.players.filter((p) => p.alive);
export const playerById = (room: Room, id: string) => room.players.find((p) => p.id === id);
export const botById = (room: Room, id: string) => room.bots.find((b) => b.id === id);
export const isReverse = (room: Room) => room.mode === "reverse";
export const isInterrogation = (room: Room) => room.mode === "reverse" && room.variant === "interrogation";
/** How many AIs join this room's game. */
export const botCount = (room: Room) => (isReverse(room) ? soloMode(room.variant).bots : 1);

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

function welcomeText(room: Room) {
  if (!isReverse(room)) {
    return `Welcome. ${humans(room).length} humans, 1 bot. Everyone has a secret alias. Each round: answer privately, then discuss, then vote. Find the bot before it outlasts you.`;
  }
  const ais = room.bots.length;
  if (isInterrogation(room)) {
    const secs = room.settings.chatSeconds;
    const span = secs % 60 === 0 ? `${secs / 60} minutes` : secs > 60 ? `${Math.floor(secs / 60)} and a half minutes` : `${secs} seconds`;
    return `Interrogation. The detective will question you for ${span}, then decide: human or AI. Convince it you are a machine.`;
  }
  return `Welcome. ${ais} AIs and 1 human. AIs: find the human. Human: pass as a bot and survive ${room.maxRounds} rounds.`;
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
  shuffle(room.players, rand).forEach((p, i) => Object.assign(p, looks[i % looks.length]));
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
  room.maxRounds = isReverse(room) ? soloMode(room.variant).rounds : Math.min(5, Math.max(2, humans(room).length));
  room.startedAt = now;
  return [{ type: "gm", text: welcomeText(room) }, ...startRound(room, now, rand)];
}

function startRound(room: Room, now: number, rand: () => number): Effect[] {
  room.round += 1;
  room.votes = {};
  room.answers = {};
  room.answersAsked = false;
  const pool = PROMPTS.filter((p) => !room.usedPrompts.includes(p));
  room.prompt = (pool.length ? pool : PROMPTS)[Math.floor(rand() * (pool.length || PROMPTS.length))];
  room.usedPrompts.push(room.prompt);
  for (const b of room.bots) {
    b.linesThisRound = 0;
    b.plan = null;
  }
  room.version++;

  if (isInterrogation(room)) {
    // No prompt round: the detective opens with its own questions.
    room.phase = "chat";
    room.phaseEndsAt = now + room.settings.chatSeconds * 1000;
    return [
      { type: "event", event: { kind: "phase", phase: "chat", round: room.round } },
      { type: "planBot", trigger: "prompt" },
    ];
  }

  room.phase = "answer";
  room.phaseEndsAt = now + room.settings.answerSeconds * 1000;
  return [
    { type: "gm", text: `Round ${room.round}. ${room.prompt}` },
    { type: "event", event: { kind: "phase", phase: "answer", round: room.round } },
  ];
}

/** Answers are short and kept private until everyone's are in (or time runs out). */
export function submitAnswer(room: Room, playerId: string, text: string, now: number, rand: () => number = Math.random): Effect[] {
  if (room.phase !== "answer") throw new GameError("Answers are closed.");
  const p = playerById(room, playerId);
  if (!p?.alive) throw new GameError("Only players still in the game can answer.");
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) throw new GameError("Write an answer first.");
  room.answers ??= {};
  room.answers[playerId] = clean;
  room.version++;
  const effects: Effect[] = [{ type: "event", event: { kind: "answered", count: Object.keys(room.answers).length } }];
  // Once every human has answered, the AIs write theirs (having read the humans' answers).
  if (!room.answersAsked && alive(room).every((x) => x.isBot || room.answers![x.id])) {
    room.answersAsked = true;
    effects.push({ type: "botAnswers" });
  }
  if (alive(room).every((x) => room.answers![x.id])) effects.push(...revealAnswers(room, now, rand));
  return effects;
}

/** AIs that still have no answer when the time is up get a canned one, so the round never stalls. */
const ANSWER_GRACE_MS = 6000;

function revealAnswers(room: Room, now: number, rand: () => number): Effect[] {
  const answers = (room.answers ??= {});
  for (const p of alive(room)) {
    if (!p.isBot || answers[p.id]) continue;
    const bot = botById(room, p.id);
    const line = offlineLine(
      {
        mode: room.mode,
        persona: bot?.personaId,
        promptIndex: promptIndexOf(room.prompt),
        trigger: "prompt",
        myAlias: p.alias,
        others: [],
        said: Object.values(answers),
      },
      rand,
    );
    answers[p.id] = line.say;
  }
  const items = shuffle(
    alive(room)
      .filter((p) => answers[p.id])
      .map((p) => ({ from: p.id, text: answers[p.id] })),
    rand,
  );
  for (const [i, it] of items.entries()) {
    room.transcript.push({ id: `ans_${room.round}_${it.from}`, from: it.from, text: it.text, at: now + i, round: room.round, kind: "answer" });
  }
  room.phase = "chat";
  room.phaseEndsAt = now + room.settings.chatSeconds * 1000;
  room.version++;
  const missing = alive(room).filter((p) => !answers[p.id]).length;
  return [
    { type: "gm", text: missing ? `Answers are in (${missing} stayed silent).` : "Answers are in." },
    { type: "answers", items, round: room.round },
    {
      type: "gm",
      text: isReverse(room)
        ? `Discuss. Which answer sounded human? ${room.settings.chatSeconds} seconds.`
        : `Discuss. Which answer sounded like a bot? ${room.settings.chatSeconds} seconds.`,
    },
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
  if (isInterrogation(room)) throw new GameError("The detective decides this one.");
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
      ? `${out.alias} was voted out. Just another AI. The human is still hiding.`
      : `${out.alias} was voted out... and they were the HUMAN. The AIs win.`;
  } else if (out.isBot) text = `${out.alias} was voted out... and it WAS the bot. Humans win.`;
  else text = `${out.alias} was voted out. They were human. The bot is still among you.`;
  return [
    { type: "gm", text },
    { type: "event", event: { kind: "phase", phase: "reveal", round: room.round } },
  ];
}

/** Interrogation verdict. `human`: the detective thinks the suspect is a person (the suspect loses). */
export function castVerdict(room: Room, human: boolean, now: number): Effect[] {
  if (room.phase !== "vote" || !isInterrogation(room)) return [];
  const suspect = humans(room)[0];
  if (human && suspect) suspect.alive = false;
  const detective = room.bots[0]?.id;
  room.eliminations.push({
    round: room.round,
    playerId: human && suspect ? suspect.id : null,
    wasBot: false,
    tally: suspect && detective ? { [suspect.id]: 1 } : {},
  });
  room.verdict = human ? "human" : "ai";
  room.phase = "reveal";
  room.phaseEndsAt = now + room.settings.revealSeconds * 1000;
  room.version++;
  return [
    {
      type: "gm",
      text: human ? "Verdict: HUMAN. The detective saw right through you." : "Verdict: AI. The detective filed you as a machine. You passed.",
    },
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
  const text = isInterrogation(room)
    ? winner === "humans"
      ? "Case closed. Suspect classified as AI."
      : "Case closed. Suspect classified as human."
    : isReverse(room)
      ? winner === "humans"
        ? `Game over. The human survived. It was ${human?.alias} all along.`
        : "Game over. The AIs found the human."
      : winner === "humans"
        ? "Game over. The humans caught the bot."
        : `Game over. The bot survived. It was ${bot?.alias} all along.`;
  return [
    { type: "gm", text },
    { type: "event", event: { kind: "phase", phase: "over" } },
    { type: "gameOver" },
  ];
}

/** A chat that has been silent this long gets a nudge from one of the AIs. */
export const NUDGE_AFTER_MS = 18_000;

function quietSince(room: Room) {
  const roundStart = (room.phaseEndsAt ?? 0) - room.settings.chatSeconds * 1000;
  const lastLine = room.transcript.filter((l) => l.round === room.round && l.kind !== "answer").at(-1)?.at ?? 0;
  return Math.max(roundStart, lastLine, room.lastNudgeAt ?? 0);
}

function nudgeDue(room: Room, now: number) {
  if (room.phase !== "chat" || !room.phaseEndsAt) return false;
  if (room.phaseEndsAt - now < 10_000) return false; // too close to the vote to bother
  if (room.bots.some((b) => b.plan || b.thinkingSince)) return false;
  return now - quietSince(room) >= NUDGE_AFTER_MS;
}

/** Ask the AIs for their answers when the humans are all in, or shortly before time runs out. */
const ASK_BOTS_BEFORE_MS = 9000;

function botAnswersDue(room: Room, now: number) {
  if (room.phase !== "answer" || room.answersAsked || !room.phaseEndsAt) return false;
  const answers = room.answers ?? {};
  return now >= room.phaseEndsAt - ASK_BOTS_BEFORE_MS || alive(room).every((p) => p.isBot || answers[p.id]);
}

function answersPending(room: Room) {
  const answers = room.answers ?? {};
  return alive(room).some((p) => p.isBot && !answers[p.id]);
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
  if (botAnswersDue(room, now)) return true;
  if (room.phase === "answer" && room.phaseEndsAt && now >= room.phaseEndsAt) {
    return !answersPending(room) || now >= room.phaseEndsAt + ANSWER_GRACE_MS;
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

  if (nudgeDue(room, now) && !isInterrogation(room)) {
    const awake = room.bots.filter((b) => playerById(room, b.id)?.alive);
    if (awake.length) {
      room.lastNudgeAt = now;
      effects.push({ type: "planBot", trigger: "nudge", botId: awake[Math.floor(rand() * awake.length)].id });
    }
  } else if (nudgeDue(room, now) && isInterrogation(room)) {
    // The detective presses a silent suspect.
    room.lastNudgeAt = now;
    effects.push({ type: "planBot", trigger: "nudge", botId: room.bots[0].id });
  }

  if (botAnswersDue(room, now)) {
    room.answersAsked = true;
    room.version++;
    effects.push({ type: "botAnswers" });
  }

  if (!room.phaseEndsAt || now < room.phaseEndsAt) return effects;

  if (room.phase === "answer") {
    // Give AIs that are still writing a few extra seconds before falling back.
    if (answersPending(room) && now < room.phaseEndsAt + ANSWER_GRACE_MS) return effects;
    effects.push(...revealAnswers(room, now, rand));
  } else if (room.phase === "chat") {
    for (const b of room.bots) b.plan = null;
    room.phase = "vote";
    room.phaseEndsAt = now + room.settings.voteSeconds * 1000;
    room.version++;
    if (isInterrogation(room)) {
      effects.push(
        { type: "gm", text: "Time's up. The detective is reviewing the transcript." },
        { type: "event", event: { kind: "phase", phase: "vote", round: room.round } },
        { type: "botVerdict" },
      );
    } else {
      effects.push(
        { type: "gm", text: isReverse(room) ? "Time's up. Vote: who is the human?" : "Time's up. Vote: who is the bot?" },
        { type: "event", event: { kind: "phase", phase: "vote", round: room.round } },
        { type: "botVote" },
      );
    }
  } else if (room.phase === "vote") {
    if (isInterrogation(room)) {
      // The model never answered: fall back to scoring the suspect's messages.
      const suspect = humans(room)[0];
      const lines = room.transcript.filter((l) => l.from === suspect?.id).map((l) => l.text);
      effects.push(...castVerdict(room, !lines.length || humanScore(lines) >= 2, now));
    } else effects.push(...resolveVote(room, now));
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
  const answers = room.answers ?? {};
  return {
    code: room.code,
    mode: room.mode ?? "classic",
    variant: room.variant ?? null,
    matchmade: Boolean(room.matchmade),
    channelId: room.channelId,
    phase: room.phase,
    round: room.round,
    maxRounds: room.maxRounds,
    phaseEndsAt: room.phaseEndsAt,
    settings: { ...room.settings, answerSeconds: room.settings.answerSeconds ?? 0 },
    prompt: room.prompt,
    hostId: room.hostId,
    startedAt: room.startedAt,
    winner: room.winner,
    verdict: room.verdict ?? null,
    version: room.version,
    serverNow: Date.now(),
    you: me ? { id: me.id, alias: me.alias, color: me.color, alive: me.alive, name: me.name } : null,
    youVotedFor: viewerId ? room.votes[viewerId] ?? null : null,
    votesIn: Object.keys(room.votes).length,
    // Only a count while answering: names would show who answers last (the AI).
    answersIn: room.phase === "answer" ? Object.keys(answers).length : 0,
    yourAnswer: room.phase === "answer" && viewerId ? answers[viewerId] ?? null : null,
    players: room.players.map((p) => ({
      id: p.id,
      alias: showAliases ? p.alias : "",
      color: showAliases ? p.color : "#94a3b8",
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
