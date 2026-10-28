import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Board } from "../types";
import { exportBoardsHtml, importBoardsHtml } from "./kulturpoolHtml";

const board: Board = {
  id: "b1",
  title: 'Mein "Board" <1>',
  createdAt: "2026-10-27T10:00:00.000Z",
  items: ["a", "b", "c"].map((id) => ({
    id,
    title: `Titel ${id}`,
    creators: [],
    institution: "Albertina",
    dates: [],
    types: [],
    description: [],
    rightsName: [],
    reusePolicy: [],
    rightsHolder: [],
    previewImage: `https://media.kulturpool.at/images/x/${id}_small.webp`,
    sourceUrl: `https://example.org/${id}`,
    kulturpoolUrl: `https://kulturpool.at/objekte/${id}`,
  })),
  links: [
    { fromId: "a", toId: "b", kind: "metadata", distance: 0.08, shared: [{ field: "institution", value: "Albertina" }] },
    { fromId: "b", toId: "c", kind: "image", distance: 0.41, shared: [] },
  ],
};

describe("kulturpool favorites html", () => {
  it("roundtrips a board including its links", () => {
    const [back] = importBoardsHtml(exportBoardsHtml([board]), () => "new");
    expect(back.title).toBe(board.title);
    expect(back.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(back.links.map((l) => [l.kind, l.distance])).toEqual([
      ["metadata", 0.08],
      ["image", 0.41],
    ]);
    expect(back.links[0].shared).toEqual([{ field: "institution", value: "Albertina" }]);
  });

  it("uses the Kulturpool meta tag and card attributes", () => {
    const html = exportBoardsHtml([board]);
    expect(html).toContain('name="kulturpool-export" content="favorites" data-version="2"');
    expect(html).toContain('data-sort-order="2"');
    expect(html).toContain("a_medium.webp");
  });

  it("reads the original Kulturpool export; links are unknown", () => {
    const html = readFileSync("docs/reference/kulturpool-favorites-example.html", "utf8");
    const [b] = importBoardsHtml(html);
    expect(b.title).toBe("Favoriten");
    expect(b.items).toHaveLength(3);
    expect(b.items[0].id).toBe("dc28a62b-88c2-40d6-869e-445ee3251558");
    expect(b.links.every((l) => l.kind === "unknown")).toBe(true);
  });

  it("rejects files that are not a Kulturpool export", () => {
    expect(() => importBoardsHtml("<html><body>hi</body></html>")).toThrow();
  });
});
