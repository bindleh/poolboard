import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { mergeResults, namesOf, pickGermanWord, rankEntities } from "./multilingualSearch";

function item(id: string, title: string, institution = "Albertina"): Item {
  return {
    id,
    title,
    creators: [],
    institution,
    dates: [],
    types: [],
    description: [],
    rightsName: [],
    reusePolicy: [],
    rightsHolder: [],
    previewImage: "x.webp",
    kulturpoolUrl: "",
  };
}

describe("rankEntities", () => {
  it("prefers the concept over a band with the same name, using the popularity bonus", () => {
    // Real Wikidata situation for "blue": the band is listed first, the colour third.
    const lists = [
      [
        { id: "Q32825", description: "English boy band" },
        { id: "Q885595", description: "family name" },
        { id: "Q1088", description: "primary color between purple and green" },
      ],
    ];
    const sitelinks = new Map([
      ["Q32825", 40],
      ["Q885595", 3],
      ["Q1088", 160],
    ]);
    expect(rankEntities(lists, sitelinks)[0].id).toBe("Q1088");
  });

  it("counts an entry that appears in several languages higher", () => {
    const lists = [[{ id: "A" }, { id: "B" }], [{ id: "B" }]];
    expect(rankEntities(lists, new Map())[0].id).toBe("B");
  });
});

describe("namesOf", () => {
  const entity = {
    labels: { de: { value: "Tagfalter" }, en: { value: "butterfly" } },
    aliases: { de: [{ value: "Schmetterling" }, { value: "tagfalter" }] },
  };

  it("returns labels only by default and keeps the spelling", () => {
    expect(namesOf(entity, ["de", "en"])).toEqual(["Tagfalter", "butterfly"]);
  });

  it("adds aliases on request and drops case-insensitive duplicates", () => {
    expect(namesOf(entity, ["de"], true)).toEqual(["Tagfalter", "Schmetterling"]);
  });
});

describe("pickGermanWord", () => {
  it("picks the name with the most Kulturpool hits, not the official label", () => {
    const counts = new Map([
      ["Tagfalter", 11],
      ["Schmetterling", 1963],
      ["Falter", 400],
    ]);
    expect(pickGermanWord(["Tagfalter", "Schmetterling", "Falter"], counts)).toBe("Schmetterling");
  });

  it("returns undefined if no name has any hit", () => {
    expect(pickGermanWord(["Xyz"], new Map([["Xyz", 0]]))).toBeUndefined();
  });
});

describe("mergeResults", () => {
  it("lists vector hits first (closest first), then keyword hits, without duplicates", () => {
    const a = item("a", "A");
    const b = item("b", "B");
    const c = item("c", "C");
    const merged = mergeResults(
      [
        { item: b, distance: 0.13 },
        { item: a, distance: 0.11 },
      ],
      [[b, c]],
    );
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("caps items with the same title from the same institution", () => {
    const tiles = ["1", "2", "3", "4"].map((id) => item(id, "Fliese", "MAK"));
    const other = item("5", "Fliese", "Albertina");
    const merged = mergeResults([], [[...tiles, other]], 2);
    expect(merged.map((i) => i.id)).toEqual(["1", "2", "5"]);
  });
});
