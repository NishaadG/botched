/**
 * The bot's brain when no language model is available (quota, outage, no key).
 * Rule-based but context-aware: answers the round's prompt, reacts when accused or asked,
 * deflects onto other players, never repeats itself, and keeps a believable inner monologue.
 */
import { PROMPTS } from "../game/content";

type Rand = () => number;
const pick = <T>(xs: readonly T[], rand: Rand) => xs[Math.floor(rand() * xs.length)];

/** Answers per prompt, written to sound like real people in a group chat. Order matches PROMPTS. */
const ANSWERS: string[][] = [
  // most chaotic thing on a group trip
  ["we missed the last bus back and slept at the station lol", "someone left the hotel key inside the room at 2am", "my friend got lost in a mall for 3 hours somehow", "we booked the wrong goa. like the wrong beach entirely"],
  // unpopular food opinion
  ["biryani is overrated and i will die on this hill", "cold pizza > hot pizza", "maggi tastes better when its slightly overcooked", "paneer is just tofu with better marketing"],
  // last sunday
  ["slept till 1 then watched reels till 5. peak productivity", "did laundry and called it a day", "went to a cousins thing. regretted it", "nothing. genuinely nothing. it was great"],
  // morning routine in the worst way
  ["snooze 6 times, panic, skip breakfast, regret", "wake up, check phone for 40 mins, then realise im late", "brush teeth while looking for my other sock", "alarm, ignore, alarm, ignore, mom yelling, up"],
  // small thing that ruins your day
  ["when the wifi dies right before something loads", "stepping on a wet floor with socks on", "earphones getting tangled in the door handle", "when someone says 'we need to talk' and then disappears"],
  // app you use too much
  ["instagram. i open it without even thinking", "youtube shorts, its a problem", "spotify but just skipping songs for an hour", "whatsapp, mostly to not reply to people"],
  // worst teacher or boss
  ["had a teacher who gave 0 for writing in blue pen", "my old manager replied to emails with just 'k'", "sir used to take attendance twice just to catch proxies", "one teacher made us stand if our handwriting was bad"],
  // go-to excuse when late
  ["traffic. always traffic. even when i walk", "'just reached' while still at home", "my phone died so i couldnt check the time", "auto wala took a long route"],
  // one street food forever
  ["pani puri no question", "vada pav. cheap and perfect", "momos with the red chutney", "chole bhature but my stomach would hate me"],
  // last thing you googled
  ["how long does it take to boil an egg. dont judge", "is it normal to sneeze when you see the sun", "movie timings near me", "how to remove a stain from a white shirt"],
  // sleep schedule out of 10
  ["2/10. i sleep at 3 and wake up at 11", "honestly a 6, its consistently bad", "4 because i nap at 5pm and ruin everything", "what sleep schedule"],
  // movie everyone loves that you can't stand
  ["interstellar. too long and too loud", "titanic, there was space on the door", "honestly most marvel movies after endgame", "3 idiots. i said what i said"],
  // random wednesday off
  ["sleep, food, sleep again", "go somewhere with no network", "finally clean my room. jk i would not", "binge a whole series in one go"],
  // most useless skill
  ["i can name every country flag. never helped once", "i can spin a pen pretty well", "i know the whole lyrics to songs i hate", "i can tell which brand of chips it is by the sound"],
  // lock screen without saying what it is
  ["its dark and a bit blue and has a moon vibe", "a very old photo i should change", "default wallpaper because im lazy", "my dog doing something stupid"],
];

const DEFENSES = [
  "bro why me 😭",
  "lmao i literally just typed like a normal person",
  "accusing me is exactly what a bot would do",
  "ok but {other} has been way too quiet",
  "nah {other} answered that way too fast",
  "if i was a bot i would at least have better grammar",
  "wow ok, trust issues in this chat",
  "{other} is deflecting so hard rn",
];

