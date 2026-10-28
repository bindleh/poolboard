import { describe, expect, it } from "vitest";
import type { Item, Link, Suggestion } from "../types";
import { defaultBoardTitle, emptyJourney, journeyReducer, MAX_ITEMS, pickSuggestions } from "./journey";
import { normalizeName, sharedFields } from "./shared";

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  title: id,
  creators: [],
  institution: "",
  dates: [],
  types: [],
  description: [],
  rightsName: [],
  reusePolicy: [],
  rightsHolder: [],
  previewImage: `https://img/${id}`,
  kulturpoolUrl: `https://kulturpool.at/objekte/${id}`,
  ...over,
});

const link = (fromId: string, toId: string): Link => ({ fromId, toId, kind: "image", distance: 0.1, shared: [] });

describe("journeyReducer", () => {
  it("starts with one item and marks it seen", () => {
    const s = journeyReducer(emptyJourney, { type: "start", item: item("a") });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.seen).toEqual(["a"]);
  });

  it("adds items with their link and refuses duplicates", () => {
    let s = journeyReducer(emptyJourney, { type: "start", item: item("a") });
    s = journeyReducer(s, { type: "add", item: item("b"), link: link("a", "b") });
    s = journeyReducer(s, { type: "add", item: item("b"), link: link("a", "b") });
    expect(s.items).toHaveLength(2);
    expect(s.links).toHaveLength(1);
  });

  it("stops at the maximum number of items", () => {
    let s = journeyReducer(emptyJourney, { type: "start", item: item("0") });
    for (let i = 1; i < MAX_ITEMS + 5; i++) {
      s = journeyReducer(s, { type: "add", item: item(String(i)), link: link(String(i - 1), String(i)) });
    }
    expect(s.items).toHaveLength(MAX_ITEMS);
  });

  it("undo removes the last item but never the start item", () => {
    let s = journeyReducer(emptyJourney, { type: "start", item: item("a") });
    s = journeyReducer(s, { type: "add", item: item("b"), link: link("a", "b") });
    s = journeyReducer(s, { type: "undo" });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.links).toHaveLength(0);
    expect(journeyReducer(s, { type: "undo" }).items).toHaveLength(1);
  });
});

describe("defaultBoardTitle", () => {
  it("uses the fixed default board title instead of the first item title", () => {
    const state = { items: [item("a", { title: "Erstes Objekt" })], links: [], seen: ["a"] };
    expect(defaultBoardTitle(state)).toBe("Unbenanntes Board");
  });
});

describe("pickSuggestions", () => {
  const sug = (id: string, over: Partial<Item> = {}): Suggestion => ({ item: item(id, over), distance: 0.1 });

  it("hides seen items, duplicates and items without image, then cuts to the limit", () => {
    const out = pickSuggestions(
      [sug("a"), sug("b"), sug("b"), sug("c", { previewImage: "" }), sug("d"), sug("e")],
      new Set(["a"]),
      2,
    );
    expect(out.map((s) => s.item.id)).toEqual(["b", "d"]);
  });
});

describe("pickSuggestions diversity", () => {
  const sug = (id: string, title: string, institution: string, creator?: string): Suggestion => ({
    item: item(id, { title, institution, creators: creator ? [creator] : [] }),
    distance: 0.1,
  });
  const caps = { perTitle: 1, perInstitution: 3, perCreator: 99 };

  it("allows one item per title and the configured number per institution", () => {
    const out = pickSuggestions(
      [
        sug("1", "Serie", "A"),
        sug("2", "Serie", "A"),
        sug("3", "Serie", "A"),
        sug("4", "Andere", "A"),
        sug("5", "Dritte", "A"),
        sug("6", "Vierte", "A"),
        sug("7", "Fünfte", "B"),
      ],
      new Set(),
      4,
      caps,
    );
    expect(out.map((s) => s.item.id)).toEqual(["1", "4", "5", "7"]);
  });

  it("allows one item per known creator but ignores 'unbekannt'", () => {
    const out = pickSuggestions(
      [
        sug("1", "a", "A", "Klimt, Gustav"),
        sug("2", "b", "B", "Gustav Klimt"),
        sug("3", "c", "C", "unbekannt"),
        sug("4", "d", "D", "unbekannt"),
      ],
      new Set(),
      3,
      { perTitle: 1, perInstitution: 9, perCreator: 1 },
    );
    expect(out.map((s) => s.item.id)).toEqual(["1", "3", "4"]);
  });

  it("fills up with the closest skipped items when variety runs out", () => {
    const out = pickSuggestions([sug("1", "Serie", "A"), sug("2", "Serie", "A"), sug("3", "Serie", "A")], new Set(), 3, caps);
    expect(out.map((s) => s.item.id)).toEqual(["1", "2", "3"]);
  });
});

describe("sharedFields", () => {
  it("treats 'Klimt, Gustav' and 'Gustav Klimt' as the same creator", () => {
    expect(normalizeName("Klimt, Gustav")).toBe(normalizeName("Gustav Klimt"));
    const f = sharedFields(
      item("a", { creators: ["Klimt, Gustav"], institution: "Albertina" }),
      item("b", { creators: ["Gustav Klimt"], institution: "Albertina" }),
    );
    expect(f.map((x) => x.field)).toEqual(["creator", "institution"]);
  });

  it("does not count an unknown creator as shared", () => {
    expect(sharedFields(item("a", { creators: ["unbekannt"] }), item("b", { creators: ["Unbekannt"] }))).toEqual([]);
  });

  it("returns nothing when nothing is shared", () => {
    expect(sharedFields(item("a", { institution: "X" }), item("b", { institution: "Y" }))).toEqual([]);
  });
});
