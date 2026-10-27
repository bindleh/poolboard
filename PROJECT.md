# Poolboard – Projektbeschreibung

Hackathon-Projekt „Hack the pool 2026“. Zeitrahmen: ca. 2 Tage. Umsetzung durch einen einzelnen Agenten (Entwickler, Designer und Projektentwickler in einer Rolle). Das Projektteam (6 Personen) liefert Rückmeldung, keine Aufgabenteilung.

Begriffe stehen in [CONTEXT.md](./CONTEXT.md) und werden dort verbindlich definiert.

## Idee

Nutzer:innen erhalten ein zufälliges **Startobjekt** aus Kulturpool (kulturpool.at) und entdecken von dort aus Schritt für Schritt ähnliche Objekte. Zu jedem Objekt gibt es 10 **Metadaten-Vorschläge** und 10 **Bild-Vorschläge**. Gewählte Objekte bilden eine **Reise** (max. 20 Objekte, linear). Am Ende entsteht ein **Board**, das zeigt, wie die Objekte durch **Verbindungen** zusammenhängen. Boards liegen lokal in der **History** und lassen sich im Kulturpool-Favoriten-Format exportieren und importieren.

## Entscheidungen (aus dem Grilling-Gespräch)

| Thema | Entscheidung |
|---|---|
| Architektur | Reines Frontend (SPA), kein Backend im MVP. Kulturpool-API ist öffentlich, ohne Key, mit offenem CORS |
| Stack | Vite, React, TypeScript, Tailwind (eigene schlanke Komponenten statt shadcn/ui), React Flow für das Board |
| Sprache | UI und Dokumente Deutsch; Code, Bezeichner, Kommentare Englisch |
| Start | Zufälliges Startobjekt; Button „Anderes Zufallsobjekt“. Kein Suchfeld im MVP |
| Reise | Linear: Vorschläge kommen immer vom zuletzt hinzugefügten Objekt. Max. 20 Objekte |
| Ausblenden | Bereits hinzugefügte oder schon angezeigte Objekte erscheinen nicht erneut als Vorschlag |
| Metadaten-Ähnlichkeit | Zeile mit 15 Plätzen (`src/api/metadataQueries.ts`): die ersten 5 aus der semantischen Ähnlichkeitssuche (`on=metadata`, andere Institution), danach 10 aus feldbasierten Zufallsabfragen (Zeit, Künstler:in ×3, Mitwirkende:r↔Künstler:in, Objekttyp+Medium, isPartOf, Institution, Bildfarbe). Fehlende Plätze füllt die Hauptabfrage auf. Die Verbindung zeigt zusätzlich geteilte Felder (siehe unten) |
| Bild-Ähnlichkeit | Aus der API (`on=image`, CLIP) |
| Objektfilter | Nur Objekte mit Bild. Lizenz und Rechteinhaber werden in der Detailansicht angezeigt, aber nicht gefiltert |
| Beenden | „Reise beenden“ erzeugt das Board. Bei 20 Objekten passiert das automatisch |
| Neue Reise | Mit Rückfrage. Eine Reise mit mindestens 2 Objekten wird als Board in der History gespeichert, sonst verworfen |
| Rückgängig | Button „Letzten Schritt zurücknehmen“ entfernt das zuletzt hinzugefügte Objekt |
| Board-Titel | Automatisch (z. B. nach Startobjekt/Datum), editierbar |
| History | Lokal im Browser (IndexedDB oder localStorage). Snapshot ohne Bilddateien |
| Entferntes Objekt | Wird ein Objekt nicht mehr gefunden, zeigt das Board ein Standard-Platzhalterobjekt „Dieses Objekt wurde entfernt“ |
| Deployment | Vorerst nur lokale Demo; Veröffentlichung später durch den Nutzer |

## Mindestanforderungen (MVP)

1. Startseite lädt ein zufälliges Startobjekt mit Bild; „Anderes Zufallsobjekt“ würfelt neu.
2. Hauptbildschirm:
   - Oben: Fortschritt „Objekt n / 20“, „Reise beenden“, „Neue Reise“.
   - Links groß: aktuelles Objekt mit Bild und Kerndaten (Titel, Künstler:in, Datierung, Institution, Lizenz) und Link zu kulturpool.at.
   - Rechts oder darunter: zwei Reihen à 10 Thumbnails, „Inhaltlich ähnlich“ und „Optisch ähnlich“.
   - Unten: Leiste mit den bisherigen Objekten als Thumbnails.
