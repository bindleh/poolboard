import { useMemo, useState } from "react";
import { ItemDetail } from "../components/ItemDetail";
import { METADATA_TOTAL } from "../api/metadataQueries";
import { Button, ConfirmDialog, ItemImage } from "../components/ui";
import { isSavable, MAX_ITEMS, SUGGESTIONS_PER_MODE } from "../journey/journey";
import type { Item, LinkKind, Suggestion } from "../types";
import type { RowState, useJourney } from "../useJourney";
import { formatDating } from "../util";

type Journey = ReturnType<typeof useJourney>;

interface Props {
  journey: Journey;
  onFinish: () => void;
  onNewJourney: () => void;
}

interface Selected {
  item: Item;
  kind?: LinkKind;
  suggestion?: Suggestion;
}

/** Height/width ratios for the masonry tiles; picked per item so the layout stays stable. */
const TILE_RATIOS = [1, 1.25, 0.8, 1.5, 0.75, 1.15, 0.9, 1.35];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Tile {
  suggestion: Suggestion;
  kind: LinkKind;
}

/** Interleaves both suggestion kinds in a stable pseudo-random order (seeded, so rerenders do not reshuffle). */
function mixTiles(rows: Record<LinkKind, RowState>): Tile[] {
  const seen = new Set<string>();
  const tiles: Tile[] = [];
  for (const kind of ["metadata", "image"] as const) {
    const row = rows[kind];
    if (row.status !== "ok") continue;
    for (const suggestion of row.suggestions) {
      if (seen.has(suggestion.item.id)) continue;
      seen.add(suggestion.item.id);
      tiles.push({ suggestion, kind });
    }
  }
  return tiles.sort((x, y) => hash(x.suggestion.item.id) - hash(y.suggestion.item.id));
}

