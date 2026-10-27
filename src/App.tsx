import { useCallback, useEffect, useState } from "react";
import { defaultBoardTitle, isSavable, MAX_ITEMS } from "./journey/journey";
import { BoardPage } from "./pages/BoardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { JourneyPage } from "./pages/JourneyPage";
import { historyStore, newBoardId } from "./storage/history";
import type { Board } from "./types";
import { useJourney } from "./useJourney";

type Page = { name: "journey" } | { name: "history" } | { name: "board"; id: string };

export default function App() {
  const journey = useJourney();
  const [page, setPage] = useState<Page>({ name: "journey" });
  const [boards, setBoards] = useState<Board[]>(() => historyStore.list());
  const { state, startRandom, reset, starting, startError } = journey;

  const refresh = useCallback(() => setBoards(historyStore.list()), []);

  // A fresh journey always begins with a random start item.
  useEffect(() => {
    if (state.items.length === 0 && !starting && !startError) startRandom();
  }, [state.items.length, starting, startError, startRandom]);

  const saveJourney = useCallback((): Board | null => {
    if (!isSavable(state)) return null;
    const board: Board = {
      id: newBoardId(),
      title: defaultBoardTitle(state),
      createdAt: new Date().toISOString(),
      items: state.items,
      links: state.links,
    };
    historyStore.save(board);
    refresh();
    return board;
  }, [state, refresh]);

  const finish = useCallback(() => {
    const board = saveJourney();
    if (!board) return;
    reset();
    setPage({ name: "board", id: board.id });
  }, [saveJourney, reset]);

  const newJourney = useCallback(() => {
    saveJourney();
    reset();
  }, [saveJourney, reset]);

  // At the item limit the journey ends by itself.
  useEffect(() => {
    if (page.name === "journey" && state.items.length >= MAX_ITEMS) finish();
  }, [page.name, state.items.length, finish]);

  const board = page.name === "board" ? boards.find((b) => b.id === page.id) : undefined;

  const navClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium border-b-2 ${active ? "border-[#1e1e1e]" : "border-transparent text-neutral-500 hover:text-black"}`;

  return (
    <>
      <header className="bg-white border-b border-neutral-300">
        <nav className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-2 h-[56px]">
          <span className="font-bold text-lg mr-6">Poolboard</span>
          <button className={navClass(page.name === "journey")} onClick={() => setPage({ name: "journey" })}>
            Reise
          </button>
          <button className={navClass(page.name !== "journey")} onClick={() => setPage({ name: "history" })}>
            History ({boards.length})
          </button>
        </nav>
      </header>

      {page.name === "journey" && <JourneyPage journey={journey} onFinish={finish} onNewJourney={newJourney} />}

      {page.name === "history" && (
        <HistoryPage
          boards={boards}
          onOpen={(id) => setPage({ name: "board", id })}
          onDelete={(id) => {
            historyStore.remove(id);
            refresh();
          }}
          onImport={(imported) => {
            imported.forEach((b) => historyStore.save(b));
            refresh();
          }}
        />
      )}

      {page.name === "board" &&
        (board ? (
          <BoardPage
            board={board}
            onBack={() => setPage({ name: "history" })}
            onRename={(title) => {
              historyStore.save({ ...board, title });
              refresh();
            }}
          />
        ) : (
          <p className="p-8">Board nicht gefunden.</p>
        ))}
    </>
  );
}
