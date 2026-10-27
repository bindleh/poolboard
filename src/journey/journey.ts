import type { Item, Link, Suggestion } from "../types";

export const MAX_ITEMS = 20;
export const SUGGESTIONS_PER_MODE = 10;

export interface JourneyState {
  items: Item[];
  /** links[i] connects items[i] to items[i + 1]. */
  links: Link[];
  /** Ids of every item that was added or already shown as suggestion. */
  seen: string[];
}

export type JourneyAction =
  | { type: "start"; item: Item }
  | { type: "add"; item: Item; link: Link }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "markSeen"; ids: string[] };

export const emptyJourney: JourneyState = { items: [], links: [], seen: [] };

export function isFull(state: JourneyState): boolean {
  return state.items.length >= MAX_ITEMS;
}

function withSeen(seen: string[], ids: string[]): string[] {
  const set = new Set(seen);
  ids.forEach((id) => set.add(id));
  return [...set];
}

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case "start":
      return { items: [action.item], links: [], seen: [action.item.id] };
    case "add":
      if (isFull(state) || state.items.length === 0) return state;
      if (state.items.some((i) => i.id === action.item.id)) return state;
      return {
        items: [...state.items, action.item],
        links: [...state.links, action.link],
        seen: withSeen(state.seen, [action.item.id]),
      };
    case "undo":
      if (state.items.length <= 1) return state;
      // The removed item stays in `seen` so it is not offered again right away.
      return { ...state, items: state.items.slice(0, -1), links: state.links.slice(0, -1) };
    case "reset":
      return emptyJourney;
    case "markSeen":
      return { ...state, seen: withSeen(state.seen, action.ids) };
  }
}

/** Drops seen items and duplicates, keeps the closest `limit` suggestions. */
export function pickSuggestions(
  candidates: Suggestion[],
  hide: Set<string>,
  limit = SUGGESTIONS_PER_MODE,
): Suggestion[] {
  const out: Suggestion[] = [];
  const taken = new Set<string>();
  for (const c of candidates) {
    if (hide.has(c.item.id) || taken.has(c.item.id) || !c.item.previewImage) continue;
    taken.add(c.item.id);
    out.push(c);
    if (out.length === limit) break;
  }
  return out;
}

/** A journey is saved as a board once it holds at least two items. */
export function isSavable(state: JourneyState): boolean {
  return state.items.length >= 2;
}

export function defaultBoardTitle(state: JourneyState, date = new Date()): string {
  const first = state.items[0]?.title ?? "Reise";
  const short = first.length > 40 ? `${first.slice(0, 37)}…` : first;
  return `${short} · ${date.toLocaleDateString("de-AT")}`;
}
