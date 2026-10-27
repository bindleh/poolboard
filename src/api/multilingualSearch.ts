import type { Item } from "../types";
import { get, IMAGE_FILTER, searchItems, toItem, type TextSearchResult } from "./client";

/**
 * Multilingual text search for the journey start.
 *
 * Kulturpool matches words exactly and most metadata is German, so "blue" finds far less than "blau".
 * Wikidata knows that both mean the same thing. Steps:
 *  1. Find the Wikidata entry the word means (most likely meaning wins, see `rankEntities`).
 *  2. Take its most common German name. Kulturpool's metadata is German and its vector search
 *     (`query_by=metadataEmbedding`) only understands German well, so this word drives everything:
 *     the same entry gives the same result whatever language was typed.
 *  3. Search with that word by meaning (weak vector matches are dropped, `VECTOR_MAX_DISTANCE`)
 *     and by keyword.
 *  4. Merge vector hits (closest first) and keyword hits, without duplicates.
 * If Wikidata is unreachable or rate limited, the plain text search is used instead.
 */

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const WIKIDATA_HEADERS = { "Api-User-Agent": "HackThePool2026-Poolboard/0.1 (student hackathon project)" };

/** Languages in which the typed word is looked up in Wikidata (fewer requests). */
const LOOKUP_LANGS = ["de", "en", "fr"];

/** Measured: good vector matches lie at 0.11–0.14; "butterfly" or "papillon" land above 0.15 (noise). */
export const VECTOR_MAX_DISTANCE = 0.15;
const VECTOR_K = 100; // beyond ~90 hits the distance exceeds VECTOR_MAX_DISTANCE anyway
const KEYWORD_PER_WORD = 24;
/** At most this many items with the same title from the same institution (collections hold many duplicates). */
export const MAX_SAME_TITLE = 2;

/** Descriptions that point to a name, place or work instead of a concept ("Blue" = boy band). */
const NOT_A_CONCEPT =
  /family name|given name|surname|\bband\b|album|\bsong\b|\bfilm\b|village|commune|municipality|video game|streamer|vocal track|Familienname|Vorname|Gruppe|Dorf|Gemeinde|Ort in|Spielfilm|Lied|nom de famille|prénom|chanson/i;

// ---------- Wikidata ----------

interface WdCandidate {
  id: string;
  label?: string;
  description?: string;
}