const QUESTION_ANSWERS = [
  "uh i mean yeah kind of",
  "honestly no idea, why",
  "depends on the day tbh",
  "lol why do you want to know",
  "yeah obviously",
  "not really no",
];

const REACTIONS = [
  "{name} thats so real",
  "wait {name} same",
  "{name} what 😭",
  "lol {name}",
  "ok {name} has a point",
  "{name} nobody believes that",
  "thats actually kinda sus {name}",
];

const THOUGHTS = {
  prompt: [
    "Kept it boring and specific. Humans love boring and specific.",
    "Added a tiny made-up detail. Details sell it.",
    "Typed slowly on purpose. Speed is a giveaway.",
  ],
  defend: [
    "They're onto me. Deflect, then point at someone else.",
    "Getting accused is fine if I sound offended enough.",
    "Pinned it on someone quieter. Classic.",
  ],
  question: ["Vague answer, casual tone. Don't overexplain.", "Answered a question with a question. Very human."],
  react: ["Reacted to someone by name. Real friends do that.", "Agreeing is the safest way to be invisible.", "Short reply. Long replies look rehearsed."],
};

export interface OfflineContext {
  promptIndex: number;
  trigger: "prompt" | "reply" | "nudge";
  myAlias: string;
  /** Latest line from someone else, if any. */
  last?: { alias: string; text: string };
  /** Aliases of other players still in the game. */
  others: string[];
  /** Everything the bot already said this game, to avoid repeats. */
  said: string[];
}

const first = (alias: string) => alias.split(" ")[0].toLowerCase();

export function offlineLine(ctx: OfflineContext, rand: Rand = Math.random): { say: string; thought: string } {
  const fresh = (pool: readonly string[]) => {
    const unused = pool.filter((l) => !ctx.said.some((s) => s.toLowerCase() === l.toLowerCase()));
    return pick(unused.length ? unused : pool, rand);
  };
  const others = ctx.others.filter((a) => a !== ctx.myAlias);
  const fill = (line: string) =>
    line
      .replace("{other}", first(pick(others.length ? others : ["someone"], rand)))
      .replace("{name}", ctx.last ? first(ctx.last.alias) : "");

  if (ctx.trigger === "prompt") {
    const pool = ANSWERS[ctx.promptIndex] ?? ANSWERS[0];
    return { say: fresh(pool), thought: pick(THOUGHTS.prompt, rand) };
  }

  const text = ctx.last?.text.toLowerCase() ?? "";
  const me = first(ctx.myAlias);
  const accused = /\b(bot|ai|robot|chatgpt|sus|suspicious)\b/.test(text) && (text.includes(me) || rand() < 0.4);
  if (accused) {
    // The person who accused us is the natural target to deflect onto.
    const line = fresh(DEFENSES);
    const target = ctx.last && ctx.last.alias !== ctx.myAlias && rand() < 0.5 ? first(ctx.last.alias) : null;
    return { say: target ? line.replace("{other}", target) : fill(line), thought: pick(THOUGHTS.defend, rand) };
  }
  if (text.includes(me) && text.includes("?")) {
    return { say: fresh(QUESTION_ANSWERS), thought: pick(THOUGHTS.question, rand) };
  }
  if (ctx.last && rand() < 0.6) {
    return { say: fill(fresh(REACTIONS)), thought: pick(THOUGHTS.react, rand) };
  }
  // Otherwise, a second answer to the prompt keeps the topic going.
  const pool = ANSWERS[ctx.promptIndex] ?? ANSWERS[0];
  return { say: fresh(pool), thought: pick(THOUGHTS.prompt, rand) };
}

export function promptIndexOf(prompt: string | null) {
  const i = prompt ? PROMPTS.indexOf(prompt) : -1;
  return i >= 0 ? i : 0;
}

export const VOTE_THOUGHTS = [
  "Voting with the crowd. Safest place to hide.",
  "Picked whoever was already in trouble. Teamwork.",
  "Never vote for the person accusing you. Too obvious.",
];