3. Klick auf einen Vorschlag öffnet ein Detail-Overlay (großes Bild, alle verfügbaren Metadaten, Lizenz/Rechteinhaber) mit „Zur Reise hinzufügen“ und „Schließen“.
4. Hinzufügen macht das Objekt zum aktuellen Objekt; neue Vorschläge werden geladen.
5. „Letzten Schritt zurücknehmen“.
6. „Reise beenden“ oder 20 Objekte erzeugen das Board (Karten mit Pfeilen, Verbindungslabel mit Art, Score, geteilten Feldern). Anordnung als Zickzack/Schlange statt einer langen Zeile.
7. History-Seite: Liste der Boards mit Vorschaubild, Titel, Datum, Objektanzahl; Aktionen „Öffnen“ und „Löschen“ (mit Rückfrage).
8. Export/Import der Boards als HTML im Kulturpool-Favoriten-Format (siehe unten).
9. Ladezustände, Fehlerzustände (API nicht erreichbar, Rate-Limit, leere Ergebnisse) und eine brauchbare Darstellung auf Laptop-Breite.

## Optional (in dieser Reihenfolge, nur wenn der MVP fertig und stabil ist)

1. Suchfeld für das Startobjekt (`/v2/search?q=…`, Trefferliste mit Thumbnails).
2. Pinterest-artiges Board mit variabel großen Karten (z. B. über `imageAspectRatio`).
3. Registrierung/Login. Würde ein Backend erfordern und wird nicht gebaut; die Datenhaltung ist so zu kapseln, dass ein späterer Austausch einfach bleibt.

## Kulturpool-API (geprüft am 2026-10-27)

Basis: `https://api.kulturpool.at`. Keine Authentifizierung, CORS offen. Referenz: <https://api.kulturpool.at/reference/>, Swagger: <https://api.kulturpool.at/docs>.

| Zweck | Aufruf |
|---|---|
| Zufallsobjekt | `GET /v2/search?q=*&sort_by=_rand()&use_cache=false&per_page=1&facet_by=` |
| Ähnlich (Metadaten) | `GET /v2/similar?id=<uuid>&on=metadata&per_page=<n>` |
| Ähnlich (Bild) | `GET /v2/similar?id=<uuid>&on=image&per_page=<n>` |
| Objekt-Details (EDM) | `GET /v2/object?id=<uuid>` (liefert `metadata` als JSON-LD) |
| Suche | `GET /v2/search?q=<text>&filter_by=…&per_page=…&page=…` |

Hinweise:
- Ähnlichkeitstreffer: `hits[].document` plus `vector_distance` (kleiner = ähnlicher). Das Quellobjekt ist nicht enthalten.
- Wichtige Felder im `document`: `uuid`, `title`, `creator` (Liste), `dataProvider`, `date`, `dateMin`/`dateMax`, `dcType`, `edmType`, `mediaTypes`, `previewImage` (400-px-Thumbnail), `isShownBy`, `isShownAt`, `url` (Seite auf kulturpool.at), `edmRightsName`, `edmRightsReusePolicy` (`OPEN`/`RESTRICTED`/`CLOSED`), `dcRights`, `imageAspectRatio`.
- Schwellenwerte für `threshold` (Vorschlag zum Ausprobieren): Metadaten 0.15, Bild 0.75. Verteilungen vor dem Festlegen an echten Antworten prüfen.
- Objekte ohne Bildvektor liefern bei `on=image` HTTP 400; dann ohne Bild-Vorschläge weitermachen und das in der UI zeigen.
- Fehler: 422 bei ungültiger ID, 429 mit `Retry-After`, 503 bei Überlastung.
- Zum Ausblenden gesehener Objekte mehr als 10 Treffer anfordern (z. B. `per_page=40`), gefilterte Treffer entfernen und auf 10 kürzen.
- Bildfilter: `filter_by=mediaTypes:=image` hat in einem Test funktioniert, schließt aber z. B. Briefe als Bilder mit ein. Ob `edmType:=IMAGE` die bessere Wahl ist, beim Bauen gegen echte Daten prüfen.

