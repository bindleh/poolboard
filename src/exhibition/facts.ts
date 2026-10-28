import { describeShared } from "../journey/shared";
import type { Board, Item } from "../types";

export interface FactObject {
  nr: number;
  title: string;
  creators: string[];
  date?: string;
  type?: string;
  institution?: string;
  subjects: string[];
  description?: string;
}

export interface FactLink {
  /** 1-based numbers of the two connected objects. */
  from: number;
  to: number;
  kind: "Metadaten" | "Bild";
  /** Fields shared by the two objects (metadata links only), already worded for the prompt. */
  shared: string;
}

export interface BoardFacts {
  count: number;
  objects: FactObject[];
  commonSubjects: { subject: string; count: number }[];
  years: { from: number; to: number } | null;
  institutions: { name: string; count: number }[];
  types: { name: string; count: number }[];
  links: FactLink[];
}

const MAX_DESCRIPTION = 300;

/** Calendar year of a unix timestamp. Not `yearOf` from shared.ts: that rounds, so 31 Dec 1970 would become 1971. */
const calendarYear = (seconds: number) => new Date(seconds * 1000).getUTCFullYear();

function tally(values: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function shortText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const flat = text.split(/\s+/).join(" ").trim();
  if (!flat) return undefined;
  return flat.length <= MAX_DESCRIPTION ? flat : flat.slice(0, MAX_DESCRIPTION - 1).trimEnd() + "…";
}

/**
 * Facts for the introduction, computed from the board only. The LLM later gets nothing
 * else, so everything it may say has to be in here. Removed items are left out.
 */
export function buildFacts(board: Board, items: Item[] = board.items, now = new Date().getFullYear()): BoardFacts {
  const kept = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.removed);
  const nrOf = new Map(kept.map(({ index }, i) => [index, i + 1]));

  const objects: FactObject[] = kept.map(({ item }, i) => ({
    nr: i + 1,
    title: item.title,
    creators: item.creators,
    date: item.dates[0],
    type: item.types[0],
    institution: item.institution || undefined,
    subjects: item.subjects ?? [],
    description: shortText(item.description[0]),
  }));

  const commonSubjects = tally(kept.flatMap(({ item }) => [...new Set(item.subjects ?? [])]))
    .filter((s) => s.count >= 2)
    .slice(0, 6)
    .map(({ name, count }) => ({ subject: name, count }));

  const years = kept
    .flatMap(({ item }) => [item.dateMin, item.dateMax])
    .filter((s): s is number => s != null)
    .map(calendarYear)
    .filter((y) => y >= 1000 && y <= now);

  // links[i] connects items[i] to items[i + 1]; skip links that touch a removed item.
  const links: FactLink[] = [];
  board.links.slice(0, items.length - 1).forEach((link, i) => {
    const from = nrOf.get(i);
    const to = nrOf.get(i + 1);
    if (!from || !to || (link.kind !== "metadata" && link.kind !== "image")) return;
    links.push({
      from,
      to,
      kind: link.kind === "image" ? "Bild" : "Metadaten",
      shared: link.kind === "metadata" ? describeShared(link.shared) : "",
    });
  });

  return {
    count: objects.length,
    objects,
    commonSubjects,
    years: years.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
    institutions: tally(kept.map(({ item }) => item.institution).filter(Boolean)),
    types: tally(kept.map(({ item }) => item.types[0]).filter(Boolean)),
    links,
  };
}
