/** Game modes and their timers. Shared by the server (rules) and the browser (mode picker). */

export type SoloVariant = "classic" | "blitz" | "crowd" | "hard" | "interrogation";

export interface Timers {
  /** Private answer phase before the discussion. 0 skips it. */
  answerSeconds: number;
  chatSeconds: number;
  voteSeconds: number;
  revealSeconds: number;
}

export const TAGLINE = {
  hub: "Party games with a bot in the room.",
  classic: "One of your friends is a bot.",
  solo: "AI took your job. Time to take its.",
} as const;

export const CLASSIC_TIMERS: Timers = { answerSeconds: 40, chatSeconds: 60, voteSeconds: 30, revealSeconds: 7 };
/** Short timers for automated end-to-end tests. */
export const FAST_TIMERS: Timers = { answerSeconds: 12, chatSeconds: 20, voteSeconds: 12, revealSeconds: 4 };

export interface SoloMode {
  id: SoloVariant;
  label: string;
  blurb: string;
  bots: number;
  rounds: number;
  timers: Timers;
}

export const SOLO_MODES: SoloMode[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "You and 3 AIs. They hunt the human for 3 rounds. Pass as one of them.",
    bots: 3,
    rounds: 3,
    timers: { answerSeconds: 35, chatSeconds: 60, voteSeconds: 25, revealSeconds: 6 },
  },
  {
    id: "interrogation",
    label: "Interrogation",
    blurb: "One AI detective, one suspect: you. Two and a half minutes of questions, then a verdict.",
    bots: 1,
    rounds: 1,
    timers: { answerSeconds: 0, chatSeconds: 150, voteSeconds: 20, revealSeconds: 7 },
  },
  {
    id: "blitz",
    label: "Blitz",
    blurb: "4 AIs, 4 rounds, 30-second discussions. No time to think like a human.",
    bots: 4,
    rounds: 4,
    timers: { answerSeconds: 15, chatSeconds: 30, voteSeconds: 15, revealSeconds: 4 },
  },
  {
    id: "crowd",
    label: "Crowd",
    blurb: "6 AIs, 5 rounds. Easier to hide in, harder to outlast.",
    bots: 6,
    rounds: 5,
    timers: { answerSeconds: 35, chatSeconds: 60, voteSeconds: 25, revealSeconds: 5 },
  },
  {
    id: "hard",
    label: "Hard",
    blurb: "3 sharper AIs. No gut calls: they compare your style across every round.",
    bots: 3,
    rounds: 3,
    timers: { answerSeconds: 35, chatSeconds: 60, voteSeconds: 25, revealSeconds: 6 },
  },
];

export const soloMode = (id: string | null | undefined) => SOLO_MODES.find((m) => m.id === id) ?? SOLO_MODES[0];
export const isSoloVariant = (id: unknown): id is SoloVariant => SOLO_MODES.some((m) => m.id === id);
