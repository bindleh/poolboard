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
 *     and by keyword. The entity's English and French names are searched by keyword as well, because
 *     some collections (e.g. Albertina prints) have English titles.
 *  4. Merge vector hits (closest first), German keyword hits and then the English/French keyword hits,
 *     without duplicates.
 * Several words skip Wikidata and are searched as typed (by meaning and by keyword); see `isWeak`.
 * If Wikidata is unreachable or rate limited, the plain text search is used instead.
 */

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const WIKIDATA_HEADERS = { "Api-User-Agent": "HackThePool2026-Poolboard/0.1 (student hackathon project)" };

/**
 * Languages in which the typed word is looked up in Wikidata. Wikidata only matches a word against names in
 * the language searched ("perro" finds the dog only with `es`, "cane" only with `it`, "chó" only with `vi`).
 * Every language costs one request, so the list stays short.
 */
const LOOKUP_LANGS = ["de", "en", "fr", "es", "it", "vi"];

/** Measured: good vector matches lie at 0.11–0.14; "butterfly" or "papillon" land above 0.15 (noise). */
export const VECTOR_MAX_DISTANCE = 0.15;
const VECTOR_K = 100; // beyond ~90 hits the distance exceeds VECTOR_MAX_DISTANCE anyway
const KEYWORD_PER_WORD = 150;
/** English and French names of the entity are searched by keyword too: many items carry only English titles. */
const EXTRA_KEYWORD_LANGS = ["en", "fr"];
const EXTRA_KEYWORD_PER_WORD = 100;
/** At most this many items with the same title from the same institution (collections hold many duplicates). */
export const MAX_SAME_TITLE = 2;
/** Fewer good vector matches than this means the query is "weak" (e.g. English sentences). */
export const MIN_GOOD_HITS = 5;

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

/** Wikidata answers bursts of requests with a short block; the same request usually works a few seconds later. */
const WIKIDATA_RETRY_DELAYS_MS = [3000, 8000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `task`; if it fails, waits `delaysMs[i]` and tries again, until the delays are used up. */
export async function withRetry<T>(task: () => Promise<T>, delaysMs: number[], sleep = wait): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delaysMs.length) throw error;
      await sleep(delaysMs[attempt]);
    }
  }
}

/**
 * Runs tasks one after another with a pause between them. Wikidata blocks bursts of parallel requests
 * (HTTP 429), so all Wikidata calls go through one queue instead of firing at once.
 */
export function createSerialQueue(gapMs: number, sleep = wait) {
  let last: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = last.then(task, task);
    last = run.then(
      () => sleep(gapMs),
      () => sleep(gapMs),
    );
    return run;
  };
}