## Verbindungen: geteilte Metadaten-Felder

Zu jedem Metadaten-Vorschlag wird im Client berechnet, welche Felder er mit dem Vorgänger teilt, z. B. Künstler:in (Namen normalisieren: „Klimt, Gustav“ ist gleich „Gustav Klimt“), Institution (`dataProvider`), Objekttyp (`dcType`), überlappender Zeitraum. Das Ergebnis steht auf der Verbindung, z. B. „Metadaten · Score 0.08 · gleiche Institution: Albertina“. Bild-Verbindungen zeigen „Bildähnlichkeit · Score 0.41“.

## Export und Import (Kulturpool-Favoriten-Format)

Referenzdatei: `docs/reference/kulturpool-favorites-example.html` (vom Nutzer geliefert, Version 2). Struktur:

- `<meta name="kulturpool-export" content="favorites" data-version="2" data-export-date="JJJJ-MM-TT / HH:MM:SS">`
- Pro Ordner `<section class="folder-section" data-folder-id data-folder-name>` mit `<h2 class="folder-title">Name (Anzahl)</h2>`
- Pro Objekt `<article class="favorite-card">` mit Attributen `data-id` (UUID), `data-folder`, `data-folder-name`, `data-sort-order`, `data-institution`, `data-title`, `data-is-shown-at`, `data-route` (`https://kulturpool.at/objekte/<uuid>`), `data-preview-image`, plus `<img class="preview-img">`, Institution, Titel und Links.

Abbildung:
- Ein Board ist ein Ordner (`data-folder-name` = Board-Titel). Die Reihenfolge der Reise ist `data-sort-order`. „Alles exportieren“ schreibt einen Ordner pro Board in dieselbe Datei.
- Unsere Zusatzdaten stehen als zusätzliche Attribute an der Karte: `data-poolboard-from` (UUID des Vorgängers), `data-poolboard-type` (`metadata` oder `image`), `data-poolboard-score`, `data-poolboard-shared` (z. B. JSON-Liste der geteilten Felder).
- Import von Poolboard-Dateien ergibt das Board mit Verbindungen. Reine Kulturpool-Favoriten (ohne Zusatzattribute) ergeben ein Board in Reihenfolge von `data-sort-order`, Verbindungen als „unbekannt“.
- Die Datei bleibt visuell wie das Original (druckbare Ansicht).

**Offen, vom Projektteam zu testen:** Ob der Importer auf kulturpool.at Dateien mit `data-poolboard-*`-Attributen akzeptiert. Falls nicht, Zusatzdaten stattdessen in ein `<script type="application/json">` im HTML legen und erneut testen.

## Persistenz

Pro Board wird ein Snapshot gespeichert: Titel, Datum, Objekte in Reihenfolge (ID, Titel, Künstler:in, Institution, Datierung, Lizenz, Vorschaubild-URL, Links) und die Verbindungen (Art, Score, geteilte Felder). Bilder werden bei der Anzeige von Kulturpool geladen, nicht lokal gespeichert. Speicherzugriff hinter einer kleinen Schnittstelle kapseln, damit sie später austauschbar ist.

## Design

Neutral mit Tailwind und eigenen schlanken Komponenten in Kulturpool-Optik: heller Hintergrund (`#f5f5f5`), Text `#1e1e1e`, schwarze Akzentlinien, Links `#0066cc`, ruhige Flächen, damit die Objektbilder wirken. Kein Dark Mode. Designskizzen des Projektteams (falls vorhanden) liegen unter `docs/design/`.

## Nicht im Umfang

Login/Registrierung, Server-Speicherung, eigene Bildähnlichkeitsberechnung, Bild-Upload-Suche, Mehrsprachigkeit.

## Zeitplan (Richtwert, ein Agent)

- **Tag 1:** Gerüst, API-Client, Reise-Logik, Hauptbildschirm und Detail-Overlay bis zum Hinzufügen.
- **Tag 2 Vormittag:** Board, History, Export/Import.
- **Tag 2 Nachmittag:** Fehler-/Ladezustände, Polishing, Demo-Probe; danach Optional-Liste in Reihenfolge.
