import type { ChatMessage } from "../exhibition/prompt";
import { ApiError } from "./client";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

// Demo only: a key in VITE_* ends up in the browser bundle and is readable by anyone who
// opens the page. For a public site this call has to move behind a small proxy; only this
// file would change.
const apiKey = () => import.meta.env.VITE_OPENROUTER_API_KEY;

export const hasLlmKey = () => Boolean(apiKey());

/** Sends the messages to OpenRouter and returns the answer text. */
export async function generate(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const key = apiKey();
  if (!key) throw new ApiError("Kein OpenRouter-Schlüssel gesetzt (VITE_OPENROUTER_API_KEY in .env.local).", 0);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENROUTER_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 6000,
        // Models that think first can use up the whole budget before writing; keep it short.
        reasoning: { effort: "low" },
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("OpenRouter ist gerade nicht erreichbar.", 0);
  }
  if (res.status === 401) throw new ApiError("OpenRouter hat den Schlüssel abgelehnt (401).", 401);
  if (res.status === 429) throw new ApiError("OpenRouter: zu viele Anfragen, bitte kurz warten (429).", 429);
  if (!res.ok) throw new ApiError(`OpenRouter-Fehler (${res.status})`, res.status);
  const data = await res.json();
  const content: unknown = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    // Say why: an error object in the body, or the finish reason (e.g. "length" = token limit used up).
    const why = data.error?.message ?? data.choices?.[0]?.finish_reason ?? data.choices?.[0]?.error?.message;
    throw new ApiError(`OpenRouter hat keinen Text geliefert${why ? ` (${why})` : ""}.`, 502);
  }
  return content;
}
