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
      <h2 className="text-lg font-semibold mb-2" title={hint}>
        {title}
      </h2>
      {row.status === "loading" && (
        <div className="grid grid-cols-5 gap-2" aria-busy="true">
          {Array.from({ length: kind === "metadata" ? METADATA_TOTAL : SUGGESTIONS_PER_MODE }, (_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-tile animate-pulse" />
          ))}
        </div>
      )}
      {row.status === "error" && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 text-sm flex items-center justify-between gap-3">
          <span>{row.message}</span>
          <Button onClick={onRetry}>Erneut versuchen</Button>
        </div>
      )}
      {row.status === "ok" && row.suggestions.length === 0 && (
        <p className="text-sm text-neutral-600 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4">
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
              className="group relative aspect-square overflow-hidden rounded-xl bg-tile"
            >
              <ItemImage item={s.item} className="w-full h-full transition-transform group-hover:scale-105" />
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
      {startError && <p className="text-sm text-red-700">{startError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {onlyStart ? (
          <Button onClick={startRandom} disabled={starting}>
            {starting ? "Lädt …" : "Anderes Zufallsobjekt"}
          </Button>
        ) : (
          <Button onClick={undo}>Letzen Schritt zurücknehmen</Button>
        )}
        <Button onClick={handleNew}>Neues Board</Button>
        <Button variant="dark" className="ml-auto" onClick={onFinish} disabled={onlyStart}>
          Board fertigstellen
        </Button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-x-8 gap-y-5">
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
              <ItemImage item={current} size="medium" className="w-full aspect-[4/3] !object-contain" />
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
        <h2 className="text-sm font-semibold mb-2 text-neutral-600">Mein Board bisher</h2>
        <ol className="flex gap-2 overflow-x-auto pb-2">
          {state.items.map((it, i) => (
            <li key={it.id} className="shrink-0 w-20">
              <button
                onClick={() => setSelected({ item: it })}
                title={it.title}
                className={`relative block w-20 h-20 overflow-hidden rounded-xl ${i === count - 1 ? "ring-2 ring-brand-pink ring-offset-2" : ""}`}
              >
                <ItemImage item={it} className="w-full h-full" />
                <span className="absolute left-1 top-1 rounded-full bg-brand-pink text-ink text-[10px] font-medium px-1.5">{i + 1}</span>
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
                Zum Board hinzufügen
              </Button>
            ) : undefined
          }
        />
      )}

      {confirmNew && (
        <ConfirmDialog
          title="Neues Board starten?"
          text="Das aktuelle Board wird verworfen und nicht in der History gespeichert. Zum Speichern vorher „Reise beenden“ wählen."
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
