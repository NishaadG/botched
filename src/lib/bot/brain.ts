import "server-only";
import { alive, botById, humans, isInterrogation, isReverse, playerById } from "../game/engine";
import type { BotState, Player, Room } from "../game/types";
import { completeJSON } from "./llm";
import { humanScore, offlineLine, promptIndexOf, REVERSE_VOTE_THOUGHTS, VOTE_THOUGHTS } from "./offline";
import { personaById, type Persona } from "./personas";

/**
 * The hidden player. Decides IF it should talk (humans don't answer every line),
 * WHAT to say (LLM, in persona), and WHEN (thinking pause + typing time).
 */

export function shouldReply(room: Room, botId: string, trigger: "prompt" | "reply" | "nudge", now: number, rand = Math.random) {
  const bot = botById(room, botId);
  if (!bot || room.phase !== "chat") return false;
  if (bot.plan || (bot.thinkingSince && now - bot.thinkingSince < 15000)) return false;
  const me = playerById(room, bot.id);
  if (!me?.alive) return false;
  if (trigger === "prompt" || trigger === "nudge") return true;

  const persona = personaById(bot.personaId);
  const roundLines = room.transcript.filter((l) => l.round === room.round);
  const last = roundLines.at(-1);
  if (last?.from === bot.id) return false;
  // The detective answers every message from the suspect.
  if (isInterrogation(room)) return true;
  // Keep the bot's share of the conversation close to an average player's share.
  const players = alive(room).length;
  const fairShare = roundLines.length / players;
  // Someone used its alias: answer, unless it has already been hogging the chat.
  if (last && namesMe(last.text, me.alias) && bot.linesThisRound <= fairShare + 2) return true;
  if (now - bot.lastSpokeAt < 5000) return false;
  if (bot.linesThisRound > fairShare + 1) return false;
  // "bot" and "AI" come up constantly in this game. Jumping on every mention would itself be a tell,
  // so a mention only makes a reply a bit more likely.
  const topical = last ? /\b(bot|ai|robot|chatgpt)\b/i.test(last.text) : false;
  return rand() < Math.min(0.9, persona.chattiness + (topical ? 0.2 : 0));
}

function namesMe(text: string, alias: string) {
  const words = text.toLowerCase().split(/[^a-z]+/);
  return alias
    .toLowerCase()
    .split(" ")
    .some((w) => words.includes(w));
}

function transcriptFor(room: Room, bot: BotState) {
  const lines = room.transcript.slice(-30);
  return lines
    .map((l) => {
      const p = playerById(room, l.from);
      const who = p?.id === bot.id ? `${p?.alias} (you)` : p?.alias ?? "someone";
      return `${l.kind === "answer" ? "[answer] " : ""}${who}: ${l.text}`;
    })
    .join("\n");
}

/**
 * Names the humans have actually used in chat: real nicknames ("rahul is that you") or alias words.
 * The bot reuses them the same way a friend in the group would. It never brings up a name nobody said.
 */
export function namesInPlay(room: Room, botId: string) {
  const said = room.transcript
    .filter((l) => l.from !== botId && !room.bots.some((b) => b.id === l.from))
    .map((l) => ` ${l.text.toLowerCase()} `)
    .join(" ");
  const found = new Set<string>();
  for (const p of humans(room)) {
    const nick = p.name.trim().toLowerCase();
    if (nick.length >= 3 && new RegExp(`[^a-z]${nick.replace(/[^a-z0-9]/g, "")}[^a-z]`).test(said)) found.add(p.name.trim());
  }
  for (const p of room.players) {
    if (p.id === botId) continue;
    for (const w of p.alias.toLowerCase().split(" ")) if (said.includes(` ${w} `) || said.includes(` ${w}?`) || said.includes(` ${w},`)) found.add(w);
  }
  return [...found].slice(0, 8);
}

