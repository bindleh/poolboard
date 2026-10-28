import type { Item, Link } from "./types";
import { describeShared, yearOf } from "./journey/shared";

export const mediumImage = (url: string) => url.replace("_small.webp", "_medium.webp");

export function formatDating(item: Item): string {
  if (item.dates.length) return item.dates.join(", ");
  if (item.dateMin != null && item.dateMax != null) {
    const a = yearOf(item.dateMin);
    const b = yearOf(item.dateMax);
    return a === b ? String(a) : `${a}–${b}`;
  }
  return "";
}

export function linkLabel(link: Link): string {
  const score = link.distance != null ? ` · Score ${link.distance.toFixed(2)}` : "";
  if (link.kind === "image") return `Bildähnlichkeit${score}`;
  if (link.kind === "metadata") {
    const shared = describeShared(link.shared);
    return `Metadaten${score}${shared ? ` · ${shared}` : ""}`;
  }
  return "Verbindung unbekannt";
}

export function downloadFile(filename: string, content: string, type = "text/html;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unbekannter Fehler";
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Kulturpool id from a plain id or a pasted kulturpool.at object link; undefined for other text. */
export function extractId(input: string): string | undefined {
  return input.match(UUID)?.[0].toLowerCase();
}
