import { useCallback, useEffect, useState } from "react";
import { defaultBoardTitle, isSavable, MAX_ITEMS } from "./journey/journey";
import { SearchDialog } from "./components/SearchDialog";
import { Button, ConfirmDialog, Logo } from "./components/ui";
import { BoardPage } from "./pages/BoardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { JourneyPage } from "./pages/JourneyPage";
import { historyStore, newBoardId } from "./storage/history";
import type { Board, Item } from "./types";
import { useJourney } from "./useJourney";

type Page = { name: "journey" } | { name: "history" } | { name: "board"; id: string };

export default function App() {
  const journey = useJourney();
  const [page, setPage] = useState<Page>({ name: "journey" });
  const [boards, setBoards] = useState<Board[]>(() => historyStore.list());
  const { state, startRandom, startWith, reset, starting, startError } = journey;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  // Item chosen in the search while a journey with several items is running: ask first.
  const [pendingStart, setPendingStart] = useState<Item | null>(null);

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

  const newJourney = reset;

  const beginWith = useCallback(
    (item: Item) => {
      startWith(item);
      setPendingStart(null);
      setSearchQuery(null);
      setPage({ name: "journey" });
    },
    [startWith],
  );

  const chooseStart = useCallback(
    (item: Item) => {
      if (isSavable(state)) setPendingStart(item);
      else beginWith(item);
    },
    [state, beginWith],
  );

  // At the item limit the journey ends by itself.
  useEffect(() => {
    if (page.name === "journey" && state.items.length >= MAX_ITEMS) finish();
  }, [page.name, state.items.length, finish]);

  const board = page.name === "board" ? boards.find((b) => b.id === page.id) : undefined;

  const navClass = (active: boolean) =>
    `px-1 py-1 text-lg font-medium border-b-4 ${active ? "border-brand-pink text-ink" : "border-transparent text-neutral-500 hover:text-ink"}`;

  return (
    <>
      <header className="bg-white border-b-4 border-brand-green">
        <nav className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-3 h-[64px]">
          <Logo className="text-xl mr-4 hidden sm:inline-block" />
          <button className={navClass(page.name === "journey")} onClick={() => setPage({ name: "journey" })}>
            Reise
          </button>
          <button className={navClass(page.name !== "journey")} onClick={() => setPage({ name: "history" })}>
            History <span className="ml-1.5 inline-block rounded-full bg-brand-pink px-2.5 py-0.5 text-base text-ink align-middle">{boards.length}</span>
          </button>
          <form
            className="ml-auto flex gap-2"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchInput.trim();
              if (q) setSearchQuery(q);
            }}
          >
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Suche: Text oder Objekt-ID"
              aria-label="Suche nach Text oder Objekt-ID"
              className="w-40 sm:w-72 rounded-xl border-2 border-ink bg-white px-3 py-2 text-[15px]"
            />
            <Button type="submit" variant="primary">
              Suchen
            </Button>
          </form>
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

      {searchQuery && <SearchDialog query={searchQuery} onClose={() => setSearchQuery(null)} onStart={chooseStart} />}

      {pendingStart && (
        <ConfirmDialog
          title="Neue Reise mit diesem Objekt starten?"
          text="Die aktuelle Reise wird verworfen und nicht in der History gespeichert. Zum Speichern vorher „Reise beenden“ wählen."
          confirmLabel="Verwerfen und neu starten"
          danger
          onCancel={() => setPendingStart(null)}
          onConfirm={() => beginWith(pendingStart)}
        />
      )}
    </>
  );
}