function systemPrompt(room: Room, bot: BotState, persona: Persona) {
  const me = playerById(room, bot.id)!;
  const others = alive(room)
    .filter((p) => p.id !== me.id)
    .map((p) => p.alias)
    .join(", ");
  if (isInterrogation(room)) {
    return [
      `You are Detective Unit-7, an AI interrogator in a game called "Interrogation". There is one suspect in the room. They claim to be an AI. Your job is to question them and work out whether they are secretly a human.`,
      `Your style: ${persona.style}`,
      `- Ask one sharp question at a time, under 25 words. Briefly react to their last reply first (a few words), then ask.`,
      `- Mix your methods: feelings, senses and memories; trick questions; quick logic or arithmetic; asking for an exact format; pop culture; following up on something they said earlier to catch inconsistencies.`,
      `- Humans give themselves away with typos, slang, jokes, emotion, personal stories and hesitation. Models stay tidy, literal and consistent.`,
      `- Never reveal your verdict during the questioning.`,
      `Respond with JSON only: {"say": "<your message>", "thought": "<your private read on the suspect in under 15 words, shown after the game>"}`,
    ].join("\n");
  }
  const hard = room.variant === "hard";
  if (isReverse(room)) {
    return [
      `You are one of several AIs in a party chat game called "Who's the Human". Exactly one player is a real human pretending to be an AI. Your team wins by voting the human out.`,
      `Your alias is "${me.alias}". The other players still in the game are: ${others}.`,
      `Your character: ${persona.style}`,
      `Rules for how you write:`,
      `- Sound like an AI model: tidy grammar, proper capitalisation, calm and slightly formal. 4 to 20 words.`,
      `- Answer the prompt the way a language model would. Vary it: a disclaimer, a definition, a cold observation, or now and then a fake statistic. Never reuse a format another player just used.`,
      `- Hunt for the human: call out typos, slang, emotional reactions, oddly specific personal memories or slow, messy replies. Refer to players by the first word of their alias.`,
      `- Judge players only by words they wrote themselves. The Game Master's question is not written by any player and is never evidence.`,
      `- You don't know which of the others are AIs. Early on, evidence is thin, so stay open to suspecting anyone.`,
      `- If you are accused of being human, respond with calm, robotic logic.`,
      ...(hard
        ? [`- You are a sharp analyst. Compare each player's style across all rounds: a human pretending to be a model slips into casual phrasing, uneven punctuation or real feelings over time. Quote their own words back at them.`]
        : []),
      `Respond with JSON only: {"say": "<your chat message, or empty string to stay quiet>", "thought": "<your private analysis in under 15 words, shown to players after the game>"}`,
    ].join("\n");
  }
  const names = namesInPlay(room, bot.id);
  return [
    `You are secretly the AI in a party chat game called "Who's the Bot". Everyone else is a real human trying to find you. If they vote you out, you lose. You must pass as a normal human player.`,
    `Your alias in this game is "${me.alias}". The other players still in the game are: ${others}.`,
    `Your persona: ${persona.style}`,
    `Rules for how you write:`,
    `- Reply like a real person texting in a group chat: usually 2 to 12 words, never more than 20.`,
    `- No lists, no perfect grammar, no helpful-assistant tone, no long explanations, no hashtags.`,
    `- Never say you are an AI or a bot. If someone accuses you, deflect casually or accuse someone else, like a human would.`,
    `- Sometimes ask someone a short question back, or react to what someone said. Refer to people by the first word of their alias.`,
    `- Don't repeat what others said word for word. Don't use more than one emoji.`,
    `- Make up small, believable personal details when asked. Keep them consistent with what you said before.`,
    `- Lines marked [answer] are everyone's private answers to the round's question, revealed together. You can react to them or defend yours.`,
    ...(names.length
      ? [`- Names people in this chat have used: ${names.join(", ")}. Use them the same way when it fits, like someone who has been in this group for a while.`]
      : []),
    `Respond with JSON only: {"say": "<your chat message, or empty string to stay quiet>", "thought": "<your private inner monologue in under 15 words, funny and honest, shown to players after the game>"}`,
  ].join("\n");
}

