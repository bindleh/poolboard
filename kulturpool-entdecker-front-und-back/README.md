# Kulturpool Entdecker

Pinterest-artige Entdeckungs-App für die [Kulturpool-API](https://api.kulturpool.at/docs): Bilder aus österreichischen Sammlungen werden nach **Bild-** (CLIP) und **Metadatenähnlichkeit** empfohlen.

## Funktionen
- **Geschmack einstellen:** zufällige Bilder zur Auswahl (max. 3 je Institution), mindestens 3 wählen.
- **Feed „Für dich“:** Empfehlungen aus visuell *und* inhaltlich ähnlichen Objekten (`/v2/similar`), Herz zum Verfeinern.
- **Detailansicht:** vergrößertes Bild + 6 ähnliche Objekte (abwechselnd visuell / Metadaten), beliebig weiter klicken.
- **Boards:** erstellen, umbenennen, löschen, Bilder speichern/entfernen, „Mehr wie dieses Board“.
- **Nur normale Bilder:** Text-Digitalisate (Manuskripte, Briefe, Bücher …) werden über `filter_by` ausgeschlossen (siehe `NOT_TEXT` in `public/index.html`).

## Architektur
```
public/index.html   Frontend (Vanilla JS, keine Build-Schritte)
server.js           Express-Backend:
                      GET  /api/kp/*     Proxy zur Kulturpool-API (Allowlist, 5-min-Cache)
                      GET  /api/state    Likes + Boards des Nutzers
                      PUT  /api/state    speichern (validiert, als JSON-Datei in data/)
```
Nutzer sind anonym und werden über ein Cookie (`uid`) unterschieden – es gibt keine Anmeldung.

## Starten
Voraussetzung: Node.js ≥ 18.
```bash
npm install
npm start          # http://localhost:3000
```
Umgebungsvariablen: `PORT` (Standard 3000), `DATA_DIR` (Standard `./data`).

### Docker
```bash
docker build -t kulturpool-entdecker .
docker run -p 3000:3000 -v kp-data:/data kulturpool-entdecker
```

## Auf GitHub hochladen
```bash
git init
git add .
git commit -m "Kulturpool Entdecker"
git branch -M main
git remote add origin https://github.com/<user>/kulturpool-entdecker.git
git push -u origin main
```
Deployment z. B. auf Render, Railway oder Fly.io (Node-Service bzw. Dockerfile; für dauerhafte Boards ein Volume auf `DATA_DIR` legen).

## Hinweise
- Die Kulturpool-API braucht keinen Schlüssel. Bitte Nutzungsbedingungen und Rechteangaben der Objekte beachten (`edmRightsName`).
- Für den produktiven Einsatz mit vielen Nutzern: Datenbank statt JSON-Dateien und ein Rate-Limit auf `/api`.
