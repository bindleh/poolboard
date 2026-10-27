import { useState } from "react";
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

const ROW_TITLES: Record<LinkKind, { title: string; hint: string }> = {
  metadata: { title: "Inhaltlich ähnlich", hint: "gleiche Themen, Künstler:innen, Orte oder Zeiten" },
  image: { title: "Optisch ähnlich", hint: "Bilder, die ähnlich aussehen" },
};

function SuggestionRow({
  kind,
  row,
  onSelect,
  onRetry,
}: {
  kind: LinkKind;
  row: RowState;
  onSelect: (s: Suggestion) => void;
  onRetry: () => void;
}) {
  const { title, hint } = ROW_TITLES[kind];
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-neutral-500">{hint}</span>
      </div>
      {row.status === "loading" && (
        <div className="grid grid-cols-5 gap-2" aria-busy="true">
          {Array.from({ length: kind === "metadata" ? METADATA_TOTAL : SUGGESTIONS_PER_MODE }, (_, i) => (
            <div key={i} className="aspect-square bg-neutral-200 animate-pulse" />
          ))}
        </div>
      )}
      {row.status === "error" && (
        <div className="border border-dashed border-neutral-400 bg-white p-4 text-sm flex items-center justify-between gap-3">
          <span>{row.message}</span>
          <Button onClick={onRetry}>Erneut versuchen</Button>
        </div>
      )}
      {row.status === "ok" && row.suggestions.length === 0 && (
        <p className="text-sm text-neutral-600 border border-dashed border-neutral-400 bg-white p-4">
          Keine weiteren Vorschläge gefunden.
        </p>
      )}
      {row.status === "ok" && row.suggestions.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {row.suggestions.map((s) => (
            <button
              key={s.item.id}
              onClick={() => onSelect(s)}
              title={s.item.title}
              className="group relative aspect-square overflow-hidden bg-neutral-200 focus:outline-2 focus:outline-[#0066cc]"
            >
              <ItemImage item={s.item} className="w-full h-full transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[11px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100">
                {s.item.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="text-sm font-medium">
            Objekt {count} / {MAX_ITEMS}
          </div>
          <div className="mt-1 h-1.5 w-48 bg-neutral-300">
            <div className="h-full bg-[#1e1e1e]" style={{ width: `${(count / MAX_ITEMS) * 100}%` }} />
          </div>
        </div>
        {onlyStart && (
          <Button onClick={startRandom} disabled={starting}>
            {starting ? "Lädt …" : "Anderes Zufallsobjekt"}
          </Button>
        )}
        {!onlyStart && <Button onClick={undo}>Letzten Schritt zurücknehmen</Button>}
        <Button variant="primary" onClick={onFinish} disabled={onlyStart}>
          Reise beenden
        </Button>
        <Button onClick={handleNew}>Neue Reise</Button>
      </div>
      {startError && <p className="text-sm text-red-700">{startError}</p>}

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        <aside className="bg-white border border-neutral-300 p-4 self-start">
          <button
            onClick={() => setSelected({ item: current })}
            className="block w-full"
            aria-label="Details zum aktuellen Objekt"
          >
            <ItemImage item={current} size="medium" className="w-full aspect-[4/3] !object-contain" />
          </button>
          <h1 className="text-lg font-semibold mt-3 leading-snug">{current.title}</h1>
          <dl className="text-sm text-neutral-700 mt-2 space-y-0.5">
            {current.creators.length > 0 && <div>{current.creators.join("; ")}</div>}
            {formatDating(current) && <div>{formatDating(current)}</div>}
            <div className="text-neutral-500">{current.institution}</div>
            {current.rightsName.length > 0 && (
              <div className="text-neutral-500">Lizenz: {current.rightsName.join(", ")}</div>
            )}
          </dl>
          <div className="flex gap-4 mt-3 text-sm">
            <button className="underline text-[#0066cc]" onClick={() => setSelected({ item: current })}>
              Details
            </button>
            <a href={current.kulturpoolUrl} target="_blank" rel="noopener noreferrer">
              Auf Kulturpool
            </a>
          </div>
        </aside>

        <div className="space-y-6">
          {(["metadata", "image"] as const).map((kind) => (
            <SuggestionRow
              key={kind}
              kind={kind}
              row={rows[kind]}
              onRetry={retry}
              onSelect={(s) => setSelected({ item: s.item, kind, suggestion: s })}
            />
          ))}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 text-neutral-600">Meine Reise</h2>
        <ol className="flex gap-2 overflow-x-auto pb-2">
          {state.items.map((it, i) => (
            <li key={it.id} className="shrink-0 w-20">
              <button
                onClick={() => setSelected({ item: it })}
                title={it.title}
                className={`relative block w-20 h-20 overflow-hidden ${i === count - 1 ? "outline-2 outline-[#1e1e1e]" : ""}`}
              >
                <ItemImage item={it} className="w-full h-full" />
                <span className="absolute left-0 top-0 bg-[#1e1e1e] text-white text-[10px] px-1">{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

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
          text="Die aktuelle Reise wird als Board in der History gespeichert."
          confirmLabel="Speichern und neu starten"
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