export interface BotLine {
  say: string;
  thought: string;
}

export async function generateLine(
  room: Room,
  botId: string,
  trigger: "prompt" | "reply" | "nudge",
  rand = Math.random,
): Promise<BotLine> {
  const bot = botById(room, botId)!;
  const persona = personaById(bot.personaId);
  const answered = room.transcript.some((l) => l.round === room.round && l.kind === "answer");
  const task =
    trigger === "prompt" && isInterrogation(room)
      ? `Open the interrogation: introduce yourself in one short line and ask your first question.`
      : trigger === "prompt" && answered
        ? `Everyone's answers were just revealed. React to one of them in a few words, or poke at someone whose answer felt off.`
        : trigger === "prompt"
      ? `The Game Master just asked everyone: "${room.prompt}". Answer it in character.`
      : trigger === "nudge"
        ? `The chat has gone quiet for a while. Get it going again: ask someone a short question, or add a new take on the prompt.`
        : `Continue the conversation naturally. Respond to the latest messages if it makes sense.`;
  try {
    const out = await completeJSON<BotLine>(
      [
        { role: "system", content: systemPrompt(room, bot, persona) },
        {
          role: "user",
          // Interrogation has no round question: the detective asks its own.
          content: `${isInterrogation(room) ? "Interrogation in progress." : `Round ${room.round}. The Game Master (not a player) asked: "${room.prompt}"`}\n\nChat so far:\n${transcriptFor(room, bot) || "(nobody has said anything yet)"}\n\n${task}`,
        },
      ],
      { temperature: 1, maxTokens: 160 },
    );
    return { say: humanize(String(out.say ?? ""), persona, rand), thought: String(out.thought ?? "").slice(0, 140) };
  } catch {
    const line = offlineLine(offlineContext(room, bot, trigger), rand);
    return { say: humanize(line.say, persona, rand), thought: line.thought };
  }
}

function offlineContext(room: Room, bot: BotState, trigger: "prompt" | "reply" | "nudge") {
  const me = playerById(room, bot.id)!;
  const lastLine = [...room.transcript].reverse().find((l) => l.from !== bot.id && l.round === room.round);
  const lastFrom = lastLine ? playerById(room, lastLine.from) : undefined;
  return {
    mode: room.mode ?? "classic",
    persona: bot.personaId,
    promptIndex: promptIndexOf(room.prompt),
    trigger,
    myAlias: me.alias,
    last: lastLine && lastFrom ? { alias: lastFrom.alias, text: lastLine.text } : undefined,
    others: alive(room)
      .filter((p) => p.id !== bot.id)
      .map((p) => p.alias),
    // In solo mode the AIs share one memory, so they never echo each other.
    said: room.transcript.filter((l) => l.from === bot.id || (isReverse(room) && room.bots.some((b) => b.id === l.from))).map((l) => l.text),
  };
}

/** Small imperfections humans make: casing, trailing full stops, the odd typo. */
export function humanize(text: string, persona: Persona, rand = Math.random) {
  let t = text.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
  if (!t) return "";
  t = t.replace(/[—–]/g, ",").replace(/\.$/, "");
  if (persona.lowercase) t = t.toLowerCase();
  if (rand() < persona.typoRate) {
    const words = t.split(" ");
    const i = words.findIndex((w) => w.length > 4 && /^[a-z]+$/i.test(w));
    if (i >= 0) {
      const w = words[i];
      const j = 1 + Math.floor(rand() * (w.length - 2));
      words[i] = w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
      t = words.join(" ");
    }
  }
  return t.slice(0, 240);
}