interface WdEntity {
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  sitelinks?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wikidataCache = new Map<string, Promise<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wikidata(params: Record<string, string | number>): Promise<any> {
  const url = new URL(WIKIDATA);
  const all = { format: "json", origin: "*", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
  const cached = wikidataCache.get(url.href);
  if (cached) return cached;
  const request = fetch(url, { headers: WIKIDATA_HEADERS }).then((res) => {
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    return res.json(); // a rate-limit answer is plain text and makes this throw
  });
  wikidataCache.set(url.href, request);
  request.catch(() => wikidataCache.delete(url.href));
  return request;
}

async function lookupCandidates(word: string, lang: string): Promise<WdCandidate[]> {
  const data = await wikidata({
    action: "wbsearchentities",
    search: word,
    language: lang,
    uselang: lang,
    limit: 5,
  });
  return data.search ?? [];
}

export interface RankedEntity extends WdCandidate {
  score: number;
}

/**
 * Votes over the lookup results of several languages (higher rank = more points), pushes names,
 * places and works down, and adds a popularity bonus: the number of Wikipedia languages with an article
 * (insects and colours have many, songs and surnames few).
 */
export function rankEntities(lists: WdCandidate[][], sitelinkCounts: Map<string, number>): RankedEntity[] {
  const votes = new Map<string, RankedEntity>();
  for (const list of lists) {
    list.forEach((c, rank) => {
      const entry = votes.get(c.id) ?? { id: c.id, label: c.label, description: c.description, score: 0 };
      entry.score += 5 - rank;
      if (NOT_A_CONCEPT.test(c.description ?? "")) entry.score -= 10;
      votes.set(c.id, entry);
    });
  }
  for (const entry of votes.values()) {
    entry.score += Math.min(sitelinkCounts.get(entry.id) ?? 0, 100) / 10;
  }
  return [...votes.values()].sort((a, b) => b.score - a.score);
}

/** Labels (and optionally aliases) of the entity in the given languages, original spelling, no duplicates. */
export function namesOf(entity: WdEntity | undefined, langs: string[], withAliases = false): string[] {
  const names: string[] = [];
  for (const lang of langs) {
    if (entity?.labels?.[lang]) names.push(entity.labels[lang].value);
    // Aliases add noise ("lam", "marine"); they are only used to find the common German word.
    if (withAliases) (entity?.aliases?.[lang] ?? []).forEach((a) => names.push(a.value));
  }
  const seen = new Set<string>();
  return names.filter((n) => !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

/**
 * The German name that is most common in Kulturpool ("Schmetterling" 1963 hits, "Tagfalter" 11).
 * Case is kept: the vector search distinguishes "Schmetterling" from "schmetterling".
 */
export function pickGermanWord(names: string[], hitCounts: Map<string, number>): string | undefined {
  const counted = names
    .map((name) => ({ name, found: hitCounts.get(name) ?? 0 }))
    .filter((c) => c.found > 0)
    .sort((a, b) => b.found - a.found);
  return counted[0]?.name;
}

// ---------- Kulturpool ----------

interface VectorHit {
  item: Item;
  distance: number;
}

async function keywordSearch(word: string, perPage: number): Promise<{ items: Item[]; found: number }> {
  const data = await get("/v2/search", { q: word, facet_by: "", per_page: perPage, filter_by: IMAGE_FILTER });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { items: (data.hits ?? []).map((h: any) => toItem(h.document)), found: data.found ?? 0 };
}

async function vectorSearch(word: string): Promise<VectorHit[]> {
  const data = await get("/v2/search", {
    q: word,
    query_by: "metadataEmbedding",
    facet_by: "",
    per_page: VECTOR_K,
    filter_by: IMAGE_FILTER,
  });
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data.hits ?? []).map((h: any) => ({ item: toItem(h.document), distance: h.vector_distance as number }))
  ).filter((h: VectorHit) => h.distance <= VECTOR_MAX_DISTANCE);
}

/** Vector hits first (closest first), then keyword hits; drops duplicates and caps same-title series. */
export function mergeResults(vectorHits: VectorHit[], keywordLists: Item[][], maxSameTitle = MAX_SAME_TITLE): Item[] {
  const seen = new Set<string>();
  const perTitle = new Map<string, number>();
  const merged: Item[] = [];
  const add = (item: Item) => {
    if (seen.has(item.id)) return;
    const key = `${item.institution}|${item.title.toLowerCase()}`;
    if ((perTitle.get(key) ?? 0) >= maxSameTitle) return;
    perTitle.set(key, (perTitle.get(key) ?? 0) + 1);
    seen.add(item.id);
    merged.push(item);
  };
  [...vectorHits].sort((a, b) => a.distance - b.distance).forEach((h) => add(h.item));
  keywordLists.forEach((list) => list.forEach(add));
  return merged;
}

// ---------- Putting it together ----------

interface Expanded {
  items: Item[];
  /** Short German note for the UI: which words were searched. */
  info: string;
}

const expandedCache = new Map<string, Promise<Expanded>>();

async function expand(text: string): Promise<Expanded> {
  // 1. Which Wikidata entry is meant? One request per language, one for names and popularity.
  const lists = await Promise.all(LOOKUP_LANGS.map((lang) => lookupCandidates(text, lang)));
  const candidateIds = [...new Set(lists.flat().map((c) => c.id))];
  const entities: Record<string, WdEntity> = candidateIds.length
    ? ((await wikidata({
        action: "wbgetentities",
        ids: candidateIds.join("|"),
        props: "labels|aliases|sitelinks",
        languages: "de",
      })).entities ?? {})
    : {};
  const sitelinkCounts = new Map(candidateIds.map((id) => [id, Object.keys(entities[id]?.sitelinks ?? {}).length]));
  const best = rankEntities(lists, sitelinkCounts)[0];
  const entity = best ? entities[best.id] : undefined;

  // 2. German word: the most common German name of the entity (label and aliases), else the typed text.
  const germanNames = namesOf(entity, ["de"], true);
  const germanCandidates = germanNames.length ? germanNames : [text];
  const counts = new Map<string, number>();
  await Promise.all(
    germanCandidates.map(async (name) => counts.set(name, (await keywordSearch(name, 1)).found)),
  );
  const germanWord = pickGermanWord(germanCandidates, counts) ?? text;

  // 3. Only the German word is searched, by meaning and by keyword. Keyword searches with the names in
  //    other languages add noise ("butterfly" finds the opera Madame Butterfly) and make the result depend
  //    on the language that was typed.
  const [vectorHits, keywordResult] = await Promise.all([vectorSearch(germanWord), keywordSearch(germanWord, KEYWORD_PER_WORD)]);

  const items = mergeResults(vectorHits, [keywordResult.items]);
  const meaning = best?.description ? ` (Bedeutung: ${best.description})` : "";
  const typedNote = germanWord.toLowerCase() === text.toLowerCase() ? "" : ` „${text}“ wurde als „${germanWord}“ erkannt${meaning}.`;
  const info = `Gesucht nach „${germanWord}“ (Stichwort- und Bedeutungssuche).${typedNote}`;
  return { items, info };
}

/**
 * Drop-in replacement for `searchItems` with the same paging: the full merged list is built once per
 * text and then sliced into pages. Falls back to the plain search if Wikidata is not available.
 */
export async function searchItemsMultilingual(
  text: string,
  page = 1,
  perPage = 24,
): Promise<TextSearchResult & { info?: string }> {
  const key = text.trim().toLowerCase();
  let expanded = expandedCache.get(key);
  if (!expanded) {
    expanded = expand(text.trim());
    expandedCache.set(key, expanded);
    expanded.catch(() => expandedCache.delete(key));
  }
  try {
    const { items, info } = await expanded;
    const start = (page - 1) * perPage;
    return { items: items.slice(start, start + perPage), found: items.length, info };
  } catch {
    const plain = await searchItems(text, page, perPage);
    return { ...plain, info: "Mehrsprachige Suche gerade nicht verfügbar – normale Textsuche." };
  }
}
