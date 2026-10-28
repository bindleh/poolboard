import { useEffect, useState } from "react";
import { fetchItemById } from "../api/client";
import { searchItemsMultilingual } from "../api/multilingualSearch";
import type { Item } from "../types";
import { errorMessage, extractId } from "../util";
import { ItemDetail } from "./ItemDetail";
import { Button, ItemImage, Modal } from "./ui";

interface Props {
  query: string;
  onClose: () => void;
  /** The chosen item becomes the start of a new journey. */
  onStart: (item: Item) => void;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "id"; item?: Item }
  | { status: "text"; items: Item[]; found: number; loadingMore: boolean; info?: string };

const PAGE_SIZE = 24;

/** Shows a single item for an id (or pasted link), otherwise a list of text search results. */
export function SearchDialog({ query, onClose, onStart }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  const id = extractId(query);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setPage(1);
    setSelected(null);
    const run = id
      ? fetchItemById(id).then((item): State => ({ status: "id", item }))
      : searchItemsMultilingual(query, 1, PAGE_SIZE).then(
          (r): State => ({ status: "text", items: r.items, found: r.found, loadingMore: false, info: r.info }),
        );
    run
      .then((s) => !cancelled && setState(s))
      .catch((e) => !cancelled && setState({ status: "error", message: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [query, id]);

  async function loadMore() {
    if (state.status !== "text") return;
    const next = page + 1;
    setState({ ...state, loadingMore: true });
    try {
      const r = await searchItemsMultilingual(query, next, PAGE_SIZE);
      setPage(next);
      setState((s) =>
        s.status === "text"
          ? { ...s, items: [...s.items, ...r.items.filter((i) => !s.items.some((o) => o.id === i.id))], loadingMore: false }
          : s,
      );
    } catch (e) {
      setState({ status: "error", message: errorMessage(e) });
    }
  }

  const startAction = (item: Item) => (
    <Button variant="primary" onClick={() => onStart(item)}>
      Als Start des Boards verwenden
    </Button>
  );

  // Exactly one item for an id search: show it directly.
  if (state.status === "id" && state.item) {
    return <ItemDetail item={state.item} onClose={onClose} actions={startAction(state.item)} />;
  }
  if (selected) {
    return <ItemDetail item={selected} onClose={() => setSelected(null)} actions={startAction(selected)} />;
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-xl font-semibold">{id ? "Objekt-ID" : "Suchergebnisse"}</h2>
          <span className="text-sm text-neutral-500 truncate">„{query}“</span>
          <Button className="ml-auto" onClick={onClose}>
            Schließen
          </Button>
        </div>

        {state.status === "loading" && <p className="text-neutral-600">Suche läuft …</p>}
        {state.status === "error" && <p className="text-red-700">{state.message}</p>}
        {state.status === "id" && !state.item && (
          <p className="text-neutral-700">Kein Objekt mit dieser ID gefunden.</p>
        )}
        {state.status === "text" && state.items.length === 0 && (
          <p className="text-neutral-700">Keine Objekte mit Bild zu dieser Suche gefunden.</p>
        )}
        {state.status === "text" && state.items.length > 0 && (
          <>
            <p className="text-sm text-neutral-500 mb-1">
              {state.found.toLocaleString("de-AT")} Treffer mit Bild – Objekt anklicken, um Details zu sehen.
            </p>
            {state.info && <p className="text-xs text-neutral-500 mb-3">{state.info}</p>}
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {state.items.map((it) => (
                <li key={it.id}>
                  <button onClick={() => setSelected(it)} className="block w-full text-left group">
                    <ItemImage item={it} className="w-full aspect-square rounded-xl group-hover:opacity-90" />
                    <div className="text-sm font-medium leading-snug mt-1 line-clamp-2">{it.title}</div>
                    <div className="text-xs text-neutral-500 truncate">{it.institution}</div>
                  </button>
                </li>
              ))}
            </ul>
            {state.items.length < state.found && (
              <div className="mt-4 text-center">
                <Button onClick={loadMore} disabled={state.loadingMore}>
                  {state.loadingMore ? "Lädt …" : "Mehr Treffer laden"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
