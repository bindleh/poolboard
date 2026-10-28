export type LinkKind = "metadata" | "image";

export interface Item {
  id: string;
  title: string;
  creators: string[];
  institution: string;
  dates: string[];
  /** Start/end of the dating as unix seconds (may be negative). */
  dateMin?: number;
  dateMax?: number;
  types: string[];
  /** Subject keywords (Kulturpool field `subject`); basis for the common thread in the introduction. */
  subjects?: string[];
  /** Further fields used by the metadata queries (api/metadataQueries.ts). */
  contributors?: string[];
  isPartOf?: string[];
  medium?: string[];
  imageColor?: string;
  description: string[];
  rightsName: string[];
  reusePolicy: string[];
  rightsHolder: string[];
  previewImage: string;
  imageUrl?: string;
  sourceUrl?: string;
  kulturpoolUrl: string;
  aspectRatio?: number;
  /** True for the stand-in shown when an item could not be found anymore. */
  removed?: boolean;
}

export type SharedFieldName = "creator" | "institution" | "type" | "period";

export interface SharedField {
  field: SharedFieldName;
  value: string;
}

export interface Link {
  fromId: string;
  toId: string;
  kind: LinkKind | "unknown";
  /** Vector distance reported by the API; smaller means more similar. */
  distance?: number;
  shared: SharedField[];
}

export interface Suggestion {
  item: Item;
  /** Vector distance; undefined for suggestions that come from a plain search. */
  distance?: number;
}

/** AI-generated introduction that is stored with the board, one per language code. */
export interface BoardIntroduction {
  title: string;
  text: string;
}

export interface Board {
  id: string;
  title: string;
  createdAt: string;
  items: Item[];
  /** links[i] connects items[i] to items[i + 1]. */
  links: Link[];
  introductions?: Record<string, BoardIntroduction>;
}
