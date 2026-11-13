import "server-only";
import { alive, botById, isReverse, playerById } from "../game/engine";
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
  const addressed = last ? mentionsMe(last.text, me.alias) : false;
  if (addressed) return true;
  if (now - bot.lastSpokeAt < 5000) return false;

  // Keep the bot's share of the conversation close to an average player's share.
  const players = alive(room).length;
  const fairShare = roundLines.length / players;
  if (bot.linesThisRound > fairShare + 1) return false;
  return rand() < persona.chattiness;
}

function mentionsMe(text: string, alias: string) {
  const t = text.toLowerCase();
  const [first, second] = alias.toLowerCase().split(" ");
  return t.includes(first) || t.includes(second) || /\b(bot|ai|robot|chatgpt)\b/.test(t);
}

function transcriptFor(room: Room, bot: BotState) {
  const lines = room.transcript.slice(-30);
  return lines
    .map((l) => {
      const p = playerById(room, l.from);
      const who = p?.id === bot.id ? `${p?.alias} (you)` : p?.alias ?? "someone";
      return `${who}: ${l.text}`;
    })
    .join("\n");
}

function systemPrompt(room: Room, bot: BotState, persona: Persona) {
  const me = playerById(room, bot.id)!;
  const others = alive(room)
    .filter((p) => p.id !== me.id)
    .map((p) => p.alias)
    .join(", ");
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
      `Respond with JSON only: {"say": "<your chat message, or empty string to stay quiet>", "thought": "<your private analysis in under 15 words, shown to players after the game>"}`,
    ].join("\n");
  }
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
  const task =
    trigger === "prompt"
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
          content: `Round ${room.round}. The Game Master (not a player) asked: "${room.prompt}"\n\nChat so far:\n${transcriptFor(room, bot) || "(nobody has said anything yet)"}\n\n${task}`,
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
  const think = trigger === "prompt" ? 6000 + rand() * 12000 : 1500 + rand() * 3500;
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
