import { describe, expect, it, vi } from "vitest";
import type { Item } from "../types";
import {
  createSerialQueue,
  extraKeywordWords,
  isKnownName,
  isPhrase,
  isWeak,
  mergeResults,
  MIN_GOOD_HITS,
  namesOf,
  pickGermanWord,
  rankEntities,
  readMeaning,
  withRetry,
  writeMeaning,
} from "./multilingualSearch";

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

  it("prefers the widely known meaning over a rare name that matches exactly in every language", () => {
    // Real Wikidata situation for "perro": a genus of spiders matches in all languages, the dog (333 articles) in two.
    const spider = { id: "Q559372", description: "genus of arachnids" };
    const dog = { id: "Q144", description: "als Heim- und Nutztier gehaltenes Haustier" };
    const lists = [[spider, dog], [spider], [spider], [dog, spider], [spider], [spider]];
    const sitelinks = new Map([
      ["Q559372", 14],
      ["Q144", 333],
    ]);
    expect(rankEntities(lists, sitelinks)[0].id).toBe("Q144");
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

describe("extraKeywordWords", () => {
  const dog = {
    labels: { de: { value: "Haushund" }, en: { value: "dog" }, fr: { value: "chien" } },
  };

  it("returns the English and French label, not the German one", () => {
    expect(extraKeywordWords(dog, "Hund")).toEqual(["dog", "chien"]);
  });

  it("leaves out a name that equals the German word and returns nothing for an unknown entity", () => {
    expect(extraKeywordWords({ labels: { en: { value: "Hund" } } }, "hund")).toEqual([]);
    expect(extraKeywordWords(undefined, "Hund")).toEqual([]);
  });
});

describe("isPhrase", () => {
  it("is true for several words, also with extra spaces", () => {
    expect(isPhrase("black cat")).toBe(true);
    expect(isPhrase("  Frau  mit blauem Kleid ")).toBe(true);
  });

  it("is false for one word, also with spaces around it or a hyphen", () => {
    expect(isPhrase("Hund")).toBe(false);
    expect(isPhrase("  Hund ")).toBe(false);
    expect(isPhrase("Hund-Skulptur")).toBe(false);
  });
});

describe("isWeak", () => {
  it("is weak below the minimum number of good hits", () => {
    expect(isWeak(0)).toBe(true);
    expect(isWeak(MIN_GOOD_HITS - 1)).toBe(true);
    expect(isWeak(MIN_GOOD_HITS)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the result without waiting if the first try works", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    await expect(withRetry(async () => "ok", [10, 20], sleep)).resolves.toBe("ok");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("tries again after each delay and succeeds on a later try", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    let calls = 0;
    const task = async () => {
      calls += 1;
      if (calls < 3) throw new Error("blocked");
      return "ok";
    };
    await expect(withRetry(task, [10, 20], sleep)).resolves.toBe("ok");
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10, 20]);
  });

  it("throws the last error when all tries fail", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    await expect(withRetry(async () => Promise.reject(new Error("still blocked")), [10], sleep)).rejects.toThrow("still blocked");
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("remembered meanings", () => {
  function fakeStore() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }
  const meaning = { germanWord: "Wasser", extraWords: ["water", "eau"], description: "chemische Verbindung", names: ["wasser", "water", "eau"] };

  it("returns what was written for the same word", () => {
    const store = fakeStore();
    writeMeaning(store, "eau", meaning, 1000);
    expect(readMeaning(store, "eau", 2000)).toEqual(meaning);
    expect(readMeaning(store, "unknown", 2000)).toBeUndefined();
  });

  it("forgets a meaning after 24 hours", () => {
    const store = fakeStore();
    writeMeaning(store, "eau", meaning, 0);
    expect(readMeaning(store, "eau", 24 * 60 * 60 * 1000 + 1)).toBeUndefined();
  });

  it("survives broken stored data and a missing storage", () => {
    const broken = { getItem: () => "{not json", setItem: () => {} };
    expect(readMeaning(broken, "eau")).toBeUndefined();
    expect(() => writeMeaning(undefined, "eau", meaning)).not.toThrow();
    expect(readMeaning(undefined, "eau")).toBeUndefined();
  });
});

describe("createSerialQueue", () => {
  it("runs tasks one after another, never at the same time, and pauses between them", async () => {
    const events: string[] = [];
    const sleep = vi.fn(async (_ms: number) => void events.push("pause"));
    const enqueue = createSerialQueue(50, sleep);
    const task = (name: string) => async () => {
      events.push(`start ${name}`);
      await Promise.resolve();
      events.push(`end ${name}`);
      return name;
    };
    const results = await Promise.all([enqueue(task("a")), enqueue(task("b")), enqueue(task("c"))]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(events.slice(0, 6)).toEqual(["start a", "end a", "pause", "start b", "end b", "pause"]);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it("keeps going after a task fails", async () => {
    const enqueue = createSerialQueue(0, async () => {});
    const failing = enqueue(async () => Promise.reject(new Error("x")));
    await expect(failing).rejects.toThrow("x");
    await expect(enqueue(async () => "next")).resolves.toBe("next");
  });
});

describe("isKnownName", () => {
  it("knows a word that is a name of the entity, in any case", () => {
    expect(isKnownName(["haushund", "dog", "perro"], "Perro")).toBe(true);
  });

  it("does not know a word the entity does not carry (the typed word must then be searched too)", () => {
    // Real situation: "ente" resolved to a family of bacteria whose names do not contain "ente".
    expect(isKnownName(["enterobacteriaceae", "gneb"], "Ente")).toBe(false);
  });
});