const wikidataQueue = createSerialQueue(400);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wikidata(params: Record<string, string | number>): Promise<any> {
  const url = new URL(WIKIDATA);
  const all = { format: "json", origin: "*", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
  const cached = wikidataCache.get(url.href);
  if (cached) return cached;
  const request = wikidataQueue(() =>
    withRetry(async () => {
      const res = await fetch(url, { headers: WIKIDATA_HEADERS });
      if (!res.ok) throw new Error(`Wikidata ${res.status}`);
      return res.json(); // a rate-limit answer is plain text and makes this throw
    }, WIKIDATA_RETRY_DELAYS_MS),
  );
  wikidataCache.set(url.href, request);
  request.catch(() => wikidataCache.delete(url.href));
  return request;
}

async function lookupCandidates(word: string, lang: string): Promise<WdCandidate[]> {
  const data = await wikidata({
    action: "wbsearchentities",
    search: word,
    language: lang,
    uselang: "de", // descriptions always in German, so NOT_A_CONCEPT can recognise names and works
    limit: 5,
  });
  return data.search ?? [];
}

/**
 * Wikipedia languages with an article are capped here. A taxon or surname can match exactly in every language
 * ("perro" = a genus of spiders, 14 articles) and would beat the dog (333 articles) with a weaker bonus.
 */
const POPULARITY_CAP = 400;

export interface RankedEntity extends WdCandidate {
  score: number;
}

/**
 * Votes over the lookup results of several languages (higher rank = more points), pushes names,
 * places and works down, and adds a popularity bonus: the number of Wikipedia languages with an article
 * (dogs, insects and colours have hundreds, songs, surnames and genera few). The most widely known meaning wins.
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
    entry.score += Math.min(sitelinkCounts.get(entry.id) ?? 0, POPULARITY_CAP) / 10;
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

/** English and French names of the entity (labels only), without the German word and duplicates. */
export function extraKeywordWords(entity: WdEntity | undefined, germanWord: string): string[] {
  const skip = germanWord.toLowerCase();
  return namesOf(entity, EXTRA_KEYWORD_LANGS).filter((name) => name.toLowerCase() !== skip);
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

/**
 * Does Wikidata know the typed word as a name of the chosen entity? If not, the guess may be wrong
 * ("ente" resolves to a family of bacteria, not to the duck), so the typed word is searched as well.
 */
export function isKnownName(names: string[], text: string): boolean {
  return names.includes(text.trim().toLowerCase());
}

// ---------- Several words ----------

/** More than one word: Wikidata only knows single terms ("black cat" would become the band "Black Cat"). */
export function isPhrase(text: string): boolean {
  return text.trim().split(/\s+/).length > 1;
}

/** Fewer than `MIN_GOOD_HITS` close vector matches: the text was probably not understood. */
export function isWeak(goodHits: number): boolean {
  return goodHits < MIN_GOOD_HITS;
}

// ---------- Putting it together ----------

interface Expanded {
  items: Item[];
  /** Short German note for the UI: which words were searched. */
  info: string;
  /** Only for several words: too few close vector matches (a translation to German could help). */
  weak?: boolean;
  /** Wikidata did not answer; the result is not remembered, so the next search asks Wikidata again. */
  degraded?: boolean;
}

const expandedCache = new Map<string, Promise<Expanded>>();

/** Several words: the text is searched as typed, by meaning and by keyword. No Wikidata. */
async function expandPhrase(text: string): Promise<Expanded> {
  const [vectorHits, keywordResult] = await Promise.all([vectorSearch(text), keywordSearch(text, KEYWORD_PER_WORD)]);
  const weak = isWeak(vectorHits.length);
  const items = mergeResults(vectorHits, [keywordResult.items]);
  const hint = weak ? ` Nur ${vectorHits.length} gute Treffer – deutsche Formulierungen funktionieren am besten.` : "";
  return { items, weak, info: `Gesucht nach deinem Text als Ganzes (Stichwort- und Bedeutungssuche).${hint}` };
}

// ---------- What a word means (remembered in the browser) ----------

/** The result of the Wikidata step for one typed word. */
export interface Meaning {
  germanWord: string;
  /** English and French names, searched by keyword only. */
  extraWords: string[];
  /** Wikidata description of the chosen meaning, for the UI note. */
  description?: string;
  /** Names of the chosen entity (labels in the lookup languages, German aliases), lower case. */
  names: string[];
}

const MEANING_STORAGE_KEY = "poolboard.meanings.v2";
const MEANING_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredMeaning extends Meaning {
  savedAt: number;
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): WritableStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined; // storage can be blocked
  }
}

