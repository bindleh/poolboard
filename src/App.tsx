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

type Page = { name: "landing" } | { name: "journey" } | { name: "history" } | { name: "board"; id: string };

function LandingPage({ onStart }: { onStart: () => void }) {
  const slides = [
    {
      title: "1. Starte mit einem Bild",
      text:
        "Du kannst entweder mit einem bestimmten Objekt starten, indem du die ID in die Suchleiste eingibst oder du lässt dich von einem zufälligen Objekt inspirieren.",
      image: "/Schritt-1.png",
    },
    {
      title: "2. Wähle ein vorgeschlagenes Bild",
      text:
        "Auf der rechten Seite findest du Vorschläge. Wähle eines aus, um es zu deinem Board hinzuzufügen und neue Vorschläge zu generieren.",
      image: "/Schritt-2.png",
    },
    {
      title: "3. Verfolge deinen Verlauf",
      text: "Über den Vorschlägen werden alle hinzugefügten Objekte angezeigt, damit du deinen Verlauf nachvollziehen kannst.",
      image: "/Schritt-3.png",
    },
    {
      title: "4. Reise beenden",
      text: "Wenn du zufrieden bist mit deiner Sammlung, klicke auf “Board fertigstellen“, um dein Board zu speichern.",
      image: "/Schritt-4.png",
      isScreenshot: true,
    },
    {
      title: "5. Exportieren und importieren",
      text: "Das fertige Board kann als HTML exportiert werden und in der Kulturdatenbank wieder importiert werden.",
      image: ["/Schritt-5.png", "/Schritt-5.2.png"],
    },
    {
      title: "Start",
      text: "",
      isStart: true,
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [exportImageIndex, setExportImageIndex] = useState(0);
  const slide = slides[activeSlide];
  const isStartSlide = activeSlide === slides.length - 1;
  const slideImages = Array.isArray(slide.image) ? slide.image : [slide.image];

  useEffect(() => {
    setExportImageIndex(0);
  }, [activeSlide]);

  const currentExportImage = slideImages[exportImageIndex] ?? slideImages[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-14 md:py-20">
      <div className="rounded-[28px] border-4 border-brand-green bg-white p-8 shadow-sm md:p-12">
        <h1 className="flex flex-wrap items-center gap-x-4 gap-y-2 text-4xl font-black leading-tight text-ink md:text-5xl">
          Willkommen zu
          <span className="flex items-center">
            <Logo className="h-12 md:h-16" />!
          </span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-neutral-700">
          Deine personalisierte Expedition durch die{" "}
          <a
            href="https://www.kulturpool.at/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-pink underline underline-offset-4"
          >
            Kultur_Pool Datenbank
          </a>
          . Du kannst dich durch die Datenbank durchklicken und deine eigene Ausstellung kuratieren.
        </p>

        <div className="mt-10">
          <h2 className="text-2xl font-bold text-ink">So durchklickst du die Datenbank</h2>

          <div className="mt-6 rounded-[24px] border-2 border-neutral-200 bg-neutral-50 p-4 md:p-6">
            <div className="grid items-start gap-5 md:grid-cols-1">
              {!isStartSlide && (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-brand-pink px-2.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-ink">
                      {activeSlide + 1} / {slides.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSlide((current) => Math.max(current - 1, 0))}
                        disabled={activeSlide === 0}
                        className="cursor-pointer rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Zurück
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSlide((current) => Math.min(current + 1, slides.length - 1))}
                        disabled={activeSlide === slides.length - 1}
                        className="cursor-pointer rounded-lg bg-brand-pink px-3 py-1.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Weiter
                      </button>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-ink">{slide.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-neutral-700">{slide.text}</p>

                  <div className="mt-6">
                    <div className="relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-[22px] bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
                      {slideImages.length === 1 ? (
                        <img src={slideImages[0]} alt={slide.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="relative w-full">
                          <img
                            src={currentExportImage}
                            alt={slide.title}
                            className="h-auto w-full rounded-[22px] object-contain"
                          />

                          <button
                            type="button"
                            onClick={() => setExportImageIndex((current) => Math.max(current - 1, 0))}
                            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-ink shadow-md backdrop-blur-sm transition hover:bg-white"
                            aria-label="Vorheriges Bild"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            onClick={() => setExportImageIndex((current) => Math.min(current + 1, slideImages.length - 1))}
                            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-ink shadow-md backdrop-blur-sm transition hover:bg-white"
                            aria-label="Nächstes Bild"
                          >
                            →
                          </button>

                          <div className="absolute inset-x-0 bottom-3 flex justify-center">
                            <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-sm">
                              {slideImages.map((image, index) => (
                                <button
                                  key={image}
                                  type="button"
                                  aria-label={`Bild ${index + 1}`}
                                  onClick={() => setExportImageIndex(index)}
                                  className={`h-2.5 w-2.5 rounded-full ${index === exportImageIndex ? "bg-brand-pink" : "bg-white/70"}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isStartSlide && (
                <div className="space-y-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveSlide((current) => Math.max(current - 1, 0))}
                      className="cursor-pointer rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-medium text-ink"
                    >
                      Zurück
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onStart}
                    className="group relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[22px] bg-white p-0 text-center transition cursor-pointer shadow-[0_10px_24px_rgba(0,0,0,0.08)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.12)]"
                    aria-label="Eintauchen"
                    style={{
                      backgroundImage: "url('/spring-rein.png')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const journey = useJourney();
  const [page, setPage] = useState<Page>({ name: "landing" });
  const [boards, setBoards] = useState<Board[]>(() => historyStore.list());
  const { state, startRandom, startWith, reset, starting, startError } = journey;
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  // Item chosen in the search while a journey with several items is running: ask first.
  const [pendingStart, setPendingStart] = useState<Item | null>(null);

  const refresh = useCallback(() => setBoards(historyStore.list()), []);

  // A fresh journey always begins with a random start item.
  useEffect(() => {
    if (page.name === "journey" && state.items.length === 0 && !starting && !startError) startRandom();
  }, [page.name, state.items.length, starting, startError, startRandom]);

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

  // A new page always starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const board = page.name === "board" ? boards.find((b) => b.id === page.id) : undefined;

  const navClass = (active: boolean) =>
    `cursor-pointer px-1 py-1 text-lg font-medium border-b-4 ${active ? "border-brand-pink text-ink" : "border-transparent text-neutral-500 hover:text-ink"}`;

  return (
    <>
      <header className="bg-white border-b-4 border-brand-green">
        <nav className="max-w-[1920px] mx-auto px-3 md:px-4 flex items-center gap-3 h-[64px]">
          <button
            className="mr-4 hidden sm:block cursor-pointer"
            aria-label="Zur Startseite"
            onClick={() => setPage({ name: "landing" })}
          >
            <Logo className="h-10" />
          </button>
          <button className={navClass(page.name === "journey")} onClick={() => setPage({ name: "journey" })}>
            Eintauchen
          </button>
          <button
            className={navClass(page.name === "history" || page.name === "board")}
            onClick={() => setPage({ name: "history" })}
          >
            Meine Boards{" "}
            <span className="ml-1 inline-block rounded-full bg-brand-pink px-1.5 py-0.4 text-base text-ink align-middle">
              {boards.length}
            </span>
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

      {page.name === "landing" && (
        <LandingPage
          onStart={() => setPage({ name: "journey" })}
        />
      )}

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
          title="Neues Board mit diesem Objekt starten?"
          text="Das aktuelle Board wird verworfen und nicht in der Sammlung gespeichert. Zum Speichern vorher „Board beenden“ wählen."
          confirmLabel="Verwerfen und neu starten"
          danger
          onCancel={() => setPendingStart(null)}
          onConfirm={() => beginWith(pendingStart)}
        />
      )}
    </>
  );
}