function SuggestionGrid({
  rows,
  onSelect,
  onRetry,
}: {
  rows: Record<LinkKind, RowState>;
  onSelect: (tile: Tile) => void;
  onRetry: () => void;
}) {
  const tiles = useMemo(() => mixTiles(rows), [rows]);
  const loading = rows.metadata.status === "loading" || rows.image.status === "loading";
  const errors = (["metadata", "image"] as const).flatMap((k) => {
    const r = rows[k];
    return r.status === "error" ? [r.message] : [];
  });
  const columns = "columns-3 xl:columns-4 2xl:columns-5 gap-2";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Ähnliche Objekte</h2>
      {errors.length > 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 text-sm flex items-center justify-between gap-3">
          <span>{errors.join(" ")}</span>
          <Button onClick={onRetry}>Erneut versuchen</Button>
        </div>
      )}
      {loading && tiles.length === 0 && (
        <div className={columns} aria-busy="true">
          {Array.from({ length: METADATA_TOTAL + SUGGESTIONS_PER_MODE }, (_, i) => (
            <div
              key={i}
              className="mb-2 break-inside-avoid rounded-xl bg-tile animate-pulse"
              style={{ aspectRatio: 1 / TILE_RATIOS[i % TILE_RATIOS.length] }}
            />
          ))}
        </div>
      )}
      {!loading && errors.length === 0 && tiles.length === 0 && (
        <p className="text-sm text-neutral-600 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4">
          Keine weiteren Vorschläge gefunden.
        </p>
      )}
      {tiles.length > 0 && (
        <div className={columns}>
          {tiles.map((t) => (
            <button
              key={t.suggestion.item.id}
              onClick={() => onSelect(t)}
              title={t.suggestion.item.title}
              className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl bg-tile"
              style={{ aspectRatio: 1 / TILE_RATIOS[hash(t.suggestion.item.id + "r") % TILE_RATIOS.length] }}
            >
              <ItemImage item={t.suggestion.item} className="w-full h-full transition-transform group-hover:scale-105" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The first item plus the last STRIP_TAIL items; an ellipsis marks hidden items in between. */
const STRIP_TAIL = 9;

function JourneyStrip({ items, onSelect }: { items: Item[]; onSelect: (item: Item) => void }) {
  const indexed = items.map((item, index) => ({ item, index }));
  const tail = indexed.slice(Math.max(1, items.length - STRIP_TAIL));
  const hidden = items.length - 1 - tail.length > 0;
  const shown = [indexed[0], ...tail];

  return (
    <ol className="flex items-center gap-2 min-w-0" aria-label="Meine Reise">
      {shown.map(({ item, index }) => (
        <li key={item.id} className="flex items-center gap-2 shrink-0">
          {hidden && index === tail[0].index && (
            <span className="text-neutral-500 text-lg leading-none" title={`${items.length - 1 - tail.length} weitere Objekte`}>
              …
            </span>
          )}
          <button
            onClick={() => onSelect(item)}
            title={item.title}
            className={`relative block w-12 h-12 overflow-hidden rounded-lg cursor-pointer ${index === items.length - 1 ? "ring-2 ring-brand-pink ring-offset-2" : ""}`}
          >
            <ItemImage item={item} className="w-full h-full" />
            <span className="absolute left-0.5 top-0.5 rounded-full bg-brand-pink text-ink text-[10px] font-medium px-1">
              {index + 1}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function JourneyPage({ journey, onFinish, onNewJourney }: Props) {
  const { state, current, rows, starting, startError, startRandom, add, undo, retry } = journey;
  const [selected, setSelected] = useState<Selected | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  const count = state.items.length;
  const onlyStart = count === 1;

  if (!current) {
    return (
      <div className="p-10 text-center">
        {startError ? (
          <>
            <p className="mb-4">{startError}</p>
            <Button variant="primary" onClick={startRandom}>
              Erneut versuchen
            </Button>
          </>
        ) : (
          <p className="text-neutral-600">{starting ? "Zufälliges Objekt wird geladen …" : "Lade …"}</p>
        )}
      </div>
    );
  }

  const handleNew = () => (isSavable(state) ? setConfirmNew(true) : onNewJourney());

  return (
    <div className="max-w-[1920px] mx-auto p-3 md:p-4 space-y-6">
      {startError && <p className="text-sm text-red-700">{startError}</p>}

      <div className="grid lg:grid-cols-[440px_1fr] gap-x-8 gap-y-3 items-center">
        <div className="flex flex-wrap items-center gap-3">
          {onlyStart ? (
            <Button onClick={startRandom} disabled={starting}>
              {starting ? "Lädt …" : "Anderes Zufallsobjekt"}
            </Button>
          ) : (
            <Button onClick={undo}>Letzen Schritt zurücknehmen</Button>
          )}
          <Button onClick={handleNew}>Neue Reise</Button>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <JourneyStrip items={state.items} onSelect={(item) => setSelected({ item })} />
          <Button variant="dark" className="ml-auto shrink-0 whitespace-nowrap" onClick={onFinish} disabled={onlyStart}>
            Reise fertigstellen
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[440px_1fr] gap-x-8 gap-y-5">
        <div className="space-y-4">
          <div>
            <div className="text-lg font-medium">
              Objekt {count} / {MAX_ITEMS}
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-tile">
              <div className="h-full rounded-full bg-brand-pink" style={{ width: `${(count / MAX_ITEMS) * 100}%` }} />
            </div>
          </div>

          <aside className="rounded-2xl border border-neutral-300 bg-white p-4">
            <button
              onClick={() => setSelected({ item: current })}
              className="block w-full overflow-hidden rounded-xl"
              aria-label="Details zum aktuellen Objekt"
            >
              <ItemImage item={current} size="medium" className="w-full aspect-square !object-contain" />
            </button>
            <h1 className="text-2xl font-semibold mt-4 leading-snug">{current.title}</h1>
            <dl className="text-[15px] text-neutral-600 mt-2 space-y-0.5">
              {current.creators.length > 0 && <div>{current.creators.join("; ")}</div>}
              {formatDating(current) && <div>{formatDating(current)}</div>}
              <div>{[current.institution, current.rightsName.join(", ")].filter(Boolean).join(" · ")}</div>
            </dl>
            <div className="flex gap-4 mt-3 text-[15px]">
              <button className="underline underline-offset-[3px]" onClick={() => setSelected({ item: current })}>
                Details
              </button>
              <a href={current.kulturpoolUrl} target="_blank" rel="noopener noreferrer">
                Auf Kulturpool
              </a>
            </div>
          </aside>
        </div>

        <div className="space-y-6">
          <SuggestionGrid
            rows={rows}
            onRetry={retry}
            onSelect={(t) => setSelected({ item: t.suggestion.item, kind: t.kind, suggestion: t.suggestion })}
          />
        </div>
      </div>

      {selected && (
        <ItemDetail
          item={selected.item}
          onClose={() => setSelected(null)}
          actions={
            selected.suggestion && selected.kind ? (
              <Button
                variant="primary"
                onClick={() => {
                  add(selected.suggestion!, selected.kind!);
                  setSelected(null);
                }}
              >
                Zur Reise hinzufügen
              </Button>
            ) : undefined
          }
        />
      )}

      {confirmNew && (
        <ConfirmDialog
          title="Neue Reise starten?"
          text="Die aktuelle Reise wird verworfen und nicht in der History gespeichert. Zum Speichern vorher „Reise beenden“ wählen."
          confirmLabel="Verwerfen und neu starten"
          danger
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            setConfirmNew(false);
            onNewJourney();
          }}
        />
      )}
    </div>
  );
}
