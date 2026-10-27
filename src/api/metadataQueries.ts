import { isPlaceholderName, normalizeName } from "../journey/shared";
import type { Item, Suggestion } from "../types";
import { fetchSimilar, IMAGE_FILTER, searchSuggestions, type SimilarOptions } from "./client";

/**
 * Queries behind the "Inhaltlich ähnlich" row.
 *
 * Row layout (15 slots): the first MAIN_METADATA.count come from the main similarity query,
 * then every entry of EXTRA_METADATA_QUERIES fills its `count` slots in the listed order.
 * Slots an extra query cannot fill (field missing, no results, request failed) are topped up
 * from further results of the main query, so the row always reaches its full size if possible.
 *
 * Results are deduplicated across queries (earlier wins), filtered for already seen items and
 * cut to `count` in useJourney.ts. To add a query, append an entry to EXTRA_METADATA_QUERIES:
 * `fetch` gets the current item and the shared options and returns Suggestion[].
 *
 * Building blocks: fetchSimilar (vector similarity with filterBy/threshold) and
 * searchSuggestions (plain search) from api/client.ts, randomMatching below.
 */
export interface MetadataQuery {
  name: string;
  count: number;
  fetch: (item: Item, options: SimilarOptions) => Promise<Suggestion[]>;
}

/** The existing similarity query; its first results lead the row and it tops up gaps. */
export const MAIN_METADATA = {
  count: 5,
  fetch: (id: string, options: SimilarOptions) => fetchSimilar(id, "metadata", options),
};

const FIVE_YEARS = 157_788_000; // seconds; Kulturpool stores dateMin/dateMax as unix seconds
const MAX_DATING_SPAN = 20 * 31_556_952; // ignore vague datings like "19. Jahrhundert"

/** Backtick-quoted value for a Typesense filter. */
const quote = (v: string) => `\`${v.replace(/`/g, "")}\``;

/** field:=[`a`,`b`] for up to three values; undefined if there is nothing to filter on. */
function anyOf(field: string, values: string[] | undefined): string | undefined {
  const list = (values ?? []).filter(Boolean).slice(0, 3);
  return list.length ? `${field}:=[${list.map(quote).join(",")}]` : undefined;
}

const knownNames = (names: string[] | undefined) =>
  (names ?? []).filter((n) => !isPlaceholderName(normalizeName(n)));

/** Random items (with image, not the current one) that match every given filter part. */
async function randomMatching(item: Item, ...parts: (string | undefined)[]): Promise<Suggestion[]> {
  if (parts.some((p) => !p)) return [];
  return searchSuggestions({
    q: "*",
    sort_by: "_rand()",
    use_cache: "false",
    per_page: 40,
    filter_by: [IMAGE_FILTER, `id:!=${item.id}`, ...parts].join(" && "),
  });
}

export const EXTRA_METADATA_QUERIES: MetadataQuery[] = [
  {
    name: "Gleiche Zeit",
    count: 1,
    fetch: (item) => {
      const { dateMin, dateMax } = item;
      if (dateMin == null || dateMax == null || dateMax - dateMin > MAX_DATING_SPAN) return Promise.resolve([]);
      return randomMatching(item, `dateMin:>=${dateMin - FIVE_YEARS}`, `dateMax:<=${dateMax + FIVE_YEARS}`);
    },
  },
  {
    name: "Gleiche:r Künstler:in",
    count: 3,
    fetch: (item) =>
      randomMatching(item, anyOf("creator", knownNames(item.creators)), `title:!=${quote(item.title)}`),
  },
  {
    name: "Mitwirkende:r ist anderswo Künstler:in",
    count: 1,
    fetch: (item) => randomMatching(item, anyOf("creator", knownNames(item.contributors))),
  },
  {
    name: "Künstler:in ist anderswo Mitwirkende:r",
    count: 1,
    fetch: (item) => randomMatching(item, anyOf("contributor", knownNames(item.creators))),
  },
  {
    name: "Objekttyp und Medium",
    count: 1,
    fetch: (item) => randomMatching(item, anyOf("dcType", item.types), anyOf("medium", item.medium)),
  },
  {
    name: "Gleiche Sammlung (isPartOf)",
    count: 1,
    fetch: (item) => randomMatching(item, anyOf("isPartOf", item.isPartOf)),
  },
  {
    name: "Gleiche Institution",
    count: 1,
    fetch: (item) => randomMatching(item, item.institution ? `dataProvider:=${quote(item.institution)}` : undefined),
  },
  {
    name: "Gleiche Bildfarbe",
    count: 1,
    fetch: (item) => randomMatching(item, item.imageColor ? `imageColor:=${quote(item.imageColor)}` : undefined),
  },
];

/** Total slots of the metadata row. */
export const METADATA_TOTAL = MAIN_METADATA.count + EXTRA_METADATA_QUERIES.reduce((n, q) => n + q.count, 0);