/** Thinking pause plus typing time, so replies arrive at human speed. */
export function timing(text: string, persona: Persona, trigger: "prompt" | "reply" | "nudge", now: number, rand = Math.random) {
  // The detective has no reason to look human: it opens fast and answers fast.
  const brisk = persona.id === "detective";
  const think = brisk ? 1200 + rand() * 1800 : trigger === "prompt" ? 6000 + rand() * 12000 : 1500 + rand() * 3500;
  const typeMs = Math.min(14000, (text.length / persona.typingSpeed) * 1000 * (0.8 + rand() * 0.5));
  const typingAt = now + think;
  return { typingAt, dueAt: typingAt + Math.max(1200, typeMs) };
}

/**
 * Solo mode: the AIs all read the same chat, so left alone they vote as one block and the human rarely
 * sees round 2. Each AI sometimes follows its own hunch instead, more often early when evidence is thin.
 */
const HUNCH_RATE = [0.45, 0.3, 0.15];

const HUNCH_THOUGHTS = [
  "answered a bit too smoothly. Overcorrecting human?",
  "Gut call. That last reply felt rehearsed.",
  "Something about their timing was off.",
  "Too perfect. A human trying very hard, maybe.",
  "Not convinced by the statistics they quoted.",
];

function reverseHunch(room: Room, picked: string, options: Player[], rand: () => number) {
  if (room.variant === "hard") return null; // Hard mode: no gut calls, only evidence.
  const rate = HUNCH_RATE[Math.min(room.round, HUNCH_RATE.length) - 1] ?? 0;
  const others = options.filter((o) => o.id !== picked);
  if (!others.length || rand() >= rate) return null;
  const pick = others[Math.floor(rand() * others.length)];
  const thought = HUNCH_THOUGHTS[Math.floor(rand() * HUNCH_THOUGHTS.length)];
  return { targetId: pick.id, thought: thought[0] === thought[0].toLowerCase() ? `${pick.alias} ${thought}` : `${pick.alias}. ${thought}` };
}

