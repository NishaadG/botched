import "server-only";

/**
 * Free-tier LLM chain: Groq (fast, human-speed replies) then Gemini.
 * No retries on quota errors: the next provider is tried immediately and
 * callers fall back to canned lines if everything fails.
 */

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Opts {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

async function groq(messages: ChatMsg[], o: Opts) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("groq: no key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages,
      temperature: o.temperature ?? 0.9,
      max_tokens: o.maxTokens ?? 200,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 7000),
  });
  if (!res.ok) throw new Error(`groq: HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("groq: empty");
  return text;
}

async function gemini(messages: ChatMsg[], o: Opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("gemini: no key");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: o.temperature ?? 0.9,
        maxOutputTokens: o.maxTokens ?? 200,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 8000),
  });
  if (!res.ok) throw new Error(`gemini: HTTP ${res.status}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("gemini: empty");
  return text;
}

export async function completeJSON<T>(messages: ChatMsg[], o: Opts = {}): Promise<T> {
  const errors: string[] = [];
  for (const provider of [groq, gemini]) {
    try {
      const raw = await provider(messages, o);
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      return JSON.parse(raw.slice(start, end + 1)) as T;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`All LLM providers failed: ${errors.join("; ")}`);
}
