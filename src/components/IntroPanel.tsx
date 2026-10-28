import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { generate, hasLlmKey } from "../api/llm";
import { buildFacts } from "../exhibition/facts";
import { buildMessages, INTRO_LANGUAGES, parseIntroduction, type IntroLanguage, type Introduction } from "../exhibition/prompt";
import type { Board, Item } from "../types";
import { Button } from "./ui";

const MIN_ITEMS = 2;

interface Props {
  board: Board;
  items: Item[];
}

/** Generates a short introduction for the board; title and text stay editable. */
export function IntroPanel({ board, items }: Props) {
  const [language, setLanguage] = useState<IntroLanguage>("de");
  const [intro, setIntro] = useState<Introduction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A different board starts without the old text; a running request is dropped.
  useEffect(() => {
    abort.current?.abort();
    setIntro(null);
    setError(null);
    setBusy(false);
  }, [board.id]);
  useEffect(() => () => abort.current?.abort(), []);

  const usable = items.filter((i) => !i.removed).length;
  const keyMissing = !hasLlmKey();

  async function run() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    try {
      const answer = await generate(buildMessages(buildFacts(board, items), language), controller.signal);
      const parsed = parseIntroduction(answer);
      if (!parsed) throw new ApiError("Die Antwort hatte nicht das erwartete Format. Bitte noch einmal versuchen.", 502);
      setIntro(parsed);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="border-b border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as IntroLanguage)}
          aria-label="Sprache der Einleitung"
          className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-[15px]"
        >
          {Object.entries(INTRO_LANGUAGES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={run} disabled={busy || keyMissing || usable < MIN_ITEMS}>
          {busy ? "Wird erstellt…" : intro ? "Neu erstellen" : "Einleitung erstellen"}
        </Button>
        {usable < MIN_ITEMS && <span className="text-sm text-neutral-500">Dafür braucht das Board mindestens {MIN_ITEMS} Objekte.</span>}
        {keyMissing && <span className="text-sm text-neutral-500">Kein OpenRouter-Schlüssel gesetzt (siehe .env.example).</span>}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {intro && (
        <div className="mt-3 max-w-3xl">
          <span className="inline-block rounded-full bg-brand-pink text-ink text-[11px] font-medium px-2 py-0.5">KI-generiert</span>
          <input
            value={intro.title}
            onChange={(e) => setIntro({ ...intro, title: e.target.value })}
            aria-label="Titel der Ausstellung"
            className="mt-2 block w-full text-lg font-semibold bg-transparent border-b-2 border-dashed border-neutral-300 focus:outline-none focus:border-brand-pink"
          />
          <textarea
            value={intro.text}
            onChange={(e) => setIntro({ ...intro, text: e.target.value })}
            aria-label="Einleitung"
            rows={5}
            className="mt-2 block w-full resize-y rounded-xl border border-neutral-300 p-3 text-[15px] leading-relaxed focus:outline-none focus:border-brand-pink"
          />
          <p className="mt-1 text-xs text-neutral-500">Der Text kann direkt bearbeitet werden. Bitte gegen die Objekte prüfen.</p>
        </div>
      )}
    </div>
  );
}
