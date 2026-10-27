import type { Item, LinkKind, Suggestion } from "../types";

const BASE = "https://api.kulturpool.at";
export const IMAGE_FILTER = "edmType:=IMAGE && mediaTypes:=image";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawDoc = Record<string, any>;

export function toItem(doc: RawDoc): Item {
  const id: string = doc.uuid ?? doc.id;
  return {
    id,
    title: doc.title || "Ohne Titel",
    creators: doc.creator ?? [],
    institution: doc.dataProvider ?? "",
    dates: doc.date ?? [],
    dateMin: doc.dateMin,
    dateMax: doc.dateMax,
    types: doc.dcType ?? [],
    contributors: doc.contributor ?? [],
    isPartOf: doc.isPartOf ?? [],
    medium: doc.medium ?? [],
    imageColor: doc.imageColor,
    description: doc.description ?? [],
    rightsName: doc.edmRightsName ?? [],
    reusePolicy: doc.edmRightsReusePolicy ?? [],
    rightsHolder: doc.dcRights ?? [],
    previewImage: doc.previewImage ?? "",
    imageUrl: doc.isShownBy,
    sourceUrl: doc.isShownAt,
    kulturpoolUrl: doc.url ?? `https://kulturpool.at/objekte/${id}`,
    aspectRatio: doc.imageAspectRatio,
  };
}

export async function get(path: string, params: Record<string, string | number>): Promise<RawDoc> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError("Kulturpool ist gerade nicht erreichbar.", 0);
  }
  if (!res.ok) {
    const retry = Number(res.headers.get("Retry-After")) || undefined;
    throw new ApiError(`Kulturpool-Fehler (${res.status})`, res.status, retry);
  }
  return res.json();
}

/** One random item that has an image. */
export async function fetchRandomItem(): Promise<Item> {
  const data = await get("/v2/search", {
    q: "*",
    sort_by: "_rand()",
    use_cache: "false",
    per_page: 1,
    facet_by: "",
    filter_by: IMAGE_FILTER,
  });
  const hit = data.hits?.[0];
  if (!hit) throw new ApiError("Kein Objekt gefunden.", 404);
  return toItem(hit.document);
}

export interface SimilarOptions {
  /** Leave out this institution so suggestions come from other collections. */
  excludeInstitution?: string;
  /** Extra filter expression appended with &&, e.g. "dcType:=Fotografie". */
  filterBy?: string;
  /** Maximum vector distance; weaker matches are dropped by the API. */
  threshold?: number;
  perPage?: number;
}

/**
 * Similar items for one similarity mode. Requests many candidates so that seen
 * items can be dropped and the rest spread across institutions afterwards.
 */
export async function fetchSimilar(
  id: string,
  on: LinkKind,
  { excludeInstitution, filterBy, threshold, perPage = 200 }: SimilarOptions = {},
): Promise<Suggestion[]> {
  const exclude = excludeInstitution
    ? ` && dataProvider:!=\`${excludeInstitution.replace(/`/g, "")}\``
    : "";
  const extra = filterBy ? ` && ${filterBy}` : "";
  const params: Record<string, string | number> = {
    id,
    on,
    per_page: perPage,
    filter_by: IMAGE_FILTER + exclude + extra,
  };
  if (threshold != null) params.threshold = threshold;
  const data = await get("/v2/similar", params);
  return (data.hits ?? []).map((h: RawDoc) => ({
    item: toItem(h.document),
    distance: h.vector_distance as number,
  }));
}

/**
 * Plain search (no vectors) returned as suggestions; handy for metadata queries that
 * work with filters/sorting instead of similarity. `distance` stays undefined.
 * Example: searchSuggestions({ q: "Klimt", filter_by: IMAGE_FILTER, per_page: 50 })
 */
export async function searchSuggestions(params: Record<string, string | number>): Promise<Suggestion[]> {
  const data = await get("/v2/search", { facet_by: "", ...params });
  return (data.hits ?? []).map((h: RawDoc) => ({ item: toItem(h.document), distance: undefined }));
}

/** Ids from `ids` that still exist in Kulturpool (one request, max 250 ids). */
export async function fetchExistingIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const data = await get("/v2/search", {
    q: "*",
    filter_by: `id:=[${ids.join(",")}]`,
    per_page: Math.min(ids.length, 250),
    facet_by: "",
    include_fields: "uuid",
  });
  return new Set((data.hits ?? []).map((h: RawDoc) => h.document.uuid as string));
}
