import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import { generate, hasLlmKey } from "../api/llm";
import { buildFacts } from "../exhibition/facts";
import { buildMessages, INTRO_LANGUAGES, parseIntroduction, type IntroLanguage } from "../exhibition/prompt";
import type { Board, BoardIntroduction, Item } from "../types";
import { Button } from "./ui";

const MIN_ITEMS = 2;

interface Props {
  board: Board;
  items: Item[];
  /** Called when an introduction was generated; it is stored with the board per language. */
  onChange: (language: string, introduction: BoardIntroduction) => void;
}

/** Generates a short introduction per language; a language that already has one is only shown, never regenerated. */
export function IntroPanel({ board, items, onChange }: Props) {
  const [language, setLanguage] = useState<IntroLanguage>("de");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BoardIntroduction | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A different board starts hidden; a running request is dropped.
  useEffect(() => {
    abort.current?.abort();
    setVisible(false);
    setDraft(null);
    setError(null);
    setBusy(false);
  }, [board.id]);
  useEffect(() => () => abort.current?.abort(), []);

  const stored = board.introductions?.[language];
  const usable = items.filter((i) => !i.removed).length;
  const keyMissing = !hasLlmKey();

  function selectLanguage(next: IntroLanguage) {
    abort.current?.abort();
    setLanguage(next);
    // An existing text for the chosen language is shown right away.
    setVisible(Boolean(board.introductions?.[next]));
    setDraft(null);
    setError(null);
    setBusy(false);
  }

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
      onChange(language, parsed);
      setVisible(true);
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
          onChange={(e) => selectLanguage(e.target.value as IntroLanguage)}
          aria-label="Sprache der Einleitung"
          className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-[15px]"
        >
          {Object.entries(INTRO_LANGUAGES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
              {board.introductions?.[code] ? " ✓" : ""}
            </option>
          ))}
        </select>
        {stored ? (
          <Button
            onClick={() => {
              setVisible((v) => !v);
              setDraft(null);
            }}
            aria-expanded={visible}
          >
            {visible ? "Ausblenden" : "Anzeigen"}
          </Button>
        ) : (
          <Button variant="primary" onClick={run} disabled={busy || keyMissing || usable < MIN_ITEMS}>
            {busy ? "Wird erstellt…" : "Einleitung erstellen"}
          </Button>
        )}
        {!stored && usable < MIN_ITEMS && (
          <span className="text-sm text-neutral-500">Dafür braucht das Board mindestens {MIN_ITEMS} Objekte.</span>
        )}
        {!stored && keyMissing && (
          <span className="text-sm text-neutral-500">Kein OpenRouter-Schlüssel gesetzt (siehe .env.example).</span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {stored && visible && (
        <div className="mt-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="inline-block rounded-full bg-brand-pink text-ink text-[11px] font-medium px-2 py-0.5">KI-generiert</span>
            {!draft && (
              <button
                type="button"
                onClick={() => setDraft({ ...stored })}
                className="cursor-pointer rounded-lg border border-neutral-300 px-2 py-0.5 text-xs font-medium hover:border-ink"
              >
                Bearbeiten
              </button>
            )}
          </div>
          {draft ? (
            <>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label="Titel der Ausstellung"
                className="mt-2 block w-full text-lg font-semibold bg-transparent border-b-2 border-dashed border-neutral-300 focus:outline-none focus:border-brand-pink"
              />
              <textarea
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                aria-label="Einleitung"
                rows={6}
                className="mt-2 block w-full resize-y rounded-xl border border-neutral-300 p-3 text-[15px] leading-relaxed focus:outline-none focus:border-brand-pink"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    onChange(language, { title: draft.title.trim() || stored.title, text: draft.text });
                    setDraft(null);
                  }}
                >
                  Speichern
                </Button>
                <Button onClick={() => setDraft(null)}>Abbrechen</Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-lg font-semibold">{stored.title}</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{stored.text}</p>
              <p className="mt-1 text-xs text-neutral-500">Bitte gegen die Objekte prüfen.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