function readAll(store: ReadableStorage): Record<string, StoredMeaning> {
  try {
    const parsed = JSON.parse(store.getItem(MEANING_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** A remembered meaning for this word, unless it is older than 24 hours (a wrong guess must not stick). */
export function readMeaning(store: ReadableStorage | undefined, key: string, now = Date.now()): Meaning | undefined {
  const stored = store ? readAll(store)[key] : undefined;
  if (!stored || typeof stored.germanWord !== "string" || now - stored.savedAt > MEANING_TTL_MS) return undefined;
  return { germanWord: stored.germanWord, extraWords: stored.extraWords ?? [], description: stored.description, names: stored.names ?? [] };
}

export function writeMeaning(store: WritableStorage | undefined, key: string, meaning: Meaning, now = Date.now()): void {
  if (!store) return;
  try {
    const all = readAll(store);
    // keep the storage small: drop expired entries
    for (const [k, v] of Object.entries(all)) if (now - (v?.savedAt ?? 0) > MEANING_TTL_MS) delete all[k];
    all[key] = { ...meaning, savedAt: now };
    store.setItem(MEANING_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the search still works, it just asks Wikidata again next time */
  }
}

/** Steps 1 and 2: which Wikidata entry is meant, and what is its most common German name? */
async function resolveMeaning(text: string): Promise<Meaning> {
  const key = text.toLowerCase();
  const remembered = readMeaning(browserStorage(), key);
  if (remembered) return remembered;

  // 1. Which Wikidata entry is meant? One request per language, one for names and popularity.
  const lists = await Promise.all(LOOKUP_LANGS.map((lang) => lookupCandidates(text, lang)));
  const candidateIds = [...new Set(lists.flat().map((c) => c.id))];
  const entities: Record<string, WdEntity> = candidateIds.length
    ? ((await wikidata({
        action: "wbgetentities",
        ids: candidateIds.join("|"),
        props: "labels|aliases|sitelinks",
        languages: LOOKUP_LANGS.join("|"),
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

  const names = [...namesOf(entity, LOOKUP_LANGS), ...germanNames].map((n) => n.toLowerCase());
  const meaning: Meaning = {
    germanWord,
    extraWords: extraKeywordWords(entity, germanWord),
    description: best?.description,
    names,
  };
  if (entity) writeMeaning(browserStorage(), key, meaning);
  return meaning;
}

const sameWord = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const byDistance = (hits: VectorHit[]) => [...hits].sort((a, b) => a.distance - b.distance).map((h) => h.item);

async function expand(text: string): Promise<Expanded> {
  if (isPhrase(text)) return expandPhrase(text);

  let resolved: Meaning | undefined;
  try {
    resolved = await resolveMeaning(text);
  } catch (error) {
    console.warn("Wikidata not available, searching the typed word directly:", error);
  }

  // Words searched by meaning and by keyword: the German word from Wikidata and, if Wikidata does not
  // know the typed word as a name of that entity (or did not answer), the typed word itself.
  const words: string[] = [];
  if (resolved) words.push(resolved.germanWord);
  if (!resolved || (!isKnownName(resolved.names, text) && !sameWord(resolved.germanWord, text))) words.push(text);

  // English and French names of the same entity are searched by keyword only (the vector search does not
  // understand them) and listed last. They come from the entity, not from the typed text.
  const extraWords = (resolved?.extraWords ?? []).filter((w) => !words.some((x) => sameWord(x, w)));

  const [perWord, extraResults] = await Promise.all([
    Promise.all(
      words.map(async (word) => {
        const [vector, keyword] = await Promise.all([vectorSearch(word), keywordSearch(word, KEYWORD_PER_WORD)]);
        return { word, vector, keyword };
      }),
    ),
    Promise.all(extraWords.map((w) => keywordSearch(w, EXTRA_KEYWORD_PER_WORD))),
  ]);

  // The word with more keyword hits in Kulturpool comes first ("Hund" before "dog", "ente" before "GNEB").
  perWord.sort((a, b) => b.keyword.found - a.keyword.found);
  const items = mergeResults(
    [],
    [...perWord.flatMap((r) => [byDistance(r.vector), r.keyword.items]), ...extraResults.map((r) => r.items)],
  );

  const [first, ...rest] = perWord.map((r) => r.word);
  const meaning = resolved?.description ? ` (Bedeutung: ${resolved.description})` : "";
  let info = `Gesucht nach „${first}“ (Stichwort- und Bedeutungssuche).`;
  if (!resolved) info += " Wikidata ist gerade nicht erreichbar, deshalb nur dein Wort direkt.";
  else if (rest.length && sameWord(first, text)) info += ` Wikidata schlug „${rest[0]}“ vor${meaning}; das wurde danach gesucht.`;
  else if (rest.length) info += ` „${text}“ wurde als „${first}“ erkannt${meaning}; dein Wort wurde danach direkt gesucht.`;
  else if (!sameWord(first, text)) info += ` „${text}“ wurde als „${first}“ erkannt${meaning}.`;
  if (extraWords.length) info += ` Zusätzlich nach Titeln in anderen Sprachen: ${extraWords.map((w) => `„${w}“`).join(", ")}.`;
  return { items, info, degraded: !resolved };
}

/**
 * Drop-in replacement for `searchItems` with the same paging: the full merged list is built once per
 * text and then sliced into pages. Falls back to the plain search if Wikidata is not available.
 */
export async function searchItemsMultilingual(
  text: string,
  page = 1,
  perPage = 24,
): Promise<TextSearchResult & { info?: string; weak?: boolean }> {
  const key = text.trim().toLowerCase();
  let expanded = expandedCache.get(key);
  if (!expanded) {
    expanded = expand(text.trim());
    expandedCache.set(key, expanded);
    expanded.catch(() => expandedCache.delete(key));
  }
  try {
    const { items, info, weak, degraded } = await expanded;
    if (degraded) expandedCache.delete(key); // do not keep a result that was made without Wikidata
    const start = (page - 1) * perPage;
    return { items: items.slice(start, start + perPage), found: items.length, info, weak };
  } catch (error) {
    console.warn("Multilingual search failed, using the plain text search:", error);
    const plain = await searchItems(text, page, perPage);
    return { ...plain, info: "Mehrsprachige Suche gerade nicht verfügbar – normale Textsuche." };
  }
}