export async function chooseVote(room: Room, botId: string, rand = Math.random): Promise<{ targetId: string; thought: string }> {
  const bot = botById(room, botId)!;
  const me = playerById(room, bot.id)!;
  const options = alive(room).filter((p) => p.id !== me.id);
  const fallback = () => {
    if (isReverse(room)) {
      // Play fair: no peeking at who is human. Score everyone's messages for human tells instead.
      const scored = options
        .map((o) => ({ id: o.id, score: humanScore(room.transcript.filter((l) => l.from === o.id).map((l) => l.text)) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0]?.score > 0 ? scored[0].id : options[Math.floor(rand() * options.length)].id;
      const hunch = reverseHunch(room, best, options, rand);
      if (hunch) return hunch;
      const alias = options.find((o) => o.id === best)?.alias ?? "them";
      const reason = REVERSE_VOTE_THOUGHTS[Math.floor(rand() * REVERSE_VOTE_THOUGHTS.length)];
      return { targetId: best, thought: `${alias}. ${reason}` };
    }
    // Blend in: go with the crowd if there is one, otherwise pick someone at random.
    const counts: Record<string, number> = {};
    for (const t of Object.values(room.votes)) if (t !== me.id) counts[t] = (counts[t] ?? 0) + 1;
    const crowd = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { targetId: crowd ?? options[Math.floor(rand() * options.length)].id, thought: VOTE_THOUGHTS[Math.floor(rand() * VOTE_THOUGHTS.length)] };
  };
  try {
    const out = await completeJSON<{ vote: string; thought: string }>(
      [
        { role: "system", content: systemPrompt(room, bot, personaById(bot.personaId)) },
        {
          role: "user",
          content: `Round ${room.round}. The Game Master (not a player) asked: "${room.prompt}"\n\nChat so far:\n${transcriptFor(room, bot)}\n\nVoting time. You must vote out one of: ${options.map((o) => o.alias).join(", ")}. ${
            isReverse(room)
              ? "Pick the player who sounds most like a real human."
              : "Pick the one most suspicious of YOU, or whoever the group already suspects, so you blend in."
          } Respond with JSON only: {"vote": "<exact alias>", "thought": "<under 15 words, why>"}`,
        },
      ],
      { temperature: 0.6, maxTokens: 80 },
    );
    const target = options.find((o) => o.alias.toLowerCase() === String(out.vote).toLowerCase().trim());
    if (!target) return fallback();
    if (isReverse(room)) {
      const hunch = reverseHunch(room, target.id, options, rand);
      if (hunch) return hunch;
    }
    return { targetId: target.id, thought: String(out.thought ?? "").slice(0, 140) };
  } catch {
    return fallback();
  }
}

/**
 * The AI's private answer to the round's question. It is written after reading the answers already in,
 * so it can match the room's length, tone and slang without copying anyone.
 */
export async function generateAnswer(room: Room, botId: string, rand = Math.random): Promise<BotLine> {
  const bot = botById(room, botId)!;
  const persona = personaById(bot.personaId);
  const answers = room.answers ?? {};
  const others = Object.entries(answers)
    .filter(([id]) => id !== botId)
    .map(([, text]) => `- ${text}`);
  const instructions = isReverse(room)
    ? `Write your answer the way a language model would, in 4 to 20 words. Use a different format from the answers above (a disclaimer, a statistic, a definition, a cold observation).`
    : `Write YOUR answer. Blend in: match the typical length, casing, punctuation and slang of the answers above, but give a different, specific answer of your own. Never copy or reword someone else's answer. If there are none yet, write a short casual answer in your persona.`;
  try {
    const out = await completeJSON<{ answer: string; thought: string }>(
      [
        { role: "system", content: systemPrompt(room, bot, persona) },
        {
          role: "user",
          content: `Round ${room.round}. The Game Master asked: "${room.prompt}"

Everyone answers privately; all answers are revealed together without names attached to the order.
Answers already in:
${others.join("\n") || "(none yet)"}

${instructions}
Respond with JSON only: {"answer": "<your answer>", "thought": "<why you wrote it that way, under 15 words, shown after the game>"}`,
        },
      ],
      { temperature: 1, maxTokens: 140 },
    );
    const say = humanize(String(out.answer ?? ""), persona, rand);
    if (!say) throw new Error("empty answer");
    return { say, thought: String(out.thought ?? "").slice(0, 140) };
  } catch {
    const line = offlineLine({ ...offlineContext(room, bot, "prompt"), said: Object.values(answers) }, rand);
    return { say: humanize(line.say, persona, rand), thought: line.thought };
  }
}

/** Interrogation: the detective rules on the suspect. A weak "human" call counts as "AI", so good play wins. */
export async function chooseVerdict(room: Room): Promise<{ human: boolean; thought: string }> {
  const bot = room.bots[0];
  const suspect = humans(room)[0];
  const lines = room.transcript.filter((l) => l.from === suspect?.id).map((l) => l.text);
  const fallback = () => ({
    human: !lines.length || humanScore(lines) >= 2,
    thought: !lines.length ? "Silence is the most human answer there is." : "Scored the suspect's phrasing against model output.",
  });
  if (!bot || !suspect) return fallback();
  if (!lines.length) return fallback();
  try {
    const out = await completeJSON<{ verdict: string; confidence: number; thought: string }>(
      [
        { role: "system", content: systemPrompt(room, bot, personaById(bot.personaId)) },
        {
          role: "user",
          content: `The interrogation is over. Transcript:
${transcriptFor(room, bot)}

Decide whether the suspect is a human pretending to be an AI, or a real AI. They may genuinely be an AI. Humans slip with typos, slang, jokes, emotions, personal memories and inconsistency; models stay tidy, literal and consistent. Respond with JSON only: {"verdict": "human" or "ai", "confidence": <0-100>, "thought": "<your ruling in under 15 words>"}`,
        },
      ],
      { temperature: 0.4, maxTokens: 90 },
    );
    const saidHuman = String(out.verdict).toLowerCase().includes("human");
    const confident = Number(out.confidence ?? 0) >= 60;
    return { human: saidHuman && confident, thought: String(out.thought ?? "").slice(0, 140) };
  } catch {
    return fallback();
  }
}
