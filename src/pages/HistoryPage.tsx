import { useRef, useState } from "react";
import { Button, ConfirmDialog, ItemImage } from "../components/ui";
import { exportBoardsHtml, exportFilename, ImportError, importBoardsHtml } from "../exchange/kulturpoolHtml";
import type { Board } from "../types";
import { downloadFile, errorMessage } from "../util";

interface Props {
  boards: Board[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (boards: Board[]) => void;
}

export function HistoryPage({ boards, onOpen, onDelete, onImport }: Props) {
  const [toDelete, setToDelete] = useState<Board | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const imported = importBoardsHtml(await file.text());
      onImport(imported);
      setMessage({ text: `${imported.length} Board${imported.length === 1 ? "" : "s"} importiert.` });
    } catch (e) {
      setMessage({
        text: e instanceof ImportError ? e.message : `Import fehlgeschlagen: ${errorMessage(e)}`,
        error: true,
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-[1920px] mx-auto p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-semibold mr-auto">History</h1>
        <input
          ref={fileRef}
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button onClick={() => fileRef.current?.click()}>HTML importieren</Button>
        <Button
          disabled={boards.length === 0}
          onClick={() => downloadFile(exportFilename(), exportBoardsHtml(boards))}
        >
          Alle exportieren
        </Button>
      </div>

      {message && (
        <p className={`text-sm mb-4 ${message.error ? "text-red-700" : "text-ink"}`} role="status">
          {message.text}
        </p>
      )}

      {boards.length === 0 ? (
        <p className="text-neutral-600 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center">
          Noch keine Boards. Starte eine Reise und beende sie, um dein erstes Board zu erstellen.
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map((b) => (
            <li key={b.id} className="bg-white border border-neutral-300 rounded-2xl overflow-hidden flex flex-col">
              <button onClick={() => onOpen(b.id)} className="grid grid-cols-2 gap-px bg-neutral-300" aria-label={`${b.title} öffnen`}>
                {b.items.slice(0, 4).map((it) => (
                  <ItemImage key={it.id} item={it} className="w-full aspect-[4/3]" />
                ))}
              </button>
              <div className="p-3 flex-1">
                <h2 className="font-semibold leading-snug">{b.title}</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  {new Date(b.createdAt).toLocaleDateString("de-AT")} · {b.items.length} Objekte
                </p>
              </div>
              <div className="p-3 pt-0 flex gap-2">
                <Button variant="primary" onClick={() => onOpen(b.id)}>
                  Öffnen
                </Button>
                <Button onClick={() => downloadFile(exportFilename(), exportBoardsHtml([b]))}>Export</Button>
                <Button variant="danger" className="ml-auto" onClick={() => setToDelete(b)}>
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Board löschen?"
          text={`„${toDelete.title}“ wird aus der History entfernt.`}
          confirmLabel="Löschen"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            onDelete(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
