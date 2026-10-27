import type { Board, Item, Link, SharedField } from "../types";

/**
 * Export/import in the Kulturpool favorites format (data-version 2).
 * Each board is one folder; the order of the journey is data-sort-order.
 * Poolboard-specific link data travels in extra data-poolboard-* attributes.
 */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pad = (n: number) => String(n).padStart(2, "0");

function stamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} / ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const medium = (url: string) => url.replace("_small.webp", "_medium.webp");
const small = (url: string) => url.replace("_medium.webp", "_small.webp");

function card(board: Board, item: Item, index: number): string {
  const link: Link | undefined = index > 0 ? board.links[index - 1] : undefined;
  const extra = link
    ? `
        data-poolboard-from="${esc(link.fromId)}"
        data-poolboard-type="${esc(link.kind)}"
        data-poolboard-score="${link.distance ?? ""}"
        data-poolboard-shared="${esc(JSON.stringify(link.shared))}"`
    : "";
  const title = esc(item.title);
  const institution = esc(item.institution);
  const source = esc(item.sourceUrl ?? item.kulturpoolUrl);
  const route = esc(`https://kulturpool.at/objekte/${item.id}`);
  return `
      <article class="favorite-card"
        data-id="${esc(item.id)}"
        data-folder="${esc(board.id)}"
        data-folder-name="${esc(board.title)}"
        data-sort-order="${index}"
        data-institution="${institution}"
        data-title="${title}"
        data-is-shown-at="${source}"
        data-route="${route}"
        data-preview-image="${esc(medium(item.previewImage))}"${extra}
      >
        <img class="preview-img" src="${esc(small(item.previewImage))}" alt="" loading="lazy" />
        <div class="institution">${institution}</div>
        <div class="title">${title}</div>
        <div class="links">
          <a href="${source}" target="_blank" rel="noopener">Institution</a>
          <a href="${route}" target="_blank" rel="noopener">Kulturpool</a>
        </div>
      </article>`;
}

const STYLE = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: #f5f5f5; color: #1e1e1e; padding: 2rem; }
    h1 { font-size: 1.6rem; margin-bottom: 0.5rem; }
    .export-meta { color: #666; font-size: 0.85rem; margin-bottom: 2rem; }
    .folder-section { margin-bottom: 2.5rem; }
    .folder-title { font-size: 1.15rem; font-weight: 600; border-bottom: 2px solid #1e1e1e; padding-bottom: 0.4rem; margin-bottom: 1rem; }
    .favorites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .favorite-card { background: #fff; border: 1px solid #ddd; padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .favorite-card .institution { font-size: 0.8rem; color: #666; font-weight: 500; }
    .favorite-card .title { font-size: 0.95rem; font-weight: 600; }
    .favorite-card .links { font-size: 0.8rem; margin-top: 0.3rem; display: flex; gap: 1rem; }
    .favorite-card .links a { color: #0066cc; text-decoration: none; }
    .favorite-card .links a:hover { text-decoration: underline; }
    .preview-img { width: 100%; max-height: 180px; object-fit: cover; margin-bottom: 0.4rem; }
    .reimport-notice { color: #666; font-size: 0.85rem; font-style: italic; margin-bottom: 2rem; }
  `;

export function exportBoardsHtml(boards: Board[], now = new Date()): string {
  const date = stamp(now);
  const sections = boards
    .map(
      (b) => `
    <section class="folder-section"
      data-folder-id="${esc(b.id)}"
      data-folder-name="${esc(b.title)}"
      data-poolboard-created="${esc(b.createdAt)}"
    >
      <h2 class="folder-title">${esc(b.title)} (${b.items.length})</h2>
      <div class="favorites-grid">${b.items.map((it, i) => card(b, it, i)).join("")}
      </div>
    </section>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="kulturpool-export" content="favorites" data-version="2" data-export-date="${date}" />
  <title>Kulturpool – Favoriten Exportieren</title>
  <style>${STYLE}</style>
</head>
<body>
  <h1>Kulturpool – Favoriten Exportieren</h1>
  <p class="export-meta">Exportiert: ${date} · erstellt mit Poolboard</p>
  <p class="reimport-notice">Diese Datei kann über die Favoriten-Importfunktion auf kulturpool.at wieder importiert werden.</p>
${sections}
</body>
</html>
`;
}

export function exportFilename(now = new Date()): string {
  return `kulturpool-favorites_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.html`;
}

export class ImportError extends Error {}

function parseShared(raw: string | null): SharedField[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as SharedField[]) : [];
  } catch {
    return [];
  }
}

/** Reads a Kulturpool favorites file; every folder becomes one board. */
export function importBoardsHtml(html: string, newId: () => string = () => crypto.randomUUID()): Board[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = doc.querySelector('meta[name="kulturpool-export"]');
  if (!meta) throw new ImportError("Das ist keine Kulturpool-Favoritenliste.");

  const boards: Board[] = [];
  for (const section of Array.from(doc.querySelectorAll("section.folder-section"))) {
    const cards = Array.from(section.querySelectorAll("article.favorite-card")).sort(
      (a, b) => Number(a.getAttribute("data-sort-order")) - Number(b.getAttribute("data-sort-order")),
    );
    if (cards.length === 0) continue;

    const items: Item[] = cards.map((c) => {
      const id = c.getAttribute("data-id") ?? "";
      return {
        id,
        title: c.getAttribute("data-title") ?? "Ohne Titel",
        creators: [],
        institution: c.getAttribute("data-institution") ?? "",
        dates: [],
        types: [],
        description: [],
        rightsName: [],
        reusePolicy: [],
        rightsHolder: [],
        previewImage: c.getAttribute("data-preview-image") ?? "",
        sourceUrl: c.getAttribute("data-is-shown-at") ?? undefined,
        kulturpoolUrl: c.getAttribute("data-route") ?? `https://kulturpool.at/objekte/${id}`,
      };
    });

    const links: Link[] = cards.slice(1).map((c, i) => {
      const type = c.getAttribute("data-poolboard-type");
      const score = c.getAttribute("data-poolboard-score");
      return {
        fromId: c.getAttribute("data-poolboard-from") ?? items[i].id,
        toId: items[i + 1].id,
        kind: type === "metadata" || type === "image" ? type : "unknown",
        distance: score ? Number(score) : undefined,
        shared: parseShared(c.getAttribute("data-poolboard-shared")),
      };
    });

    boards.push({
      id: newId(),
      title: section.getAttribute("data-folder-name") || "Import",
      createdAt: section.getAttribute("data-poolboard-created") ?? new Date().toISOString(),
      items,
      links,
    });
  }

  if (boards.length === 0) throw new ImportError("Die Datei enthält keine Objekte.");
  return boards;
}
