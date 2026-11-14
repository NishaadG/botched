import type { SoloVariant, Timers } from "./modes";

/** answer: everyone answers the prompt privately; chat: open discussion; then the vote. */
export type Phase = "lobby" | "answer" | "chat" | "vote" | "reveal" | "over";

export interface Player {
  /** Nexconn user id (humans: stable per guest; bot: fresh per game). */
  id: string;
  /** Real nickname. Hidden from other players until the game is over. */
  name: string;
  alias: string;
  color: string;
  avatar: string;
  isBot: boolean;
  alive: boolean;
  joinedAt: number;
}

export interface ChatLine {
  id: string;
  from: string;
  text: string;
  at: number;
  round: number;
  /** A private answer, revealed with everyone else's when the answer phase ends. */
  kind?: "answer";
}

export interface Elimination {
  round: number;
  playerId: string | null;
  wasBot: boolean;
  tally: Record<string, number>;
}

export interface BotPlan {
  text: string;
  typingAt: number;
  dueAt: number;
  typingSent: boolean;
  reason: string;
}

export interface BotState {
  id: string;
  personaId: string;
  thoughts: { at: number; round: number; text: string }[];
  plan: BotPlan | null;
  lastSpokeAt: number;
  /** How many lines the bot has produced this round, to keep its volume human. */
  linesThisRound: number;
  /** When set, a reply is being generated; prevents parallel generation. */
  thinkingSince: number | null;
}

/**
 * classic: humans hunt one hidden bot ("Who's the Bot").
 * reverse: one human hides among AIs that are hunting them ("Who's the Human", playable solo).
 */
export type Mode = "classic" | "reverse";

export interface Room {
  code: string;
  mode: Mode;
  channelId: string;
  game: "whos-the-bot";
  hostId: string;
  createdAt: number;
  startedAt: number | null;
  phase: Phase;
  round: number;
  maxRounds: number;
  phaseEndsAt: number | null;
  prompt: string | null;
  usedPrompts: string[];
  players: Player[];
  votes: Record<string, string>;
  eliminations: Elimination[];
  winner: "humans" | "bot" | null;
  bots: BotState[];
  transcript: ChatLine[];
  seen: string[];
  settings: Timers;
  /** Solo games only: which solo mode. */
  variant?: SoloVariant;
  /** This round's private answers, by player id. */
  answers?: Record<string, string>;
  /** The AIs have been asked for their answers this round. */
  answersAsked?: boolean;
  /** Opened by quick match: strangers can be dropped in. */
  matchmade?: boolean;
  /** Interrogation only: what the detective decided. */
  verdict?: "human" | "ai";
  version: number;
  statsRecorded?: boolean;
  /** Created by an automated test: never counted in stats or shown in feedback. */
  test?: boolean;
  /** Code of the follow-up room, once someone starts a rematch. */
  rematch?: string;
  /** Last time an AI was asked to break a silence. */
  lastNudgeAt?: number;
}

/** Side-effects the engine asks the runner to perform. */
export type Effect =
  | { type: "gm"; text: string }
  | { type: "event"; event: Record<string, unknown> }
  | { type: "botSay"; botId: string; text: string }
  | { type: "botTyping"; botId: string }
  /** Without botId, every bot still in the game decides whether to speak. */
  | { type: "planBot"; trigger: "prompt" | "reply" | "nudge"; botId?: string }
  | { type: "botVote" }
  /** Every AI still in the game writes its private answer, after reading the ones already in. */
  | { type: "botAnswers" }
  /** Answers revealed together, each posted into the chat as its author. */
  | { type: "answers"; items: { from: string; text: string }[]; round: number }
  /** Interrogation: the detective decides whether the suspect is human. */
  | { type: "botVerdict" }
  | { type: "gameOver" };

export const MIN_HUMANS: Record<Mode, number> = { classic: 2, reverse: 1 };
export const MAX_HUMANS: Record<Mode, number> = { classic: 8, reverse: 1 };
/** How many AIs join a game of each mode. */
export const BOT_COUNT: Record<Mode, number> = { classic: 1, reverse: 3 };
