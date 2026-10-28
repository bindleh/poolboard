import { describe, expect, it } from "vitest";
import type { Board, Item, Link } from "../types";
import { buildFacts } from "./facts";
import { buildMessages, factsText, parseIntroduction } from "./prompt";

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

const link = (fromId: string, toId: string, kind: Link["kind"], shared: Link["shared"] = []): Link => ({ fromId, toId, kind, shared });

// 1 Jan 1965 and 31 Dec 1970 as unix seconds
const Y1965 = -157766400;
const Y1970 = 31535999;

const board = (items: Item[], links: Link[]): Board => ({ id: "b", title: "T", createdAt: "2026-10-28", items, links });

describe("buildFacts", () => {
  const a = item("a", { institution: "Albertina", types: ["Druckgraphik"], subjects: ["Physiognomik"], dateMin: Y1965, dateMax: Y1970 });
  const b = item("b", { institution: "MAK", types: ["Postkarte"], subjects: ["Physiognomik", "Haus"] });
  const c = item("c", { institution: "MAK", types: ["Postkarte"] });

  it("finds common subjects, institutions and the period", () => {
    const f = buildFacts(board([a, b, c], [link("a", "b", "image"), link("b", "c", "metadata", [{ field: "institution", value: "MAK" }])]));
    expect(f.count).toBe(3);
    expect(f.commonSubjects).toEqual([{ subject: "Physiognomik", count: 2 }]);
    expect(f.institutions).toEqual([
      { name: "MAK", count: 2 },
      { name: "Albertina", count: 1 },
    ]);
    expect(f.years).toEqual({ from: 1965, to: 1970 });
  });

  it("turns links into numbered pairs and words the shared fields", () => {
    const f = buildFacts(board([a, b, c], [link("a", "b", "image"), link("b", "c", "metadata", [{ field: "institution", value: "MAK" }])]));
    expect(f.links).toEqual([
      { from: 1, to: 2, kind: "Bild", shared: "" },
      { from: 2, to: 3, kind: "Metadaten", shared: "gleiche Institution: MAK" },
    ]);
  });

  it("leaves out removed items and the links that touch them", () => {
    const gone = { ...b, removed: true };
    const f = buildFacts(board([a, gone, c], [link("a", "b", "image"), link("b", "c", "image")]));
    expect(f.objects.map((o) => o.title)).toEqual(["a", "c"]);
    expect(f.links).toEqual([]);
  });

  it("ignores impossible years and works without any dates", () => {
    expect(buildFacts(board([c, c], [link("c", "c", "image")])).years).toBeNull();
  });
});

describe("prompt", () => {
  const facts = buildFacts(board([item("a", { institution: "Albertina" }), item("b", { institution: "MAK" })], [link("a", "b", "image")]));

  it("asks for title and introduction only, in the chosen language", () => {
    const [system, user] = buildMessages(facts, "en");
    expect(system.content).toContain("Sprache der Antwort: Englisch");
    expect(system.content).toContain("Einleitung:");
    expect(system.content).not.toContain("Zu den Objekten");
    expect(system.content).toContain("Aufbau der Einleitung");
    expect(user.content).toContain("Objekt 1 und 2 sind einander ähnlich (nach Bild)");
  });

  it("states the facts as data between markers", () => {
    expect(factsText(facts)).toContain("Institutionen: Albertina (1), MAK (1)");
  });
});

describe("parseIntroduction", () => {
  it("splits title and text", () => {
    expect(parseIntroduction("Titel: Häuser und Blätter\nEinleitung: Acht Objekte aus fünf Institutionen.")).toEqual({
      title: "Häuser und Blätter",
      text: "Acht Objekte aus fünf Institutionen.",
    });
  });

  it("copes with markdown bold and blank lines", () => {
    expect(parseIntroduction("**Titel:** Eins\n\n**Einleitung:** Zwei")).toBeUndefined();
    expect(parseIntroduction("Titel: **Eins**\n\nEinleitung: Zwei\nDrei")).toEqual({ title: "Eins", text: "Zwei\nDrei" });
  });

  it("rejects answers without the format", () => {
    expect(parseIntroduction("Hier ist Ihr Text.")).toBeUndefined();
  });
});
