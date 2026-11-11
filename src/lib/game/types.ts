export type Phase = "lobby" | "chat" | "vote" | "reveal" | "over";

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

export interface Room {
  code: string;
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
  bot: BotState | null;
  transcript: ChatLine[];
  seen: string[];
  settings: { chatSeconds: number; voteSeconds: number; revealSeconds: number };
  version: number;
  statsRecorded?: boolean;
}

/** Side-effects the engine asks the runner to perform. */
export type Effect =
  | { type: "gm"; text: string }
  | { type: "event"; event: Record<string, unknown> }
  | { type: "botSay"; text: string }
  | { type: "botTyping" }
  | { type: "planBot"; trigger: "prompt" | "reply" | "nudge" }
  | { type: "botVote" }
  | { type: "gameOver" };

export const MIN_HUMANS = 2;
export const MAX_HUMANS = 8;
