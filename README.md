# Poolboard

Poolboard entstand beim Hackathon *Hack the pool 2026*. Die Web-App startet mit einem Kulturobjekt aus [Kulturpool](https://kulturpool.at), schlägt inhaltlich und optisch ähnliche Objekte vor und hält die Entdeckungsreise (bis zu 20 Objekte) als Board mit Verbindungen fest.

Weiterführend: [PROJECT.md](./PROJECT.md) (Idee und Entscheidungen) · [CONTEXT.md](./CONTEXT.md) (Glossar) · [CLAUDE.md](./CLAUDE.md) (Arbeitsanweisungen)

## Funktionen

### Reise („Eintauchen")
- **Startobjekt:** Zufälliges Objekt mit Bild, jederzeit durch ein anderes Zufallsobjekt ersetzbar, solange noch nichts hinzugefügt wurde.
- **Suche als Start:** Suche oben rechts nach Objekt-ID, Kulturpool-Link oder Text. Die Textsuche ist mehrsprachig (Wikidata liefert die deutsche Entsprechung, danach Vektor- und Stichwortsuche in Kulturpool). Ein Treffer kann als Start der Reise gewählt werden.
- **Vorschläge:** Zu jedem gewählten Objekt gibt es 15 inhaltlich ähnliche (Metadaten) und 10 optisch ähnliche Vorschläge (Bildähnlichkeit). Sie erscheinen gemischt und ohne Markierung in einem Pinterest-Raster. Bereits gesehene Objekte tauchen nicht mehr auf, Serien und gleiche Institutionen werden begrenzt, damit die Vorschläge abwechslungsreich bleiben.
- **Hinzufügen:** Vorschlag anklicken, Details ansehen, zur Reise hinzufügen. Der letzte Schritt lässt sich zurücknehmen. Bei 20 Objekten endet die Reise automatisch, vorher mit „Board fertigstellen".
- **Reise-Leiste:** Zeigt das erste und die letzten fünf Objekte, „…" markiert Ausgelassenes.

### Meine Boards
- **Board-Ansicht:** Objekte als Karten in Schlangenlinie, verbunden nach Art (Metadaten oder Bild), Ähnlichkeitswert und geteilten Feldern (z. B. gleiche Institution, gleiche Zeit).
- **Karte:** Alle Objekte nach Institution auf einer Karte.
- **Titel** direkt bearbeitbar, Standardtitel ist Datum und Titel des ersten Objekts. Nicht mehr verfügbare Objekte erscheinen als Platzhalter „Dieses Objekt wurde entfernt".
- **Einleitung (KI):** Pro Sprache (Deutsch, Englisch) einmal erzeugbar, danach nur anzeigen oder bearbeiten, lokal am Board gespeichert.
- **History:** Alle Boards bleiben lokal im Browser gespeichert und lassen sich öffnen, exportieren und löschen.

### Export und Import
Boards lassen sich im HTML-Format der Kulturpool-Favoritenliste exportieren und wieder importieren, auch Dateien, die direkt von kulturpool.at stammen. Poolboard ergänzt eigene `data-poolboard-*`-Attribute für Verbindungen. Eine Referenzdatei liegt unter [docs/reference](./docs/reference).

## Technik

| Bereich | Umsetzung |
| --- | --- |
| Frontend | React 19, TypeScript (strict), Vite 8 |
| Styling | Tailwind CSS 4 (Design-Token in `src/index.css`) |
| Board | [React Flow](https://reactflow.dev) (`@xyflow/react`) |
| Karte | Leaflet / react-leaflet, Kacheln von Stadia Maps, Institutionen aus der Kulturpool-API |
| Tests | Vitest mit jsdom (56 Tests: Reise-Logik, Export/Import, Suche, Speicher, KI-Prompt) |
| Backend | keines, alles läuft im Browser |
| Daten | Kulturpool-API (`/v2/search`, `/v2/similar`, `/v2/object`, `/institutions`), öffentlich mit offenem CORS; Wikidata für die mehrsprachige Suche |
| Speicherung | `localStorage` (Schlüssel `poolboard.history.v1`), Boards ohne Bilddateien, nur Bild-URLs |
| KI | [OpenRouter](https://openrouter.ai), Standardmodell `anthropic/claude-haiku-5.5` |

### Projektstruktur

```
src/
  api/         Kulturpool-Client, mehrsprachige Suche, Abfragen für Metadaten-Vorschläge, OpenRouter
  journey/     Reise-Logik als reine Funktionen (Reducer, Vorschlagsauswahl, geteilte Felder, Layout)
  exchange/    HTML-Export und -Import
  storage/     History im localStorage
  exhibition/  Fakten und Prompt für die KI-Einleitung
  components/  Oberflächen-Bausteine, Detailansicht, Suche, Karte, Einleitung
  pages/       Reise, Board, History
  App.tsx      Startseite, Navigation, Seitenwechsel
```

## Lokal starten

Voraussetzung: Node.js (getestet mit 22).

```bash
npm install
npm run dev     # http://localhost:5173
npm run test
npm run build
```

Nach jedem Pull, der `package.json` ändert, erneut `npm install` ausführen.

### KI-Einleitung einrichten (optional)

Ohne Schlüssel läuft alles außer der Einleitung. Zum Aktivieren `.env.example` nach `.env.local` kopieren und einen OpenRouter-Schlüssel eintragen:

```
VITE_OPENROUTER_API_KEY=...
# VITE_OPENROUTER_MODEL=anthropic/claude-haiku-5.5
```

Der Schlüssel liegt im Browser-Bundle und ist für jeden lesbar, der die Seite öffnet. Das ist nur für die lokale Demo gedacht. Für eine öffentliche Seite muss der Aufruf hinter einen kleinen Proxy; dafür ist nur [src/api/llm.ts](./src/api/llm.ts) anzupassen.

## Hinweise

- Die Oberfläche ist deutsch, Code und Kommentare sind englisch.
- Ob kulturpool.at den Poolboard-Export samt `data-poolboard-*`-Attributen beim Import akzeptiert, ist noch nicht bestätigt.
- Noch nicht umgesetzt: Anmeldung und Registrierung.
