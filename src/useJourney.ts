import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ApiError, fetchRandomItem, fetchSimilar } from "./api/client";
import { emptyJourney, journeyReducer, pickSuggestions } from "./journey/journey";
import { sharedFields } from "./journey/shared";
import type { Item, Link, LinkKind, Suggestion } from "./types";
import { errorMessage } from "./util";

export type RowState =
  | { status: "loading" }
  | { status: "ok"; suggestions: Suggestion[] }
  | { status: "error"; message: string };

export type Rows = Record<LinkKind, RowState>;

const LOADING: Rows = { metadata: { status: "loading" }, image: { status: "loading" } };

function rowError(e: unknown, kind: LinkKind): string {
  if (e instanceof ApiError) {
    if (e.status === 400 && kind === "image") return "Für dieses Objekt gibt es keine Bildähnlichkeit.";
    if (e.status === 429) return `Zu viele Anfragen. Bitte in ${e.retryAfter ?? 10} Sekunden erneut versuchen.`;
    if (e.status === 503) return "Kulturpool ist gerade überlastet. Bitte erneut versuchen.";
  }
  return errorMessage(e);
}

export function useJourney() {
  const [state, dispatch] = useReducer(journeyReducer, emptyJourney);
  const [rows, setRows] = useState<Rows>(LOADING);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const cache = useRef(new Map<string, Rows>());
  const seenRef = useRef(state.seen);
  seenRef.current = state.seen;
  const startingRef = useRef(false);

  const current: Item | undefined = state.items[state.items.length - 1];
  const currentId = current?.id;

  const startRandom = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const item = await fetchRandomItem();
      cache.current.clear();
      dispatch({ type: "start", item });
    } catch (e) {
      setStartError(errorMessage(e));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!currentId) return;
    const cached = cache.current.get(currentId);
    if (cached) {
      setRows(cached);
      return;
    }
    let cancelled = false;
    setRows(LOADING);
    const hide = new Set(seenRef.current);

    const options = { excludeInstitution: current?.institution };
    Promise.allSettled([
      fetchSimilar(currentId, "metadata", options),
      fetchSimilar(currentId, "image", options),
    ]).then(
      ([m, i]) => {
        if (cancelled) return;
        const next: Rows = { metadata: { status: "loading" }, image: { status: "loading" } };
        const shown: string[] = [];

        let metadataIds = new Set<string>();
        if (m.status === "fulfilled") {
          const suggestions = pickSuggestions(m.value, hide);
          metadataIds = new Set(suggestions.map((s) => s.item.id));
          next.metadata = { status: "ok", suggestions };
          shown.push(...metadataIds);
        } else {
          next.metadata = { status: "error", message: rowError(m.reason, "metadata") };
        }

        if (i.status === "fulfilled") {
          const suggestions = pickSuggestions(i.value, new Set([...hide, ...metadataIds]));
          next.image = { status: "ok", suggestions };
          shown.push(...suggestions.map((s) => s.item.id));
        } else {
          next.image = { status: "error", message: rowError(i.reason, "image") };
        }

        if (next.metadata.status === "ok" && next.image.status === "ok") cache.current.set(currentId, next);
        dispatch({ type: "markSeen", ids: shown });
        setRows(next);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [currentId, reloadKey]);

  const retry = useCallback(() => {
    if (currentId) cache.current.delete(currentId);
    setReloadKey((k) => k + 1);
  }, [currentId]);

  const add = useCallback(
    (suggestion: Suggestion, kind: LinkKind) => {
      if (!current) return;
      const link: Link = {
        fromId: current.id,
        toId: suggestion.item.id,
        kind,
        distance: suggestion.distance,
        shared: kind === "metadata" ? sharedFields(current, suggestion.item) : [],
      };
      dispatch({ type: "add", item: suggestion.item, link });
    },
    [current],
  );

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const reset = useCallback(() => {
    cache.current.clear();
    dispatch({ type: "reset" });
  }, []);

  return { state, current, rows, starting, startError, startRandom, add, undo, reset, retry };
}
