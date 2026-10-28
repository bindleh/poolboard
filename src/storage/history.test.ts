import { beforeEach, describe, expect, it } from "vitest";
import type { Board } from "../types";
import { historyStore } from "./history";

const board: Board = {
  id: "b1",
  title: "Test",
  createdAt: "2026-01-01T00:00:00.000Z",
  items: [],
  links: [],
};

describe("historyStore", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the introductions stored with a board", () => {
    historyStore.save({ ...board, introductions: { de: { title: "Titel", text: "Text" } } });
    expect(historyStore.list()[0].introductions).toEqual({ de: { title: "Titel", text: "Text" } });
  });

  it("keeps the introductions when the board is saved again, e.g. after a rename", () => {
    historyStore.save({ ...board, introductions: { en: { title: "Titel", text: "Text" } } });
    const [stored] = historyStore.list();
    historyStore.save({ ...stored, title: "Neu" });
    expect(historyStore.list()[0]).toMatchObject({ title: "Neu", introductions: { en: { title: "Titel" } } });
  });
});
