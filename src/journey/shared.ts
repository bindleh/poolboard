import type { Item, SharedField } from "../types";

const SECONDS_PER_YEAR = 31556952;

/** "Klimt, Gustav" and "Gustav Klimt" must compare equal. */
export function normalizeName(name: string): string {
  const cleaned = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const parts = cleaned.includes(",")
    ? cleaned
        .split(",")
        .map((p) => p.trim())
        .reverse()
    : cleaned.split(/\s+/);
  return parts
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Creator values that mean "nobody known" and therefore are no real overlap. */
const PLACEHOLDER_NAMES = new Set(["unbekannt", "unknown", "anonym", "anonymous", "o.a.", "ohne angabe"]);

export function yearOf(seconds: number): number {
  return Math.round(1970 + seconds / SECONDS_PER_YEAR);
}

/** Fields two items have in common, shown on metadata links. */
export function sharedFields(a: Item, b: Item): SharedField[] {
  const out: SharedField[] = [];

  const bNames = new Set(b.creators.map(normalizeName));
  const creator = a.creators.find((c) => {
    const n = normalizeName(c);
    return bNames.has(n) && !PLACEHOLDER_NAMES.has(n);
  });
  if (creator) out.push({ field: "creator", value: creator });

  if (a.institution && a.institution === b.institution) {
    out.push({ field: "institution", value: a.institution });
  }

  const bTypes = new Set(b.types.map((t) => t.toLowerCase()));
  const type = a.types.find((t) => bTypes.has(t.toLowerCase()));
  if (type) out.push({ field: "type", value: type });

  if (a.dateMin != null && a.dateMax != null && b.dateMin != null && b.dateMax != null) {
    const lo = Math.max(a.dateMin, b.dateMin);
    const hi = Math.min(a.dateMax, b.dateMax);
    if (lo <= hi) {
      const from = yearOf(lo);
      const to = yearOf(hi);
      // Only meaningful when the shared period is reasonably narrow.
      if (to - from <= 50) out.push({ field: "period", value: from === to ? String(from) : `${from}–${to}` });
    }
  }

  return out;
}

const FIELD_LABELS: Record<SharedField["field"], string> = {
  creator: "gleiche:r Künstler:in",
  institution: "gleiche Institution",
  type: "gleicher Objekttyp",
  period: "gleicher Zeitraum",
};

export function describeShared(shared: SharedField[]): string {
  return shared.map((s) => `${FIELD_LABELS[s.field]}: ${s.value}`).join(" · ");
}
