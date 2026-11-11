import "server-only";
import { alive, playerById } from "../game/engine";
import type { Room } from "../game/types";
import { completeJSON } from "./llm";
import { offlineLine, promptIndexOf, VOTE_THOUGHTS } from "./offline";
import { personaById, type Persona } from "./personas";

/**
 * The hidden player. Decides IF it should talk (humans don't answer every line),
 * WHAT to say (LLM, in persona), and WHEN (thinking pause + typing time).
 */

export function shouldReply(room: Room, trigger: "prompt" | "reply" | "nudge", now: number, rand = Math.random) {
  const bot = room.bot;
  if (!bot || room.phase !== "chat") return false;
  if (bot.plan || (bot.thinkingSince && now - bot.thinkingSince < 15000)) return false;
  const me = playerById(room, bot.id);
  if (!me?.alive) return false;
  if (trigger === "prompt") return true;

  const persona = personaById(bot.personaId);
  const roundLines = room.transcript.filter((l) => l.round === room.round);
  const last = roundLines.at(-1);
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

function transcriptFor(room: Room) {
  const lines = room.transcript.slice(-30);
  return lines
    .map((l) => {
      const p = playerById(room, l.from);
      const who = p?.id === room.bot?.id ? `${p?.alias} (you)` : p?.alias ?? "someone";
      return `${who}: ${l.text}`;
    })
    .join("\n");
}

function systemPrompt(room: Room, persona: Persona) {
  const me = playerById(room, room.bot!.id)!;
  const others = alive(room)
    .filter((p) => p.id !== me.id)
    .map((p) => p.alias)
    .join(", ");
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

export async function generateLine(room: Room, trigger: "prompt" | "reply" | "nudge", rand = Math.random): Promise<BotLine> {
  const persona = personaById(room.bot!.personaId);
  const task =
    trigger === "prompt"
      ? `The Game Master just asked everyone: "${room.prompt}". Answer it in character.`
      : `Continue the conversation naturally. Respond to the latest messages if it makes sense.`;
  try {
    const out = await completeJSON<BotLine>(
      [
        { role: "system", content: systemPrompt(room, persona) },
        {
          role: "user",
          content: `Round ${room.round}. Prompt: "${room.prompt}"\n\nChat so far:\n${transcriptFor(room) || "(nobody has said anything yet)"}\n\n${task}`,
        },
      ],
      { temperature: 1, maxTokens: 160 },
    );
    return { say: humanize(String(out.say ?? ""), persona, rand), thought: String(out.thought ?? "").slice(0, 140) };
  } catch {
    const line = offlineLine(offlineContext(room, trigger), rand);
    return { say: humanize(line.say, persona, rand), thought: line.thought };
  }
}

function offlineContext(room: Room, trigger: "prompt" | "reply" | "nudge") {
  const bot = room.bot!;
  const me = playerById(room, bot.id)!;
  const lastLine = [...room.transcript].reverse().find((l) => l.from !== bot.id && l.round === room.round);
  const lastFrom = lastLine ? playerById(room, lastLine.from) : undefined;
  return {
    promptIndex: promptIndexOf(room.prompt),
    trigger,
    myAlias: me.alias,
    last: lastLine && lastFrom ? { alias: lastFrom.alias, text: lastLine.text } : undefined,
    others: alive(room)
      .filter((p) => p.id !== bot.id)
      .map((p) => p.alias),
    said: room.transcript.filter((l) => l.from === bot.id).map((l) => l.text),
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

export async function chooseVote(room: Room, rand = Math.random): Promise<{ targetId: string; thought: string }> {
  const me = playerById(room, room.bot!.id)!;
  const options = alive(room).filter((p) => p.id !== me.id);
  const fallback = () => {
    // Blend in: go with the crowd if there is one, otherwise pick someone at random.
    const counts: Record<string, number> = {};
    for (const t of Object.values(room.votes)) if (t !== me.id) counts[t] = (counts[t] ?? 0) + 1;
    const crowd = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { targetId: crowd ?? options[Math.floor(rand() * options.length)].id, thought: VOTE_THOUGHTS[Math.floor(rand() * VOTE_THOUGHTS.length)] };
  };
  try {
    const out = await completeJSON<{ vote: string; thought: string }>(
      [
        { role: "system", content: systemPrompt(room, personaById(room.bot!.personaId)) },
        {
          role: "user",
          content: `Chat so far:\n${transcriptFor(room)}\n\nVoting time. You must vote out one of: ${options.map((o) => o.alias).join(", ")}. Pick the one most suspicious of YOU, or whoever the group already suspects, so you blend in. Respond with JSON only: {"vote": "<exact alias>", "thought": "<under 15 words, why>"}`,
        },
      ],
      { temperature: 0.6, maxTokens: 80 },
    );
    const target = options.find((o) => o.alias.toLowerCase() === String(out.vote).toLowerCase().trim());
    return target ? { targetId: target.id, thought: String(out.thought ?? "").slice(0, 140) } : fallback();
  } catch {
    return fallback();
  }
}
