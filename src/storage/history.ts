import type { Board } from "../types";

const KEY = "poolboard.history.v1";

/** History of boards; kept behind this small interface so the backend can be swapped later. */
export interface HistoryStore {
  list(): Board[];
  save(board: Board): void;
  remove(id: string): void;
}

function read(): Board[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Board[]) : [];
  } catch {
    return [];
  }
}

function write(boards: Board[]): void {
  localStorage.setItem(KEY, JSON.stringify(boards));
}

/** Keeps the snapshot small: no long descriptions, no full-size image URLs needed for the board. */
export function toSnapshot(board: Board): Board {
  return {
    ...board,
    items: board.items.map((i) => ({ ...i, description: i.description.slice(0, 1).map((d) => d.slice(0, 400)) })),
  };
}

export const historyStore: HistoryStore = {
  list() {
    return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  save(board) {
    const boards = read().filter((b) => b.id !== board.id);
    boards.push(toSnapshot(board));
    write(boards);
  },
  remove(id) {
    write(read().filter((b) => b.id !== id));
  },
};

export function newBoardId(): string {
  return crypto.randomUUID();
}
