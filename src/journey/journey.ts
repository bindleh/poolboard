import type { Item, Link, Suggestion } from "../types";
import { isPlaceholderName, normalizeName } from "./shared";

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

function knownCreator(item: Item): string | undefined {
  const name = item.creators[0] ? normalizeName(item.creators[0]) : "";
  return name && !isPlaceholderName(name) ? name : undefined;
}

export interface DiversityCaps {
  perTitle: number;
  perInstitution: number;
  perCreator: number;
}

/** Collections are full of series and single-creator batches; caps keep the suggestions varied. */
export const DEFAULT_CAPS: DiversityCaps = { perTitle: 1, perInstitution: 2, perCreator: 1 };

/** Field-based queries pick on purpose from one creator/institution/collection, so only titles are capped. */
export const EXTRA_CAPS: DiversityCaps = { perTitle: 1, perInstitution: Infinity, perCreator: Infinity };

/**
 * Drops seen items and duplicates, then spreads the result: at most `perTitle` items with
 * the same title, `perCreator` by the same creator and `perInstitution` from the same
 * institution. If that leaves fewer than
 * `limit`, the closest skipped items fill the remaining slots.
 */
export function pickSuggestions(
  candidates: Suggestion[],
  hide: Set<string>,
  limit = SUGGESTIONS_PER_MODE,
  caps: DiversityCaps = DEFAULT_CAPS,
): Suggestion[] {
  const taken = new Set<string>();
  const usable = candidates.filter((c) => {
    if (hide.has(c.item.id) || taken.has(c.item.id) || !c.item.previewImage) return false;
    taken.add(c.item.id);
    return true;
  });

  const titles = new Map<string, number>();
  const institutions = new Map<string, number>();
  const creators = new Map<string, number>();
  const picked = new Set<Suggestion>();
  for (const c of usable) {
    if (picked.size === limit) break;
    const title = c.item.title.trim().toLowerCase();
    const inst = c.item.institution;
    if ((titles.get(title) ?? 0) >= caps.perTitle) continue;
    if (inst && (institutions.get(inst) ?? 0) >= caps.perInstitution) continue;
    const creator = knownCreator(c.item);
    if (creator && (creators.get(creator) ?? 0) >= caps.perCreator) continue;
    titles.set(title, (titles.get(title) ?? 0) + 1);
    if (inst) institutions.set(inst, (institutions.get(inst) ?? 0) + 1);
    if (creator) creators.set(creator, (creators.get(creator) ?? 0) + 1);
    picked.add(c);
  }
  for (const c of usable) {
    if (picked.size === limit) break;
    picked.add(c);
  }
  // Keep the API order (closest first).
  return usable.filter((c) => picked.has(c));
}

/** A journey is saved as a board once it holds at least two items. */
export function isSavable(state: JourneyState): boolean {
  return state.items.length >= 2;
}

export function defaultBoardTitle(_state: JourneyState, _date = new Date()): string {
  return "Unbenanntes Board";
}
